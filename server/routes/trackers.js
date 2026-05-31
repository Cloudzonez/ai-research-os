import { Router } from "express";
import path from "node:path";
import { config } from "../config.js";
import Tracker from "../models/Tracker.js";
import Paper from "../models/Paper.js";
import { chat, parseResponse } from "../services/deepseek.js";
import { buildTrackerSpec, crawlTrackerSpec } from "../services/trackerCrawl.js";
import { runAITriage } from "../services/aiTriage.js";
import { createTrackerDebugLog, setActiveDebugLog, clearActiveDebugLog } from "../services/trackerDebugLog.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const trackers = await Tracker.find().sort({ createdAt: -1 }).lean();
    res.json({ trackers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const tracker = await Tracker.create(req.body);
    res.status(201).json({ tracker });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/generate", async (req, res) => {
  try {
    const { topic, locale, maxResults } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic required" });

    const debugLog = createTrackerDebugLog();
    setActiveDebugLog(debugLog);
    try {
      debugLog.section(`POST /generate: "${topic}"`);

      let aiText = "";
      try {
        const result = await chat(
          [{ role: "user", content: `Generate a research paper and code tracker for this topic: "${topic}". Return only JSON: {"name":"...","keywords":[...],"sources":["arxiv","openalex","semantic_scholar","github"],"signals":["..."]}. Include "semantic_scholar" for citation/abstract-rich academic tracking. Include "github" only when repository/code tracking is useful.` }],
          locale || "zh",
          { temperature: 0.2, maxTokens: 500 }
        );
        aiText = parseResponse(result.content).text;
        debugLog.info("AI tracker spec generated", { aiText: aiText?.slice(0, 200) });
      } catch (err) {
        debugLog.warn("AI spec generation failed, using fallback", { error: err.message });
        aiText = "";
      }

      const trackerData = buildTrackerSpec(topic, { locale: locale || "zh", aiText });
      debugLog.info("tracker spec built", {
        name: trackerData.name,
        keywords: trackerData.keywords,
        sources: trackerData.sources,
        signals: trackerData.signals,
      });

      const crawl = await crawlTrackerSpec(trackerData, {
        locale: locale || "zh",
        maxResults: Number(maxResults) || 50,
        debugLog,
      });
      const crawlStatus = crawl.errors.length && crawl.paperCount === 0
        ? "failed"
        : crawl.errors.length
          ? "partial"
          : "completed";
      debugLog.info("crawl result status", { status: crawlStatus, papers: crawl.paperCount, newPapers: crawl.newPaperCount, errors: crawl.errors.length });

      // Run AI triage on newly crawled papers
      let triage = null;
      if (crawl.newPaperIds && crawl.newPaperIds.length > 0) {
        try {
          debugLog.begin(`AI triage — ${crawl.newPaperIds.length} papers`);
          triage = await runAITriage(trackerData, crawl.newPaperIds, {
            PaperModel: Paper,
          });
          debugLog.end("AI triage done", { paperCount: triage?.decisions?.length || 0 });
        } catch (err) {
          debugLog.error("AI triage failed", { error: err.message });
          console.error("AI triage failed:", err.message);
        }
      }

      const tracker = await Tracker.create({
        ...trackerData,
        papers: crawl.paperCount,
        subscribers: 1,
        lastRun: new Date(),
        crawlStatus,
        lastCrawlQuery: crawl.query,
        lastCrawlErrors: crawl.errors,
        lastCrawledPaperIds: crawl.papers.map((paper) => paper._id).filter(Boolean),
      });

      debugLog.info("tracker saved to DB", { trackerId: tracker._id?.toString(), logFile: debugLog.logFile });

      res.status(201).json({ tracker, crawl, papers: crawl.papers, triage });
    } finally {
      clearActiveDebugLog();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const tracker = await Tracker.findById(req.params.id).lean();
    if (!tracker) return res.status(404).json({ error: "Tracker not found" });

    const ids = (tracker.lastCrawledPaperIds || []).filter(Boolean);
    const records = ids.length
      ? await Paper.find({ _id: { $in: ids } }).lean()
      : [];
    const order = new Map(ids.map((id, index) => [String(id), index]));
    records.sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0));

    const items = records.map(toClientPaper);
    const repositories = items.filter((paper) => paper.itemType === "repository" || paper.source === "github");
    const papers = items.filter((paper) => paper.itemType !== "repository" && paper.source !== "github");

    res.json({
      tracker,
      papers,
      repositories,
      crawl: {
        status: tracker.crawlStatus,
        query: tracker.lastCrawlQuery,
        errors: tracker.lastCrawlErrors || [],
        lastRun: tracker.lastRun,
        paperCount: papers.length,
        repositoryCount: repositories.length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/crawl", async (req, res) => {
  try {
    const debugLog = createTrackerDebugLog();
    setActiveDebugLog(debugLog);
    try {
      debugLog.section(`POST /:id/crawl — trackerId="${req.params.id}"`);

      const tracker = await Tracker.findById(req.params.id);
      if (!tracker) {
        debugLog.error("Tracker not found", { id: req.params.id });
        return res.status(404).json({ error: "Tracker not found" });
      }

      debugLog.info("tracker loaded", {
        name: tracker.name,
        keywords: tracker.keywords,
        sources: tracker.sources,
        existingPaperCount: tracker.papers,
      });

      tracker.crawlStatus = "running";
      await tracker.save();
      debugLog.info("tracker status set to 'running'");

      const trackerSpec = {
        name: tracker.name,
        keywords: tracker.keywords,
        sources: tracker.sources,
        signals: tracker.signals,
      };

      const crawl = await crawlTrackerSpec(trackerSpec, {
        locale: req.body.locale || "zh",
        maxResults: Number(req.body.maxResults) || 50,
        debugLog,
      });

      const crawlStatus = crawl.errors.length && crawl.paperCount === 0
        ? "failed"
        : crawl.errors.length
          ? "partial"
          : "completed";
      debugLog.info("crawl result status", { status: crawlStatus, papers: crawl.paperCount, newPapers: crawl.newPaperCount, errors: crawl.errors.length });

      // Run AI triage on newly crawled papers
      let triage = null;
      if (crawl.newPaperIds && crawl.newPaperIds.length > 0) {
        try {
          debugLog.begin(`AI triage — ${crawl.newPaperIds.length} papers`);
          triage = await runAITriage(trackerSpec, crawl.newPaperIds, {
            PaperModel: Paper,
          });
          debugLog.end("AI triage done", { paperCount: triage?.decisions?.length || 0 });
        } catch (err) {
          debugLog.error("AI triage failed", { error: err.message });
          console.error("AI triage failed:", err.message);
        }
      }

      tracker.papers = crawl.paperCount;
      tracker.lastRun = new Date();
      tracker.crawlStatus = crawlStatus;
      tracker.lastCrawlQuery = crawl.query;
      tracker.lastCrawlErrors = crawl.errors;
      tracker.lastCrawledPaperIds = crawl.papers.map((paper) => paper._id).filter(Boolean);
      await tracker.save();

      debugLog.info("tracker saved to DB", {
        trackerId: tracker._id?.toString(),
        papers: tracker.papers,
        status: tracker.crawlStatus,
        logFile: debugLog.logFile,
      });

      res.json({ tracker, crawl, papers: crawl.papers, triage, logFile: debugLog.logFile });
    } finally {
      clearActiveDebugLog();
    }
  } catch (err) {
    console.error("[trackers] crawl error:", err.message, err.stack?.slice(0, 500));
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await Tracker.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function toClientPaper(paper) {
  const itemType = paper.itemType || ((paper.tags || []).includes("repository") ? "repository" : "paper");
  const pdfUrl = getPdfUrl(paper.pdfPath);
  return {
    _id: paper._id,
    title: paper.title,
    source: paper.source,
    sourceIds: paper.sourceIds || {},
    area: paper.area,
    score: paper.score,
    sharing: paper.sharing,
    tags: paper.tags || [],
    doi: paper.doi || "",
    abstract: paper.abstract || "",
    authors: paper.authors || [],
    year: paper.year,
    url: paper.url || "",
    itemType,
    stars: paper.stars || 0,
    forks: paper.forks || 0,
    language: paper.language || "",
    repositoryUpdatedAt: paper.repositoryUpdatedAt,
    summary: paper.summary || "",
    contributions: paper.contributions || "",
    methods: paper.methods || "",
    limitations: paper.limitations || "",
    status: paper.status || "parsed",
    hasPdf: Boolean(pdfUrl),
    pdfUrl,
    triageRelevance: paper.triageRelevance,
    triageCategory: paper.triageCategory,
    triageNovelty: paper.triageNovelty,
    triageReasoning: paper.triageReasoning,
  };
}

function getPdfUrl(pdfPath) {
  if (!pdfPath) return "";
  if (pdfPath.startsWith("/uploads/")) return pdfPath;

  const storageRoot = path.resolve(config.storagePath);
  const resolved = path.resolve(pdfPath);
  if (!resolved.startsWith(storageRoot)) return "";

  const relative = path.relative(storageRoot, resolved);
  return `/uploads/${relative.split(path.sep).map(encodeURIComponent).join("/")}`;
}

export default router;
