import mongoose from "mongoose";

const paperSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    source: { type: String, default: "manual" },
    sourceIds: {
      doi: { type: String, default: "" },
      openalex: { type: String, default: "" },
      semanticScholar: { type: String, default: "" },
      arxiv: { type: String, default: "" },
      pubmed: { type: String, default: "" },
      crossref: { type: String, default: "" },
    },
    area: { type: String, default: "" },
    score: { type: Number, default: 0 },
    sharing: {
      type: String,
      enum: ["private", "project", "school", "university"],
      default: "school",
    },
    tags: [{ type: String }],
    doi: String,
    abstract: String,
    authors: [String],
    year: Number,
    url: String,
    itemType: {
      type: String,
      enum: ["paper", "repository"],
      default: "paper",
    },
    stars: { type: Number, default: 0 },
    forks: { type: Number, default: 0 },
    language: String,
    repositoryUpdatedAt: Date,
    pdfPath: String,
    summary: String,
    contributions: String,
    methods: String,
    limitations: String,
    status: {
      type: String,
      enum: ["parsing", "parsed", "summarized", "error", "triage_pending", "triaged"],
      default: "parsing",
    },
    text: { type: String, default: "" },
    evidenceCards: [
      {
        claim: String,
        evidence: String,
        sourceSection: String,
      },
    ],
    // AI triage fields — populated by aiTriage.js after high-volume crawls
    triageRelevance: { type: Number, default: null },
    triageCategory: {
      type: String,
      enum: ["method", "application", "theory", "survey", "dataset", "tool", "unrelated", null],
      default: null,
    },
    triageNovelty: {
      type: String,
      enum: ["breakthrough", "interesting", "incremental", "unknown", null],
      default: null,
    },
    triageReasoning: { type: String, default: null },
    triagedAt: { type: Date, default: null },
    // AI-generated structured summary — absorbed from Daily-arXiv's ai/structure.py
    aiSummary: {
      tldr: { type: String, default: "" },
      motivation: { type: String, default: "" },
      method: { type: String, default: "" },
      result: { type: String, default: "" },
      conclusion: { type: String, default: "" },
    },
    // AI-generated HTML page for rich paper display
    htmlPage: { type: String, default: "" },
    htmlGeneratedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paperSchema.index(
  { title: "text", abstract: "text" },
  { default_language: "english", language_override: "_textLang" }
);

export default mongoose.model("Paper", paperSchema);
