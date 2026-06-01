import { Router } from "express";
import Paper from "../models/Paper.js";
import { enqueue } from "../services/queue.js";
import { crawlArxiv } from "../services/ingestion/arxiv.js";
import { searchOpenAlex } from "../services/ingestion/openalex.js";
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

// GET all papers
router.get("/", authOptional, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const sort = req.query.sort || "createdAt";

    const filter = {};
    const q = (req.query.q || "").trim();
    if (q) {
      filter.title = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }

    const [papers, total] = await Promise.all([
      Paper.find(filter).sort({ [sort]: -1 }).skip(skip).limit(limit).lean(),
      Paper.countDocuments(filter),
    ]);

    res.json({ papers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: skip + papers.length < total } });
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
    const paper = await Paper.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!paper) return res.status(404).json({ error: "Not found" });
    res.json({ paper });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE paper
router.delete("/:id", async (req, res) => {
  try {
    const paper = await Paper.findByIdAndDelete(req.params.id);
    if (!paper) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
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
            sharing: "private",
            tags: locale === "zh" ? ["解析中", "私有", "待摘要"] : ["Parsing", "Private", "Pending summary"],
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
          sharing: "private",
          tags: locale === "zh" ? ["解析中", "私有"] : ["Parsing", "Private"],
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

// POST analyze paper with AI (enqueue summarization)
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

// POST summarize paper (immediate, not queued)
// Generates structured 5-field aiSummary + AI-styled HTML page
router.post("/:id/summarize", authOptional, async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id);
    if (!paper) return res.status(404).json({ error: "Paper not found" });

    const { summarizePaper } = await import("../services/paperSummarizer.js");
    const { generatePaperHTML } = await import("../services/htmlRenderer.js");

    const locale = req.body.locale || "zh";

    // Generate structured summary from abstract
    const aiSummary = await summarizePaper(
      { title: paper.title, abstract: paper.abstract || paper.summary || paper.text || "" },
      locale
    );

    paper.aiSummary = aiSummary;

    // Generate AI-styled HTML page
    try {
      paper.htmlPage = await generatePaperHTML(
        {
          title: paper.title,
          authors: paper.authors || [],
          abstract: paper.abstract || paper.summary || "",
          categories: paper.tags || [],
          url: paper.url || "",
          pdfUrl: paper.pdfUrl || (paper.url ? paper.url.replace("/abs/", "/pdf/") : ""),
          doi: paper.doi || "",
          aiSummary,
        },
        locale
      );
      paper.htmlGeneratedAt = new Date();
    } catch (htmlErr) {
      console.warn(`HTML generation failed: ${htmlErr.message}`);
    }

    paper.status = "summarized";
    await paper.save();

    res.json({ paper, aiSummary, hasHtml: !!paper.htmlPage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET AI-generated HTML page for a paper
router.get("/:id/html", async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id).lean();
    if (!paper) return res.status(404).json({ error: "Paper not found" });

    if (paper.htmlPage) {
      return res.type("text/html").send(paper.htmlPage);
    }

    // Generate on-the-fly if not cached (with fallback)
    const { generatePaperHTML } = await import("../services/htmlRenderer.js");
    const locale = req.query.locale || "zh";

    const html = await generatePaperHTML(
      {
        title: paper.title,
        authors: paper.authors || [],
        abstract: paper.abstract || paper.summary || "",
        categories: paper.tags || [],
        url: paper.url || "",
        pdfUrl: paper.pdfUrl || (paper.url ? paper.url.replace("/abs/", "/pdf/") : ""),
        doi: paper.doi || "",
        aiSummary: paper.aiSummary || {},
      },
      locale
    );

    // Cache the generated HTML
    await Paper.findByIdAndUpdate(req.params.id, {
      htmlPage: html,
      htmlGeneratedAt: new Date(),
    });

    res.type("text/html").send(html);
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
        const arxivPapers = await crawlArxiv(query, { maxResults, dedup: false });
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
          // Auto-enqueue AI summarization for new papers
          await enqueue("summarize_paper", { paperId: paper._id.toString() }, {
            userId: req.user?._id,
          });
        }
      } catch (err) {
        console.error("arXiv ingestion error:", err.message);
      }
    }

    if (activeSources.includes("openalex")) {
      try {
        const oaPapers = await searchOpenAlex(query, maxResults);
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
          // Auto-enqueue AI summarization
          await enqueue("summarize_paper", { paperId: paper._id.toString() }, {
            userId: req.user?._id,
          });
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
});

export default router;
