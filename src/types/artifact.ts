import type { SharingScope } from "./shared";

/**
 * A ResearchArtifact is any reusable piece of research knowledge:
 * notes, summaries, chat insights, claims, methods, datasets, boards,
 * prompts, workflows, or draft fragments.
 */
export interface ResearchArtifact {
  _id: string;
  /** What kind of artifact. */
  kind: ResearchArtifactKind;
  /** Short label for display in lists and context. */
  title: string;
  /** The artifact content (text, JSON, or structured data). */
  content: string;
  /** Papers this artifact references. */
  paperIds: string[];
  /** The user who created this artifact. */
  ownerId: string;
  /** The school scope. */
  schoolId: string | null;
  sharing: SharingScope;
  /** Tags for categorization and retrieval. */
  tags: string[];
  /** Whether this artifact has been reviewed/approved for reuse. */
  reviewed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ResearchArtifactKind =
  | "note"
  | "summary"
  | "chat_insight"
  | "claim"
  | "method"
  | "dataset"
  | "board"
  | "prompt"
  | "workflow"
  | "draft_fragment"
  | "experiment_log"
  | "review_comment";

/** A node in the research memory graph. */
export interface MemoryNode {
  id: string;
  kind: ResearchArtifactKind | "paper" | "user" | "school" | "tracker" | "project";
  label: string;
  /** Additional metadata for rendering. */
  meta: Record<string, unknown>;
}

/** An edge in the research memory graph. */
export interface MemoryEdge {
  from: string;
  to: string;
  relation: string;
  weight: number;
}

/** A subgraph returned for a query. */
export interface MemorySubgraph {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
}
