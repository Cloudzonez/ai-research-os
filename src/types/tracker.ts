import type { Cadence, CrawlStatus, SharingScope } from "./shared";
import type { PaperCard } from "./paper";

/** A research tracker that monitors a topic across sources on a schedule. */
export interface Tracker {
  _id: string;
  name: string;
  cadence: Cadence;
  /** Number of papers discovered in the last crawl. */
  papers: number;
  /** Active data sources (e.g., ["arxiv", "openalex"]). */
  sources: string[];
  /** Keywords/signals that triggered paper discovery. */
  signals: string[];
  /** Number of subscribers (teachers following this tracker). */
  subscribers: number;
  lastRun: string;
  /** Search keywords. */
  keywords: string[];
  crawlStatus: CrawlStatus;
  /** The query string that was last executed. */
  lastCrawlQuery: string;
  /** Per-source errors from the last crawl. */
  lastCrawlErrors: Array<{ source: string; error: string }>;
  /** Papers discovered in the last crawl (references). */
  lastCrawledPaperIds: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Payload for creating/generating a tracker via AI. */
export interface TrackerGeneratePayload {
  topic: string;
  locale?: string;
  sources?: string[];
  cadence?: Cadence;
}

/** A tracker board rendered as an interactive UI block in the chat. */
export interface TrackerBoard {
  tracker: Tracker;
  papers: PaperCard[];
  /** Rendering layout hint. */
  layout: "paper_list" | "trend_board" | "method_map" | "dataset_map";
  /** Summary of what changed since the last run. */
  delta: string;
  generatedAt: string;
}

/** Tracker execution job payload. */
export interface TrackerCrawlJob {
  trackerId: string;
  triggeredBy: "schedule" | "manual" | "chat";
  userId?: string;
}
