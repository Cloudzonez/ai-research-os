// ─── Shared enums used across all domain types ───

/** Visibility scope for papers, artifacts, crawlers, and projects. */
export type SharingScope = "private" | "project" | "school" | "university";

/** User roles. */
export type UserRole = "teacher" | "admin";

/** Supported UI languages. */
export type Locale = "zh" | "en";

/** Paper processing pipeline status. */
export type PaperStatus = "parsing" | "parsed" | "summarized" | "error";

/** Tracker crawl execution state. */
export type CrawlStatus =
  | "idle"
  | "running"
  | "completed"
  | "partial"
  | "failed";

/** Tracker execution cadence. */
export type Cadence = "Daily" | "Weekly" | "Monthly";

/** Paper item type discriminator. */
export type ItemType = "paper" | "repository";

/** AI model routing categories. */
export type TaskCategory =
  | "chat"
  | "code"
  | "crawler"
  | "summary"
  | "analysis";

/** Approval status for high-risk operations. */
export type ApprovalStatus = "pending" | "approved" | "rejected";

/** Job queue status. */
export type JobStatus = "queued" | "running" | "completed" | "failed";

/** MCP tool transport type. */
export type ToolTransport = "stdio" | "http" | "websocket";

/** AI command routing classification. */
export type CommandRoute =
  | "answer"
  | "workflow"
  | "tool_call"
  | "interactive_block"
  | "navigate";
