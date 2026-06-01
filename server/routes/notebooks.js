import { Router } from "express";
import Notebook from "../models/Notebook.js";
import Paper from "../models/Paper.js";
import { authRequired } from "../middleware/auth.js";
import {
  createWorkspace,
  uploadSource,
  deleteSource,
  chatWithSources,
  generateArtifact,
  deleteWorkspace,
} from "../services/notebooklm.js";
import { chat } from "../services/deepseek.js";

const router = Router();

// All routes require authentication
router.use(authRequired);

// ─── Ownership guard helper ────────────────────────────────────────────────
function assertOwner(notebook, userId) {
  if (!notebook) return false;
  return notebook.owner.toString() === userId.toString();
}

// ─── GET /api/notebooks ─────────────────────────────────────────────────────
// List all notebooks belonging to the authenticated user only
router.get("/", async (req, res) => {
  try {
    const notebooks = await Notebook.find({ owner: req.user._id })
      .sort({ lastAccessed: -1 })
      .lean();
    res.json({ notebooks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/notebooks ────────────────────────────────────────────────────
// Create a new notebook — ATOMIC: Google first, then local
router.post("/", async (req, res) => {
  try {
    const { title, description, coverImage } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title is required." });

    // Step 1: Create on Google Cloud FIRST
    const { workspaceId } = await createWorkspace(title.trim());

    // Step 2: ONLY if Google succeeded, save locally
    const notebook = await Notebook.create({
      title: title.trim(),
      description: description || "",
      coverImage: coverImage || "",
      owner: req.user._id,
      googleCloudWorkspaceId: workspaceId,
      sources: [],
      studioArtifacts: [],
      sourceCount: 0,
    });

    res.status(201).json({ notebook });
  } catch (err) {
    console.error("Create notebook error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/notebooks/:id ─────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const notebook = await Notebook.findById(req.params.id).lean();
    if (!notebook) return res.status(404).json({ error: "Notebook not found." });
    if (!assertOwner(notebook, req.user._id))
      return res.status(403).json({ error: "Access denied." });

    // Update lastAccessed
    await Notebook.findByIdAndUpdate(req.params.id, { lastAccessed: new Date() });
    res.json({ notebook });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/notebooks/:id ─────────────────────────────────────────────────
// Update title / description / coverImage
router.put("/:id", async (req, res) => {
  try {
    const notebook = await Notebook.findById(req.params.id);
    if (!notebook) return res.status(404).json({ error: "Notebook not found." });
    if (!assertOwner(notebook, req.user._id))
      return res.status(403).json({ error: "Access denied." });

    const { title, description, coverImage } = req.body;
    if (title) notebook.title = title.trim();
    if (description !== undefined) notebook.description = description;
    if (coverImage !== undefined) notebook.coverImage = coverImage;
    await notebook.save();

    res.json({ notebook });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/notebooks/:id ──────────────────────────────────────────────
// Delete notebook — ATOMIC: Google first, then local
router.delete("/:id", async (req, res) => {
  try {
    const notebook = await Notebook.findById(req.params.id);
    if (!notebook) return res.status(404).json({ error: "Notebook not found." });
    if (!assertOwner(notebook, req.user._id))
      return res.status(403).json({ error: "Access denied." });

    // Step 1: Delete from Google Cloud first
    await deleteWorkspace(notebook.googleCloudWorkspaceId);

    // Step 2: Only if Google deletion succeeded, remove locally
    await Notebook.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/notebooks/:id/sources ────────────────────────────────────────
// Add a source from the user's paper library — ATOMIC sync
router.post("/:id/sources", async (req, res) => {
  try {
    const notebook = await Notebook.findById(req.params.id);
    if (!notebook) return res.status(404).json({ error: "Notebook not found." });
    if (!assertOwner(notebook, req.user._id))
      return res.status(403).json({ error: "Access denied." });

    const { paperId } = req.body;
    if (!paperId) return res.status(400).json({ error: "paperId is required." });

    // Get paper from local library
    const paper = await Paper.findById(paperId).lean();
    if (!paper) return res.status(404).json({ error: "Paper not found." });

    // Check if already added
    const alreadyAdded = notebook.sources.some(
      (s) => s.paperId?.toString() === paperId
    );
    if (alreadyAdded) return res.status(409).json({ error: "Source already in notebook." });

    // Build text content for Google
    const textContent = [
      paper.title,
      paper.authors?.join(", "),
      paper.abstract,
      paper.summary,
      paper.text,
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 100000);

    // Step 1: Upload to Google Cloud FIRST
    const { googleSourceId } = await uploadSource(
      notebook.googleCloudWorkspaceId,
      { title: paper.title, textContent }
    );

    // Step 2: Save locally only on Google success
    notebook.sources.push({
      paperId,
      title: paper.title,
      type: "paper",
      googleSourceId,
    });
    notebook.sourceCount = notebook.sources.length;
    await notebook.save();

    res.status(201).json({ notebook });
  } catch (err) {
    console.error("Add source error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/notebooks/:id/sources/:sourceId ────────────────────────────
router.delete("/:id/sources/:sourceId", async (req, res) => {
  try {
    const notebook = await Notebook.findById(req.params.id);
    if (!notebook) return res.status(404).json({ error: "Notebook not found." });
    if (!assertOwner(notebook, req.user._id))
      return res.status(403).json({ error: "Access denied." });

    const source = notebook.sources.id(req.params.sourceId);
    if (!source) return res.status(404).json({ error: "Source not found." });

    // Step 1: Delete from Google Cloud first
    if (source.googleSourceId) {
      await deleteSource(notebook.googleCloudWorkspaceId, source.googleSourceId);
    }

    // Step 2: Remove locally
    notebook.sources.pull(req.params.sourceId);
    notebook.sourceCount = notebook.sources.length;
    await notebook.save();

    res.json({ notebook });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/notebooks/:id/chat ───────────────────────────────────────────
// Send a chat message — fully grounded by Google's RAG
router.post("/:id/chat", async (req, res) => {
  try {
    const notebook = await Notebook.findById(req.params.id);
    if (!notebook) return res.status(404).json({ error: "Notebook not found." });
    if (!assertOwner(notebook, req.user._id))
      return res.status(403).json({ error: "Access denied." });

    const { query, history = [] } = req.body;
    if (!query?.trim()) return res.status(400).json({ error: "Query is required." });

    if (notebook.sources.length === 0) {
      return res.json({
        text: "Please add at least one source to this notebook before asking questions.",
        citations: [],
      });
    }

    // Delegate to Google NotebookLM grounded chat
    const { text, citations } = await chatWithSources(
      notebook.googleCloudWorkspaceId,
      query.trim(),
      history
    );

    // Update last accessed
    await Notebook.findByIdAndUpdate(req.params.id, { lastAccessed: new Date() });

    res.json({ text, citations });
  } catch (err) {
    console.error("Notebook chat error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/notebooks/:id/studio ─────────────────────────────────────────
// Generate a Studio artifact — ATOMIC: generate via API then save locally
router.post("/:id/studio", async (req, res) => {
  try {
    const notebook = await Notebook.findById(req.params.id).populate("sources.paperId");
    if (!notebook) return res.status(404).json({ error: "Notebook not found." });
    if (!assertOwner(notebook, req.user._id))
      return res.status(403).json({ error: "Access denied." });

    const { type } = req.body;
    const validTypes = [
      "audio_overview", "slide_deck", "video_overview", "mind_map",
      "report", "flashcards", "quiz", "infographic", "data_table",
    ];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid artifact type: ${type}` });
    }

    if (notebook.sources.length === 0) {
      return res.status(400).json({ error: "Add sources before generating artifacts." });
    }

    // Build source context for generation
    const sourcesForGeneration = notebook.sources.map((s) => ({
      title: s.title,
      textContent: s.paperId?.abstract || s.paperId?.text || s.paperId?.summary || "",
    }));

    // Step 1: Generate via Google API (with DeepSeek fallback for some types)
    const { content } = await generateArtifact(
      notebook.googleCloudWorkspaceId,
      type,
      sourcesForGeneration,
      chat
    );

    // Step 2: Save artifact locally (for instant reload next visit)
    const artifactTitle = type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    notebook.studioArtifacts.push({ type, title: artifactTitle, content });
    await notebook.save();

    const artifact = notebook.studioArtifacts[notebook.studioArtifacts.length - 1];
    res.status(201).json({ artifact });
  } catch (err) {
    console.error("Studio generation error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/notebooks/:id/studio/:artifactId ───────────────────────────
router.delete("/:id/studio/:artifactId", async (req, res) => {
  try {
    const notebook = await Notebook.findById(req.params.id);
    if (!notebook) return res.status(404).json({ error: "Notebook not found." });
    if (!assertOwner(notebook, req.user._id))
      return res.status(403).json({ error: "Access denied." });

    notebook.studioArtifacts.pull(req.params.artifactId);
    await notebook.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/notebooks/:id/notes ──────────────────────────────────────────
router.post("/:id/notes", async (req, res) => {
  try {
    const notebook = await Notebook.findById(req.params.id);
    if (!notebook) return res.status(404).json({ error: "Notebook not found." });
    if (!assertOwner(notebook, req.user._id))
      return res.status(403).json({ error: "Access denied." });

    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Content is required." });

    notebook.notes.push({ content: content.trim() });
    await notebook.save();
    res.status(201).json({ note: notebook.notes[notebook.notes.length - 1] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
