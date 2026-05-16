import Paper from "../models/Paper.js";
import { searchArxiv } from "./ingestion/arxiv.js";
import { searchOpenAlex } from "./ingestion/openalex.js";
import { searchGitHubRepositories } from "./ingestion/github.js";
import { downloadBatchPdfs } from "./pdfDownloader.js";

const SOURCE_ALIASES = {
  arxiv: "arxiv",
  "arXiv": "arxiv",
  openalex: "openalex",
  "OpenAlex": "openalex",
  github: "github",
  "GitHub": "github",
};

const SUPPORTED_SOURCES = ["arxiv", "openalex", "github"];
const DEFAULT_SOURCES = ["arxiv", "openalex"];
const STOP_WORDS = new Set([
  "about", "after", "against", "and", "are", "for", "from", "how", "into",
  "latest", "new", "newest", "of", "on", "paper", "papers", "research",
  "study", "the", "to", "track", "tracker", "with", "in", "use", "using",
]);

export function buildTrackerSpec(topic, options = {}) {
  const { locale = "zh", aiText = "" } = options;
  const parsed = parseTrackerJson(aiText);
  const keywords = normalizeKeywords(parsed?.keywords, topic);
  const sources = normalizeSources(parsed?.sources);
  const isZh = locale === "zh";

  return {
    name: cleanName(parsed?.name || topic, isZh),
    keywords,
    sources,
    signals: normalizeSignals(parsed?.signals, isZh),
    cadence: parsed?.cadence || "Daily",
  };
}

export async function crawlTrackerSpec(spec, options = {}) {
  const {
    maxResults = 5,
    searchers = defaultSearchers(),
    paperStore = createMongoosePaperStore(),
    locale = "zh",
    aiParser = null,
    aiParserOptions = {},
  } = options;

  const query = buildSearchQuery(spec);
  const crawledPapers = [];
  const sourceResults = [];
  const errors = [];
  const collectedItems = [];

  // ── Phase 1: Fetch from all sources ──────────────────────────────
  for (const source of normalizeSources(spec.sources)) {
    const searcher = searchers[source];
    if (!searcher) {
      errors.push({ source, error: "Source is not supported" });
      continue;
    }

    try {
      const papers = await searcher(query, maxResults);
      sourceResults.push({ source, count: papers.length });

      for (const rawPaper of papers) {
        if (!rawPaper.title) continue;
        collectedItems.push({ raw: { ...rawPaper, source: rawPaper.source || source }, source });
      }
    } catch (err) {
      errors.push({ source, error: err.message || String(err) });
    }
  }

  // ── Phase 2: AI-parse all collected items (or basic normalize) ────
  let parsedItems;
  if (aiParser && collectedItems.length > 0) {
    const rawBatch = collectedItems.map(({ raw }) => raw);
    parsedItems = await aiParser(rawBatch, {
      ...aiParserOptions,
      spec,
    });
  } else if (collectedItems.length > 0) {
    parsedItems = collectedItems.map(({ raw, source }) =>
      normalizePaper(raw, { source, spec, locale })
    );
  } else {
    parsedItems = [];
  }

  // ── Phase 3: Deduplicate and store ───────────────────────────────
  const seen = new Set();

  for (const paper of parsedItems) {
    if (!paper.title) continue;

    const identity = paperIdentity(paper);
    if (seen.has(identity)) continue;
    seen.add(identity);

    const existing = await paperStore.findDuplicate(paper);
    if (existing) {
      crawledPapers.push({ ...toPlainPaper(existing), duplicate: true });
      continue;
    }

    const created = await paperStore.create(paper);
    crawledPapers.push({ ...toPlainPaper(created), duplicate: false });
  }

  // ── Phase 4: Download PDFs for new papers ──────────────────────────
  const pdfDownloadItems = [];
  for (const cp of crawledPapers) {
    if (cp.duplicate) continue;
    if (cp.itemType === "repository") continue;
    const parsed = parsedItems.find(
      (p) =>
        (p.doi && p.doi === cp.doi) ||
        p.title?.toLowerCase() === cp.title?.toLowerCase()
    );
    if (parsed?.pdfUrl) {
      pdfDownloadItems.push({ paper: cp, pdfUrl: parsed.pdfUrl });
    }
  }

  let pdfResults = null;
  if (pdfDownloadItems.length > 0) {
    pdfResults = await downloadBatchPdfs(pdfDownloadItems);
  }

  const newPapers = crawledPapers.filter((paper) => !paper.duplicate);

  return {
    query,
    sources: normalizeSources(spec.sources),
    sourceResults,
    errors,
    papers: crawledPapers,
    newPapers,
    paperCount: crawledPapers.length,
    newPaperCount: newPapers.length,
    pdfResults,
  };
}

export function createMongoosePaperStore(PaperModel = Paper) {
  return {
    async findDuplicate(paper) {
      if (paper.doi) {
        const byDoi = await PaperModel.findOne({ doi: paper.doi });
        if (byDoi) return byDoi;
      }

      if (!paper.title) return null;
      const prefix = escapeRegExp(paper.title.slice(0, 80));
      return PaperModel.findOne({ title: { $regex: new RegExp(`^${prefix}`, "i") } });
    },

    async create(paper) {
      return PaperModel.create(paper);
    },
  };
}

export function buildSearchQuery(spec) {
  const keywords = normalizeKeywords(spec.keywords, spec.name);
  return keywords.slice(0, 4).join(" ");
}

function parseTrackerJson(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function cleanName(name, isZh) {
  const fallback = isZh ? "论文追踪器" : "Paper tracker";
  return String(name || fallback).replace(/\s+/g, " ").trim().slice(0, 60) || fallback;
}

function normalizeKeywords(input, topic) {
  const values = [];
  if (topic) values.push(String(topic));
  if (Array.isArray(input)) values.push(...input);
  else if (typeof input === "string") values.push(...input.split(/[,;，；]/));

  const expanded = values.flatMap((value) => extractTerms(value));
  const seen = new Set();
  const keywords = [];

  for (const term of expanded) {
    const normalized = term.toLowerCase();
    if (!normalized || STOP_WORDS.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    keywords.push(term);
    if (keywords.length >= 8) break;
  }

  return keywords.length ? keywords : [String(topic || "").trim()].filter(Boolean);
}

function extractTerms(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return [];

  const terms = [text];
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}-]{2,}/gu) || [];
  terms.push(...matches);
  return terms;
}

function normalizeSources(input) {
  const rawSources = Array.isArray(input) && input.length ? input : DEFAULT_SOURCES;
  const normalized = rawSources
    .map((source) => SOURCE_ALIASES[String(source).trim()] || String(source).trim().toLowerCase())
    .filter((source) => SUPPORTED_SOURCES.includes(source));
  return [...new Set(normalized)].length ? [...new Set(normalized)] : DEFAULT_SOURCES;
}

function normalizeSignals(input, isZh) {
  if (Array.isArray(input) && input.length) return input.map(String).filter(Boolean).slice(0, 6);
  return isZh ? ["新论文", "高相关", "开放来源"] : ["New papers", "High relevance", "Open sources"];
}

function normalizePaper(rawPaper, context) {
  const { source, spec, locale } = context;
  const itemType = rawPaper.itemType || (source === "github" ? "repository" : "paper");
  const sourceLabel = {
    arxiv: "arXiv",
    openalex: "OpenAlex",
    github: "GitHub",
  }[source] || source;
  return {
    title: cleanText(rawPaper.title),
    authors: Array.isArray(rawPaper.authors) ? rawPaper.authors.filter(Boolean) : [],
    abstract: cleanText(rawPaper.abstract || rawPaper.summary),
    doi: cleanDoi(rawPaper.doi),
    year: Number(rawPaper.year) || new Date().getFullYear(),
    source,
    url: cleanText(rawPaper.url),
    itemType,
    stars: Number(rawPaper.stars) || 0,
    forks: Number(rawPaper.forks) || 0,
    language: cleanText(rawPaper.language),
    repositoryUpdatedAt: rawPaper.updatedAt ? new Date(rawPaper.updatedAt) : undefined,
    area: spec.name,
    score: scorePaper(rawPaper, source),
    sharing: "school",
    tags: [
      sourceLabel,
      itemType === "repository" ? "repository" : "paper",
      locale === "zh" ? "追踪器抓取" : "Tracker crawl",
      ...spec.keywords.slice(0, 3),
    ].filter(Boolean),
    status: "parsed",
    pdfUrl: cleanText(rawPaper.pdfUrl) || null,
  };
}

function scorePaper(paper, source) {
  if (source === "github") {
    const stars = Number(paper.stars) || 0;
    if (stars > 1000) return 90;
    if (stars > 100) return 80;
    return 70;
  }
  if (source === "openalex" && Number(paper.citedByCount) > 10) return 85;
  return 75;
}

function paperIdentity(paper) {
  if (paper.doi) return `doi:${paper.doi.toLowerCase()}`;
  return `title:${paper.title.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function toPlainPaper(paper) {
  const plain = typeof paper.toObject === "function" ? paper.toObject() : paper;
  return {
    _id: plain._id,
    title: plain.title,
    authors: plain.authors || [],
    abstract: plain.abstract || "",
    doi: plain.doi || "",
    year: plain.year,
    source: plain.source,
    url: plain.url || "",
    itemType: plain.itemType || ((plain.tags || []).includes("repository") ? "repository" : "paper"),
    stars: plain.stars || 0,
    forks: plain.forks || 0,
    language: plain.language || "",
    repositoryUpdatedAt: plain.repositoryUpdatedAt,
    score: plain.score,
    tags: plain.tags || [],
    summary: plain.summary || "",
    pdfPath: plain.pdfPath || "",
    status: plain.status || "parsed",
  };
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanDoi(value) {
  return String(value || "").replace(/^https?:\/\/doi\.org\//i, "").trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function defaultSearchers() {
  return {
    arxiv: searchArxiv,
    openalex: searchOpenAlex,
    github: searchGitHubRepositories,
  };
}
