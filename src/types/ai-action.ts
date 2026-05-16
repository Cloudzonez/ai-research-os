import type { ApprovalStatus, CommandRoute, TaskCategory } from "./shared";

/**
 * Every AI invocation is logged as an AIAction for audit,
 * cost tracking, and quality evaluation.
 */
export interface AIAction {
  _id: string;
  /** The user who triggered this action. */
  userId: string;
  /** The session this action belongs to. */
  sessionId: string;
  /** The user's original request text. */
  request: string;
  /** How the AI router classified the request. */
  route: CommandRoute;
  /** The task category used for model routing. */
  taskCategory: TaskCategory;
  /** Tools called during execution. */
  toolCalls: ToolCallRecord[];
  /** The model used. */
  model: string;
  /** Total tokens consumed (input + output). */
  tokensUsed: number;
  /** Input (prompt + context) tokens. */
  inputTokens: number;
  /** Output (completion) tokens. */
  outputTokens: number;
  /** Estimated cost in USD. */
  estimatedCost: number;
  /** Cache hit status for this request. */
  cacheHit: boolean;
  /** The context bundle used (summary). */
  contextSummary: {
    papers: number;
    tokens: number;
  } | null;
  /** Whether this action required approval. */
  approvalRequired: boolean;
  /** Approval status. */
  approvalStatus: ApprovalStatus;
  /** Who approved/rejected (if applicable). */
  approvedBy: string | null;
  /** The AI's output (summary or full). */
  output: string | null;
  /** Any errors that occurred. */
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A record of a single tool invocation within an AI action. */
export interface ToolCallRecord {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  error: string | null;
  durationMs: number;
  calledAt: string;
}

/** Summary statistics for the governance dashboard. */
export interface AIActionStats {
  totalActions: number;
  totalTokens: number;
  totalCost: number;
  cacheHitRate: number;
  approvalRate: number;
  errorRate: number;
  byModel: Record<string, number>;
  byTask: Record<string, number>;
  period: { start: string; end: string };
}
