import { Router } from "express";
import path from "node:path";
import { config } from "../config.js";
import Tracker from "../models/Tracker.js";
import Paper from "../models/Paper.js";
import { chat, parseResponse } from "../services/deepseek.js";
import { buildTrackerSpec, crawlTrackerSpec } from "../services/trackerCrawl.js";
import { runAITriage } from "../services/aiTriage.js";
import { createTrackerDebugLog, clearActiveDebugLog } from "../services/trackerDebugLog.js";
import { buildTrackerGenPrompt } from "../prompts/trackers.js";
import { authRequired, authOptional } from "../middleware/auth.js";

const router = Router();

// ── Helpers ──────────────────────────────────────────

function buildSharingFilter(user) {
  if (!user) return { sharing: "university" };
  const schoolMatch = user.schoolId ? { schoolId: user.schoolId } : { schoolId: null };
  return {
    $or: [
      { sharing: "university" },
      { sharing: "school", ...schoolMatch },
      { sharing: "project", ...schoolMatch },
      { sharing: "private", ownerId: user._id },
    ],
  };
}

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

// ── Routes ───────────────────────────────────────────

// GET /api/trackers — paginated, searchable, sharing-aware
router.get("/", authOptional, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const q = (req.query.q || "").trim();

    // Build sharing-aware filter for trackers
    const filter = {};
    if (req.user) {
      const schoolMatch = req.user.schoolId ? { schoolId: req.user.schoolId } : { schoolId: null };
      filter.$or = [
        { schoolId: { $in: [null, req.user.schoolId] } },
        { ownerId: req.user._id },
      ];
    } else {
      filter.ownerId = null;
    }

    if (q) {
      filter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }

    const [trackers, total] = await Promise.all([
      Tracker.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Tracker.countDocuments(filter),
    ]);

    res.json({
      trackers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: skip + trackers.length < total },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trackers — create tracker manually
router.post("/", authRequired, async (req, res) => {
  try {
    const tracker = await Tracker.create({
      ...req.body,
      ownerId: req.user._id,
      schoolId: req.user.schoolId || null,
    });
    res.status(201).json({ tracker });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/trackers/:id — update tracker
router.put("/:id", authRequired, async (req, res) => {
  try {
    const existing = await Tracker.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.ownerId && existing.ownerId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }
    Object.assign(existing, req.body);
    // Never allow overwriting owner
    existing.ownerId = existing.ownerId || req.user._id;
    existing.schoolId = existing.schoolId || req.user.schoolId || null;
    await existing.save();
    res.json({ tracker: existing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/trackers/:id — delete tracker
router.delete("/:id", authRequired, async (req, res) => {
  try {
    const existing = await Tracker.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.ownerId && existing.ownerId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }
    await Tracker.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trackers/generate — AI-generate + create + crawl in one shot
router.post("/generate", authRequired, async (req, res) => {
  try {
    const { topic, locale, maxResults } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic required" });

    const debugLog = createTrackerDebugLog();
    try {
      debugLog.section(`POST /generate: "${topic}"`);

      let aiText = "";
      try {
        const result = await chat(
          [{ role: "user", content: buildTrackerGenPrompt(topic) }],
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
        ownerId: req.user._id,
        schoolId: req.user.schoolId || null,
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

// GET /api/trackers/:id — tracker detail with papers
router.get("/:id", authOptional, async (req, res) => {
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

// POST /api/trackers/:id/crawl — crawl a tracker with concurrent-run guard
router.post("/:id/crawl", authRequired, async (req, res) => {
  try {
    const debugLog = createTrackerDebugLog();
    try {
      debugLog.section(`POST /:id/crawl — trackerId="${req.params.id}"`);

      // Atomic guard: only set to "running" if currently idle/failed/completed
      const tracker = await Tracker.findOneAndUpdate(
        { _id: req.params.id, crawlStatus: { $in: ["idle", "completed", "partial", "failed"] } },
        { crawlStatus: "running" },
        { new: true }
      );
      if (!tracker) {
        const existing = await Tracker.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Tracker not found" });
        if (existing.crawlStatus === "running") {
          return res.status(409).json({ error: "Crawl already in progress" });
        }
        return res.status(409).json({ error: "Cannot start crawl — tracker is not in an idle state" });
      }

      debugLog.info("tracker locked to 'running'", {
        name: tracker.name,
        keywords: tracker.keywords,
        sources: tracker.sources,
        existingPaperCount: tracker.papers,
      });

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

      await Tracker.findByIdAndUpdate(tracker._id, {
        papers: crawl.paperCount,
        lastRun: new Date(),
        crawlStatus,
        lastCrawlQuery: crawl.query,
        lastCrawlErrors: crawl.errors,
        lastCrawledPaperIds: crawl.papers.map((paper) => paper._id).filter(Boolean),
      });

      // Re-fetch to return clean state
      const updated = await Tracker.findById(tracker._id).lean();

      debugLog.info("tracker saved to DB", {
        trackerId: updated._id?.toString(),
        papers: updated.papers,
        status: updated.crawlStatus,
        logFile: debugLog.logFile,
      });

      res.json({ tracker: updated, crawl, papers: crawl.papers, triage, logFile: debugLog.logFile });
    } finally {
      clearActiveDebugLog();
    }
  } catch (err) {
    console.error("[trackers] crawl error:", err.message, err.stack?.slice(0, 500));
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trackers/stale-recover — admin-only: unsticks stale "running" trackers
router.post("/stale-recover", authRequired, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin required" });
  }
  try {
    const staleTimeout = new Date(Date.now() - 30 * 60 * 1000); // 30 min
    const result = await Tracker.updateMany(
      { crawlStatus: "running", lastRun: { $lt: staleTimeout } },
      { crawlStatus: "failed", $push: { lastCrawlErrors: { source: "recovery", error: "Stale crawl — auto-recovered" } } }
    );
    res.json({ recovered: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
