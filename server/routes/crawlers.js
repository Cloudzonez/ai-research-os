import { Router } from "express";
import CrawlerPlugin from "../models/CrawlerPlugin.js";
import { authRequired, adminRequired } from "../middleware/auth.js";
import { runInSandbox, testCrawlerPlugin } from "../services/sandbox.js";
import { runStandardCrawler, suggestStandardCrawlerSpec } from "../services/standardCrawler.js";

const router = Router();

// GET all crawlers (with optional filtering)
router.get("/", authRequired, async (req, res) => {
  try {
    const { active, approved, scope } = req.query;
    const filter = {};

    if (active !== undefined) filter.active = active === "true";
    if (approved !== undefined) filter.approved = approved === "true";

    // Filter by sharing scope
    if (scope) {
      filter.sharingScope = scope;
    } else {
      // Show user's own + shared crawlers
      filter.$or = [
        { owner: req.user._id },
        { sharingScope: { $in: ["school", "university"] } },
      ];
    }

    const crawlers = await CrawlerPlugin.find(filter)
      .sort({ createdAt: -1 })
      .populate("owner", "name email")
      .populate("approvedBy", "name email")
      .lean();

    res.json({ crawlers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a crawler plugin
router.post("/", authRequired, async (req, res) => {
  try {
    const crawler = await CrawlerPlugin.create({
      ...req.body,
      owner: req.user._id,
      active: true,
      approved: true,
    });
    res.status(201).json({ crawler });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST generate a crawler plugin spec backed by maintained standard connectors
router.post("/generate", authRequired, async (req, res) => {
  try {
    const { description, sources, locale, maxResults } = req.body;
    if (!description) return res.status(400).json({ error: "Description required" });

    const spec = await suggestStandardCrawlerSpec(description, {
      sources,
      locale: locale || "zh",
      maxResults,
    });

    const tests = spec.sources.map((source, i) => ({
      input: description,
      expectedOutput: source,
      description: `Standard connector configured: ${source}`,
    }));

    const crawler = await CrawlerPlugin.create({
      name: spec.name || description.slice(0, 60),
      description,
      crawlerKind: "standard",
      crawlerSpec: spec,
      sourceConfig: {
        type: spec.sources[0] || "arxiv",
        rateLimit: 1000,
      },
      parserCode: JSON.stringify(spec, null, 2),
      tests,
      owner: req.user._id,
      active: true,
      approved: true,
    });

    res.status(201).json({
      crawler,
      spec,
      testResults: tests.map((test) => ({ status: "configured", description: test.description })),
      model: "standard-connectors",
    });
  } catch (err) {
    console.error("Crawler generation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST run crawler in sandbox
router.post("/:id/run", authRequired, async (req, res) => {
  try {
    const crawler = await CrawlerPlugin.findById(req.params.id);
    if (!crawler) return res.status(404).json({ error: "Crawler not found" });

    const startTime = Date.now();
    const standardSpec = getStandardSpec(crawler);
    if (standardSpec) {
      const crawl = await runStandardCrawler(standardSpec);
      const logStatus = crawl.errors.length && crawl.itemCount === 0
        ? "failed"
        : crawl.errors.length
          ? "completed"
          : "passed";

      crawler.sandboxLog.push({
        runAt: new Date(),
        status: logStatus,
        output: JSON.stringify({
          query: crawl.query,
          sources: crawl.sources,
          sourceResults: crawl.sourceResults,
          itemCount: crawl.itemCount,
        }).slice(0, 2000),
        error: crawl.errors.map((err) => `${err.source}: ${err.error}`).join("\n").slice(0, 500),
        duration: Date.now() - startTime,
      });
      crawler.lastRun = new Date();
      crawler.runCount = (crawler.runCount || 0) + 1;
      await crawler.save();

      return res.json({
        result: {
          status: logStatus,
          output: JSON.stringify(crawl.items),
          error: crawl.errors.map((err) => `${err.source}: ${err.error}`).join("\n"),
          duration: Date.now() - startTime,
        },
        sandboxLog: crawler.sandboxLog,
        crawledItems: crawl.items,
        crawledPapers: crawl.papers,
        crawledRepositories: crawl.repositories,
        paperCount: crawl.paperCount,
        repositoryCount: crawl.repositoryCount,
        itemCount: crawl.itemCount,
        sourceResults: crawl.sourceResults,
        errors: crawl.errors,
        pdfResults: crawl.pdfResults,
      });
    }

    const result = await runInSandbox(crawler.parserCode, {
      timeout: 30000,
    });

    // Map sandbox status to model enum
    const statusMap = { completed: "passed", error: "failed", timeout: "timeout" };
    const logStatus = statusMap[result.status] || result.status || "error";

    // Try to parse crawled papers from the output
    let crawledPapers = [];
    try {
      // The sandbox output may contain JSON in various forms
      const output = result.output || "";
      const jsonMatch = output.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        crawledPapers = JSON.parse(jsonMatch[0]);
        // Ensure it's an array of objects with at least a title
        if (!Array.isArray(crawledPapers)) crawledPapers = [];
        crawledPapers = crawledPapers.filter((p) => p && p.title);
      }
    } catch {
      crawledPapers = [];
    }

    // Store crawled papers in the Paper collection
    const storedPapers = [];
    if (crawledPapers.length > 0) {
      const Paper = (await import("../models/Paper.js")).default;
      for (const cp of crawledPapers) {
        try {
          const existing = await Paper.findOne({
            $or: [
              cp.doi ? { doi: cp.doi } : null,
              { title: cp.title },
            ].filter(Boolean),
          });
          if (!existing) {
            const paper = await Paper.create({
              title: cp.title || "Unknown",
              authors: cp.authors || [],
              abstract: cp.abstract || cp.summary || "",
              doi: cp.doi || "",
              year: cp.year || new Date().getFullYear(),
              source: cp.source || crawler.sourceConfig?.type || "crawler",
              area: crawler.description || "",
              score: 70,
              sharing: "school",
              tags: ["crawled", crawler.name?.slice(0, 20) || ""].filter(Boolean),
              status: "parsed",
            });
            storedPapers.push(paper);
          } else {
            storedPapers.push(existing);
          }
        } catch {
          // skip individual paper errors
        }
      }
    }

    crawler.sandboxLog.push({
      runAt: new Date(),
      status: logStatus,
      output: result.output?.slice(0, 2000) || "",
      error: result.error?.slice(0, 500) || "",
      duration: Date.now() - startTime,
    });
    crawler.lastRun = new Date();
    crawler.runCount = (crawler.runCount || 0) + 1;
    await crawler.save();

    res.json({
      result,
      sandboxLog: crawler.sandboxLog,
      crawledPapers: storedPapers.map((p) => ({
        _id: p._id,
        title: p.title,
        authors: p.authors,
        year: p.year,
        doi: p.doi,
        source: p.source,
        abstract: p.abstract?.slice(0, 300),
      })),
      paperCount: storedPapers.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST approve crawler (admin only)
router.post("/:id/approve", authRequired, adminRequired, async (req, res) => {
  try {
    const crawler = await CrawlerPlugin.findByIdAndUpdate(
      req.params.id,
      {
        approved: true,
        approvedBy: req.user._id,
        active: true,
      },
      { new: true }
    );
    if (!crawler) return res.status(404).json({ error: "Crawler not found" });
    res.json({ crawler });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE crawler
router.delete("/:id", authRequired, async (req, res) => {
  try {
    const crawler = await CrawlerPlugin.findById(req.params.id);
    if (!crawler) return res.status(404).json({ error: "Crawler not found" });

    // Only owner or admin can delete
    if (crawler.owner?.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to delete this crawler" });
    }

    await CrawlerPlugin.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getStandardSpec(crawler) {
  if (crawler.crawlerKind === "generated_code") return null;
  if (crawler.crawlerSpec && Object.keys(crawler.crawlerSpec).length) return crawler.crawlerSpec;
  try {
    const parsed = JSON.parse(crawler.parserCode || "{}");
    if (parsed?.mode === "standard" && parsed.query && Array.isArray(parsed.sources)) return parsed;
  } catch {}
  return null;
}

export default router;
