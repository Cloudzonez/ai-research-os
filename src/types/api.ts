import type { Paper, PaperCard } from "./paper";
import type { Tracker, TrackerBoard } from "./tracker";
import type { ContextBundle } from "./context";
import type { CrawlerPlugin } from "./crawler";
import type { UserProfile, LoginResponse } from "./user";
import type { AIAction } from "./ai-action";

// ─── Generic API envelope ───

/** Standard API success response wrapper. */
export interface ApiSuccess<T> {
  data: T;
  /** Optional metadata (pagination, etc.). */
  meta?: Record<string, unknown>;
}

/** Standard API error response. */
export interface ApiError {
  error: string;
  details?: string;
}

// ─── Chat ───

export interface ChatMessage {
  role: "user" | "assistant";
  kind: "general" | "tracker" | "pdf" | "writing" | "crawler" | "context";
  text: string;
  blocks?: InteractiveBlock[];
  createdAt: string;
}

export type InteractiveBlock =
  | PaperListBlock
  | TrackerBoardBlock
  | DraftBlock
  | ContextSummaryBlock;

export interface PaperListBlock {
  type: "paper_list";
  papers: PaperCard[];
  title: string;
}

export interface TrackerBoardBlock {
  type: "tracker_board";
  board: TrackerBoard;
}

export interface DraftBlock {
  type: "draft";
  content: string;
  citations: string[];
}

export interface ContextSummaryBlock {
  type: "context_summary";
  context: ContextBundle;
}

export interface ChatSubmitPayload {
  text: string;
  locale?: string;
  sessionId?: string;
}

export interface ChatResponse {
  message: ChatMessage;
  sideEffects: {
    tracker?: Tracker;
    draft?: string;
    papers?: Paper[];
    crawler?: CrawlerPlugin;
    context?: ContextBundle;
  };
}

// ─── Health ───

export interface HealthStatus {
  status: "ok" | "degraded" | "offline";
  uptime: number;
  mongo: "connected" | "disconnected";
  version: string;
}

// ─── Governance ───

export interface GovernanceDashboard {
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalPapers: number;
    totalTrackers: number;
    totalCrawlers: number;
  };
  tokenUsage: {
    totalQuota: number;
    totalUsed: number;
    remaining: number;
    percentUsed: number;
  };
  recentActions: AIAction[];
}
