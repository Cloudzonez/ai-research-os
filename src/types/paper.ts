import type { SharingScope, PaperStatus, ItemType } from "./shared";

/** A research paper stored in the platform. */
export interface Paper {
  _id: string;
  title: string;
  /** Source identifier: "arxiv", "openalex", "semantic_scholar", "crossref", "pubmed", "manual", "PDF" */
  source: string;
  /** Research area or topic label. */
  area: string;
  /** Relevance / quality score (0-100). */
  score: number;
  sharing: SharingScope;
  tags: string[];
  doi: string | null;
  abstract: string | null;
  authors: string[];
  year: number | null;
  url: string | null;
  itemType: ItemType;
  /** GitHub stars (for repository-type items). */
  stars: number;
  /** GitHub forks (for repository-type items). */
  forks: number;
  /** Repository primary language. */
  language: string | null;
  /** When the repository was last updated. */
  repositoryUpdatedAt: string | null;
  /** Path to stored PDF file. */
  pdfPath: string | null;
  /** AI-generated summary. */
  summary: string | null;
  /** AI-extracted contributions. */
  contributions: string | null;
  /** AI-extracted methods. */
  methods: string | null;
  /** AI-extracted limitations. */
  limitations: string | null;
  status: PaperStatus;
  /** Extracted full text (first 50K chars). */
  text: string;
  /** AI triage fields — populated after high-volume crawls. */
  triageRelevance: number | null;
  triageCategory: TriageCategory | null;
  triageNovelty: TriageNovelty | null;
  triageReasoning: string | null;
  triagedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** AI triage category for a crawled paper. */
export type TriageCategory = "method" | "application" | "theory" | "survey" | "dataset" | "tool" | "unrelated";

/** AI triage novelty assessment. */
export type TriageNovelty = "breakthrough" | "interesting" | "incremental" | "unknown";

/** Summary stats returned after AI triage completes. */
export interface TriageSummary {
  totalCrawled: number;
  triaged: number;
  relevant: number;
  breakthroughs: number;
  byCategory: Record<string, number>;
}

/** Lightweight paper view returned in context bundles and lists. */
export interface PaperCard {
  title: string;
  source: string;
  area: string;
  score: number;
  sharing: SharingScope;
  tags: string[];
  doi: string;
  summary: string;
  id: string;
  /** Relevance score assigned by context engine (0-100). */
  relevance: number;
  createdAt?: string;
  authors?: string[];
  year?: number | null;
  /** Tier 1+: full abstract text. */
  abstract?: string;
  /** Tier 2+: AI-extracted contributions. */
  contributions?: string;
  /** Tier 2+: AI-extracted methods. */
  methods?: string;
  /** Tier 2+: AI-extracted limitations. */
  limitations?: string;
  /** Tier 3+: extracted evidence cards. */
  evidenceCards?: EvidenceCard[];
  /** Tier 4+: query-relevant chunks from full text. */
  textChunks?: Array<{ index: number; text: string; score: number }>;
  /** Number of text chunks included (Tier 4). */
  textChunkCount?: number;
  /** Estimated token count for this paper card at the current tier. */
  _estimatedTokens?: number;
}

/** Payload for ingesting papers from external sources. */
export interface IngestPayload {
  query: string;
  sources: string[];
  maxResults?: number;
  locale?: string;
}

/** Response from paper ingestion. */
export interface IngestResponse {
  papers: Paper[];
  count: number;
  sources: string[];
}

/** Structured AI analysis of a paper. */
export interface PaperAnalysis {
  paperId: string;
  summary: string;
  contributions: string;
  methods: string;
  limitations: string;
  /** Extracted dataset names mentioned in the paper. */
  datasets: string[];
  /** Key claims suitable for evidence cards. */
  evidenceCards: EvidenceCard[];
  /** Model used for the analysis. */
  model: string;
  tokensUsed: number;
  analyzedAt: string;
}

/** A citable claim extracted from a paper. */
export interface EvidenceCard {
  claim: string;
  /** Location in the paper text (approximate). */
  sourceSection: string;
  /** Paper the claim comes from. */
  paperId: string;
  paperTitle: string;
  /** Confidence score (0-1). */
  confidence: number;
}

/** Payload for uploading PDF files. */
export interface PdfUploadPayload {
  files?: Array<{ name: string; data: string }>;
  filenames?: string[];
  locale?: string;
}
