import type { SharingScope, JobStatus } from "./shared";

/**
 * A teacher-generated or AI-generated crawler plugin for collecting papers
 * from a specific source on a schedule.
 */
export interface CrawlerPlugin {
  _id: string;
  /** Human-readable name. */
  name: string;
  /** Natural language description of what this crawler does. */
  description: string;
  /** Target source identifier or URL pattern. */
  source: string;
  /** The query/search configuration. */
  query: string;
  /** Parsing rules (JSON path, CSS selectors, or regex patterns). */
  parser: ParserConfig;
  /** Cron-style schedule (e.g., "0 9 * * 1" = every Monday at 9am). */
  schedule: string;
  /** Whether the crawler is currently active. */
  active: boolean;
  /** The user who owns this crawler. */
  ownerId: string;
  sharing: SharingScope;
  /** Number of papers this crawler has collected. */
  papersCollected: number;
  /** Last execution timestamp. */
  lastRunAt: string | null;
  /** Last execution status. */
  lastRunStatus: JobStatus | null;
  /** Execution log entries. */
  logs: CrawlerLogEntry[];
  /** Sandbox test results before shared reuse. */
  sandboxResults: SandboxResult[];
  createdAt: string;
  updatedAt: string;
}

/** Configuration for how to parse crawled content. */
export interface ParserConfig {
  /** Type of parser. */
  type: "json_path" | "css_selector" | "regex" | "ai_extract";
  /** Rules that extract paper fields from the crawled page. */
  rules: Record<string, string>;
  /** Sample HTML/JSON for testing the parser. */
  sampleInput?: string;
}

/** A single log entry from a crawler execution. */
export interface CrawlerLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  /** Number of papers found in this run. */
  papersFound?: number;
  /** Duration of the run in ms. */
  durationMs?: number;
}

/** Results from running the crawler in the sandbox. */
export interface SandboxResult {
  runId: string;
  status: "passed" | "failed" | "timeout";
  papersFound: number;
  errors: string[];
  durationMs: number;
  networkCalls: number;
  filesAccessed: string[];
  ranAt: string;
}

/** Payload for generating a crawler plugin via AI. */
export interface CrawlerGeneratePayload {
  description: string;
  sources?: string[];
  locale?: string;
}

/** Sandbox execution request. */
export interface SandboxExecutePayload {
  code: string;
  language: "javascript" | "python" | "r";
  timeoutMs?: number;
  env?: Record<string, string>;
}

/** Sandbox execution result. */
export interface SandboxExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  durationMs: number;
}
