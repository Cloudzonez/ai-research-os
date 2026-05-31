import { Router } from "express";
import Paper from "../models/Paper.js";
import { enqueue } from "../services/queue.js";
import { searchArxiv } from "../services/ingestion/arxiv.js";
import { searchOpenAlex, searchOpenAlexSimple } from "../services/ingestion/openalex.js";
import { findRelatedPapers, extractRelationshipsForPaper, getRelationshipStats } from "../services/search/relationshipExtractor.js";
import { downloadBatchPdfs } from "../services/pdfDownloader.js";
import { authOptional } from "../middleware/auth.js";

const router = Router();

// Deduplication helper
async function findDuplicate(title, doi, text) {
  if (doi) {
    const byDoi = await Paper.findOne({ doi });
    if (byDoi) return byDoi;
  }

  if (text) {
    const fingerprint = text.slice(0, 500).replace(/\s/g, "");
    const papers = await Paper.find({}).lean();
    for (const p of papers) {
      if (p.text) {
        const pFingerprint = p.text.slice(0, 500).replace(/\s/g, "");
        if (fingerprint === pFingerprint) return p;
      }
    }
  }

  if (title) {
    const byTitle = await Paper.findOne({ title: { $regex: new RegExp(`^${title.slice(0, 30)}`, "i") } });
    if (byTitle) return byTitle;
  }

  return null;
}

// GET /api/papers/search — Search OpenAlex without saving to DB
router.get("/search", authOptional, async (req, res) => {
  try {
    const { q, page, sort, yearFrom, yearTo, perPage } = req.query;
    if (!q) return res.status(400).json({ error: "Query parameter 'q' is required" });

    const result = await searchOpenAlex(q, Number(perPage) || 15, {
      page: Number(page) || 1,
      sort: sort || "cited_by_count:desc",
      yearFrom: yearFrom ? Number(yearFrom) : undefined,
      yearTo: yearTo ? Number(yearTo) : undefined,
    });

    res.json(result);
  } catch (err) {
    console.error("Paper search error:", err);
    res.status(500).json({ error: err.message || "Search failed" });
  }
});

// POST /api/papers/save — Save an OpenAlex paper to library
router.post("/save", authOptional, async (req, res) => {
  try {
    const { title, authors, abstract, doi, year, source, url, pdfUrl, citedByCount, type, journal } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });

    // Check for duplicates
    const dup = await findDuplicate(title, doi, null);
    if (dup) return res.json({ paper: dup, duplicate: true });

    const paper = await Paper.create({
      title,
      authors: authors || [],
      abstract: abstract || "",
      doi: doi || "",
      year: year || new Date().getFullYear(),
      source: source || "openalex",
      url: url || "",
      area: "OpenAlex",
      score: citedByCount > 10 ? 85 : 70,
      sharing: "school",
      tags: ["OpenAlex", journal ? journal.slice(0, 30) : "Open access"],
      status: "parsed",
      itemType: type === "dataset" ? "repository" : "paper",
    });

    res.status(201).json({ paper });
  } catch (err) {
    console.error("Paper save error:", err);
    res.status(500).json({ error: err.message || "Save failed" });
  }
});

// GET all papers
router.get("/", authOptional, async (req, res) => {
  try {
    const papers = await Paper.find().sort({ createdAt: -1 }).lean();
    res.json({ papers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create paper
router.post("/", authOptional, async (req, res) => {
  try {
    const paper = await Paper.create(req.body);
    res.status(201).json({ paper });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET paper by ID
router.get("/:id", async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id);
    if (!paper) return res.status(404).json({ error: "Not found" });
    res.json({ paper });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update paper
router.put("/:id", async (req, res) => {
  try {
    const paper = await Paper.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!paper) return res.status(404).json({ error: "Not found" });
    res.json({ paper });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE paper
router.delete("/:id", async (req, res) => {
  try {
    await Paper.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST upload PDFs (filenames-only for frontend compat, or with base64 data)
router.post("/upload", authOptional, async (req, res) => {
  try {
    const { filenames, files, locale } = req.body;

    // Handle filename-only uploads (frontend compat)
    if (filenames && Array.isArray(filenames)) {
      const papers = await Promise.all(
        filenames.map((name) =>
          Paper.create({
            title: name.replace(/\.pdf$/i, ""),
            source: "PDF",
            area: locale === "zh" ? "教师上传" : "Teacher upload",
            score: 82,
            sharing: "school",
            tags: locale === "zh" ? ["解析中", "院系共享", "待摘要"] : ["Parsing", "School shared", "Pending summary"],
            status: "parsing",
          })
        )
      );
      return res.status(201).json({ papers });
    }

    // Handle base64-encoded PDF files
    if (files && Array.isArray(files)) {
      const papers = [];
      for (const file of files) {
        const { name, data: base64Data } = file;
        const buffer = Buffer.from(base64Data, "base64");

        // Extract PDF text
        let text = "";
        try {
          const pdfParse = (await import("pdf-parse")).default;
          const parsed = await pdfParse(buffer);
          text = parsed.text.slice(0, 50000);
        } catch (parseErr) {
          console.error("PDF parse error:", parseErr.message);
          // Continue without text — store as "error"
        }

        // Check for duplicates
        const dup = await findDuplicate(name, null, text);
        if (dup) {
          papers.push(dup);
          continue;
        }

        // Store PDF file
        const { put } = await import("../services/storage.js");
        const safeName = `${Date.now()}_${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const pdfPath = await put(safeName, buffer);

        // Create paper record
        const paper = await Paper.create({
          title: name.replace(/\.pdf$/i, ""),
          source: "PDF",
          area: locale === "zh" ? "教师上传" : "Teacher upload",
          score: 82,
          sharing: "school",
          tags: locale === "zh" ? ["解析中", "院系共享"] : ["Parsing", "School shared"],
          status: text ? "parsed" : "error",
          text,
          pdfPath,
        });

        // Enqueue summarization if text was extracted
        if (text) {
          await enqueue("summarize_paper", { paperId: paper._id.toString() }, {
            userId: req.user?._id,
          });
        }

        papers.push(paper);
      }
      return res.status(201).json({ papers });
    }

    return res.status(400).json({ error: "filenames or files array required" });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST analyze paper with AI
router.post("/:id/analyze", authOptional, async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id);
    if (!paper) return res.status(404).json({ error: "Paper not found" });

    const job = await enqueue("summarize_paper", { paperId: paper._id.toString() }, {
      userId: req.user?._id,
    });

    res.json({ message: "Analysis queued", jobId: job._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST ingest papers from external sources
router.post("/ingest", authOptional, async (req, res) => {
  try {
    const { query, sources, locale } = req.body;
    if (!query) return res.status(400).json({ error: "Query required" });

    const activeSources = sources || ["arxiv", "openalex"];
    const maxResults = req.body.maxResults || 10;
    let ingested = [];

    const pdfDownloads = [];

    if (activeSources.includes("arxiv")) {
      try {
        const arxivPapers = await searchArxiv(query, maxResults);
        for (const ap of arxivPapers) {
          const dup = await findDuplicate(ap.title, ap.doi, null);
          if (dup) {
            ingested.push(dup);
            continue;
          }
          const paper = await Paper.create({
            title: ap.title,
            authors: ap.authors,
            abstract: ap.abstract,
            doi: ap.doi,
            year: ap.year,
            source: "arxiv",
            area: query,
            score: 75,
            sharing: "school",
            tags: ["arXiv", locale === "zh" ? "开放获取" : "Open access"],
            status: "parsed",
          });
          ingested.push(paper);
          if (ap.pdfUrl) pdfDownloads.push({ paper, pdfUrl: ap.pdfUrl });
        }
      } catch (err) {
        console.error("arXiv ingestion error:", err.message);
      }
    }

    if (activeSources.includes("openalex")) {
      try {
        const { results: oaPapers } = await searchOpenAlex(query, maxResults);
        for (const op of oaPapers) {
          const dup = await findDuplicate(op.title, op.doi, null);
          if (dup) {
            ingested.push(dup);
            continue;
          }
          const paper = await Paper.create({
            title: op.title,
            authors: op.authors,
            abstract: op.abstract,
            doi: op.doi,
            year: op.year,
            source: "openalex",
            area: query,
            score: op.citedByCount > 10 ? 85 : 70,
            sharing: "school",
            tags: ["OpenAlex", locale === "zh" ? "开放获取" : "Open access"],
            status: "parsed",
          });
          ingested.push(paper);
          if (op.pdfUrl) pdfDownloads.push({ paper, pdfUrl: op.pdfUrl });
        }
      } catch (err) {
        console.error("OpenAlex ingestion error:", err.message);
      }
    }

    // Download PDFs for newly ingested papers
    const pdfResults = pdfDownloads.length > 0
      ? await downloadBatchPdfs(pdfDownloads)
      : null;

    // Deduplicate final list
    const seen = new Set();
    const unique = ingested.filter((p) => {
      const id = p._id?.toString();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    res.json({
      papers: unique,
      count: unique.length,
      sources: activeSources,
      pdfResults,
    });
  } catch (err) {
    console.error("Ingestion error:", err);
    res.status(500).json({ error: err.message });
  }

/**
 * GET /api/papers/:id/relationships
 * Get papers with specific relationship to target paper
 */
router.get("/:id/relationships", authOptional, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, minConfidence, maxResults } = req.query;

    if (!type) {
      return res.status(400).json({ error: "Relationship type is required" });
    }

    const options = {
      minConfidence: minConfidence ? parseFloat(minConfidence) : 0.5,
      maxResults: maxResults ? parseInt(maxResults) : 20,
    };

    const relatedPapers = await findRelatedPapers(id, type, options);

    res.json({
      paperId: id,
      relationshipType: type,
      count: relatedPapers.length,
      papers: relatedPapers,
    });
  } catch (error) {
    console.error("Get relationships error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/papers/:id/extract-relationships
 * Extract relationships for a paper
 */
router.post("/:id/extract-relationships", authOptional, async (req, res) => {
  try {
    const { id } = req.params;
    const { maxCitations, skipExisting } = req.body;

    const options = {
      maxCitations: maxCitations || 50,
      skipExisting: skipExisting !== false,
    };

    const results = await extractRelationshipsForPaper(id, options);

    res.json(results);
  } catch (error) {
    console.error("Extract relationships error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/papers/:id/relationship-stats
 * Get relationship statistics for a paper
 */
router.get("/:id/relationship-stats", authOptional, async (req, res) => {
  try {
    const { id } = req.params;
    const stats = await getRelationshipStats(id);
    res.json(stats);
  } catch (error) {
    console.error("Get relationship stats error:", error);
    res.status(500).json({ error: error.message });
  }
});
});

export default router;
