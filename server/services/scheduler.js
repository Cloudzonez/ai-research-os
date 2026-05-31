import Tracker from "../models/Tracker.js";

const SCHEDULER_INTERVAL = 5 * 60 * 1000;
const CADENCE_MS = {
  Daily: 24 * 60 * 60 * 1000,
  Weekly: 7 * 24 * 60 * 60 * 1000,
  Monthly: 30 * 24 * 60 * 60 * 1000,
};

let schedulerTimer = null;

export function startScheduler(logger) {
  if (schedulerTimer) return;

  logger.info("Scheduler started", { event: "scheduler_start", interval: `${SCHEDULER_INTERVAL / 1000}s` });
  tick(logger);
  schedulerTimer = setInterval(() => tick(logger), SCHEDULER_INTERVAL);
  if (schedulerTimer.unref) schedulerTimer.unref();
}

export function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

async function tick(logger) {
  try {
    const now = new Date();
    const dueTrackers = await Tracker.find({ active: true }).lean();

    for (const tracker of dueTrackers) {
      const intervalMs = CADENCE_MS[tracker.cadence] || CADENCE_MS.Daily;
      const lastRun = tracker.lastRun ? new Date(tracker.lastRun).getTime() : 0;
      const dueTime = lastRun + intervalMs;

      if (now.getTime() >= dueTime && tracker.crawlStatus !== "running") {
        logger.info("Scheduler: tracker due for crawl", {
          event: "scheduler_crawl_due",
          trackerId: String(tracker._id),
          name: tracker.name,
          cadence: tracker.cadence,
          lastRun: tracker.lastRun,
        });

        await Tracker.findByIdAndUpdate(tracker._id, { crawlStatus: "running" });

        try {
          const { crawlTrackerSpec } = await import("./trackerCrawl.js");
          const trackerSpec = {
            name: tracker.name,
            keywords: tracker.keywords,
            sources: tracker.sources,
            signals: tracker.signals,
          };

          const crawl = await crawlTrackerSpec(trackerSpec, {
            locale: "zh",
            maxResults: 50,
          });

          const crawlStatus = crawl.errors.length && crawl.paperCount === 0
            ? "failed"
            : crawl.errors.length ? "partial" : "completed";

          await Tracker.findByIdAndUpdate(tracker._id, {
            papers: crawl.paperCount,
            lastRun: new Date(),
            crawlStatus,
            lastCrawlQuery: crawl.query,
            lastCrawlErrors: crawl.errors.slice(0, 10),
            lastCrawledPaperIds: crawl.papers.map((p) => p._id),
          });

          logger.info("Scheduler: crawl completed", {
            event: "scheduler_crawl_completed",
            trackerId: String(tracker._id),
            name: tracker.name,
            status: crawlStatus,
            papers: crawl.paperCount,
          });
        } catch (err) {
          logger.error("Scheduler: crawl failed", {
            event: "scheduler_crawl_failed",
            trackerId: String(tracker._id),
            name: tracker.name,
            error: err.message,
          });

          await Tracker.findByIdAndUpdate(tracker._id, {
            crawlStatus: "failed",
            lastCrawlErrors: [{ source: "scheduler", error: err.message }],
          });
        }
      }
    }
  } catch (err) {
    logger.error("Scheduler tick error", { event: "scheduler_tick_error", error: err.message });
  }
}
