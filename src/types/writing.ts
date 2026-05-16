import type { SharingScope } from "./shared";
import type { EvidenceCard } from "./paper";

/** A writing project (paper, grant, report, patent, etc.). */
export interface WritingProject {
  _id: string;
  /** Project title. */
  title: string;
  /** Type of writing project. */
  type: WritingProjectType;
  /** The research topic or question. */
  topic: string;
  /** Target journal, conference, or funding body. */
  target: string;
  /** Selected papers used as references. */
  selectedPaperIds: string[];
  /** The document outline (sections). */
  outline: OutlineSection[];
  /** Draft sections keyed by section ID. */
  drafts: Record<string, DraftSection>;
  /** Revision history. */
  revisions: Revision[];
  /** Citation style (GB/T 7714, APA, MLA, IEEE, Chicago). */
  citationStyle: CitationStyle;
  sharing: SharingScope;
  ownerId: string;
  status: WritingStatus;
  createdAt: string;
  updatedAt: string;
}

export type WritingProjectType =
  | "paper"
  | "grant"
  | "proposal"
  | "report"
  | "patent"
  | "thesis";

export type CitationStyle =
  | "gbt7714"
  | "apa"
  | "mla"
  | "ieee"
  | "chicago";

export type WritingStatus =
  | "drafting"
  | "in_review"
  | "submitted"
  | "published";

/** A section in the writing outline. */
export interface OutlineSection {
  id: string;
  title: string;
  /** Expected content description. */
  guidance: string;
  /** Ordered child section IDs. */
  children: string[];
}

/** A draft of a single section. */
export interface DraftSection {
  sectionId: string;
  content: string;
  /** Evidence cards cited in this section. */
  evidenceIds: string[];
  /** Data/chart references in this section. */
  dataRefs: string[];
  /** Whether the content was AI-generated. */
  aiGenerated: boolean;
  lastEditedBy: string;
  lastEditedAt: string;
}

/** A revision entry. */
export interface Revision {
  id: string;
  sectionId: string;
  previousContent: string;
  newContent: string;
  /** What changed: "ai_generated", "ai_rewrite", "manual_edit". */
  changeType: "ai_generated" | "ai_rewrite" | "manual_edit";
  changedBy: string;
  changedAt: string;
  /** AI model used (if AI-generated). */
  model?: string;
}

/** Payload for generating a writing draft via AI. */
export interface DraftGeneratePayload {
  locale?: string;
  topic?: string;
  projectId?: string;
  sectionId?: string;
  selectedPaperIds?: string[];
}

/** Consistency check result for a draft section. */
export interface ConsistencyCheck {
  sectionId: string;
  issues: ConsistencyIssue[];
  overallScore: number;
}

export interface ConsistencyIssue {
  type: "overclaim" | "insufficient_citation" | "data_mismatch" | "contradiction" | "ai_artifact";
  severity: "high" | "medium" | "low";
  message: string;
  /** The problematic text span. */
  excerpt: string;
}
