import type { PaperCard, EvidenceCard } from "./paper";

// ─── Tier types ───────────────────────────────────────────────────

/** Context pyramid tier — higher tiers include all fields from lower tiers. */
export type ContextTier = 0 | 1 | 2 | 3 | 4;

/** A chunk of full paper text, scored by relevance to the query. */
export interface TextChunk {
  index: number;
  text: string;
  score: number;
}

/** Configuration for a single context tier. */
export interface TierConfig {
  label: string;
  fields: string[];
  tokensPerPaper: number;
  description: string;
  maxChunks?: number;
  chunkSize?: number;
}

// ─── Context bundle ───────────────────────────────────────────────

/**
 * A task-scoped context bundle built before every AI model call.
 * Contains permitted papers, notes, and artifacts relevant to the user's query.
 */
export interface ContextBundle {
  /** Estimated token count of the context. */
  tokens: number;
  /** Number of artifacts (papers, notes, etc.) included. */
  artifacts: number;
  /** Percentage of artifacts the user is allowed to access (always 100 for now). */
  allowedPercent: number;
  /** Ranked list of paper cards included in the context. */
  papers: PaperCard[];
  /** The query that built this context. */
  query: string;
  /** ISO timestamp of when the context was built. */
  builtAt: string;
  /** Source identifier ("context_engine"). */
  source: string;
  /** Active context tier (0-4). */
  tier: ContextTier;
  /** Human-readable tier label. */
  tierLabel: string;
  /** Per-paper token budget derived from tier config and max budget. */
  perPaperBudget?: number;
  /** If escalation occurred, the tier this bundle started from. */
  escalatedFrom?: ContextTier;
}

/** Options for building a context bundle. */
export interface ContextOptions {
  userId?: string;
  schoolId?: string;
  locale?: string;
  /** Maximum number of papers to include. */
  maxPapers?: number;
  /** Specific paper ID to fetch (bypasses search). */
  paperId?: string;
  /** Explicit tier override. null = auto-select based on query. */
  tier?: ContextTier | null;
  /** Override Paper model for testing. */
  PaperModel?: unknown;
  /** Override chat function for testing. */
  chatFn?: unknown;
  /** Override tier config for testing. */
  contextTiers?: unknown;
  /** Override text chunker for testing. */
  textChunker?: unknown;
  /** Override tier selector function for testing. */
  tierSelector?: unknown;
}

// ─── Token budget types ───────────────────────────────────────────

/** Token budget check result. */
export interface BudgetCheck {
  allowed: boolean;
  remaining: number;
  quota: number;
  used: number;
  requiresApproval: boolean;
  estimatedTokens: number;
  error?: string;
}

/** Token usage record written after an AI call. */
export interface UsageRecord {
  userId: string;
  tokensUsed: number;
  action: string;
  recordedAt: string;
}

/** Token usage statistics for a user or across all users. */
export interface UsageStats {
  quota: number;
  used: number;
  remaining: number;
  percentUsed: number;
  userCount?: number;
}

/** AI model selection based on task type and budget. */
export interface ModelSelection {
  model: string;
  baseUrl: string;
  estimatedCost: number;
  cacheAvailable: boolean;
  reason: "cache_hit" | "task_route" | "cost_optimize" | "default";
}
