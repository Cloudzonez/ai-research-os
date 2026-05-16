import { chat, parseResponse } from "./deepseek.js";
import Paper from "../models/Paper.js";
import { searchArxiv } from "./ingestion/arxiv.js";
import { searchOpenAlex } from "./ingestion/openalex.js";
import { searchSemanticScholar } from "./ingestion/semanticScholar.js";
import { searchGitHubRepositories } from "./ingestion/github.js";
import { downloadBatchPdfs } from "./pdfDownloader.js";

const SUPPORTED_SOURCES = ["arxiv", "openalex", "semantic_scholar", "github"];
const SOURCE_ALIASES = {
  arxiv: "arxiv",
  "arXiv": "arxiv",
  openalex: "openalex",
  "OpenAlex": "openalex",
  semanticscholar: "semantic_scholar",
  semantic_scholar: "semantic_scholar",
  "Semantic Scholar": "semantic_scholar",
  github: "github",
  "GitHub": "github",
};

const DEFAULT_ACADEMIC_SOURCES = ["arxiv", "openalex", "semantic_scholar"];
const STOP_WORDS = new Set([
  "about", "against", "and", "crawler", "for", "from", "github", "latest", "new",
  "openalex", "papers", "repositories", "repository", "research", "search", "semantic",
  "scholar", "source", "the", "to", "track", "use", "using", "with", "爬虫", "论文",
]);

export async function suggestStandardCrawlerSpec(description, options = {}) {
  const { locale = "zh", sources } = options;
  let aiText = "";

  try {
    const result = await chat(
      [{
        role: "user",
        content: `Suggest a crawler configuration for this request: "${description}". Return ONLY JSON: {"name":"short name","query":"search query","sources":["arxiv","openalex","semantic_scholar","github"],"keywords":["..."],"maxResults":10}. Use only supported sources that match the request.`,
      }],
      locale,
      { temperature: 0.2, maxTokens: 500 }
    );
    aiText = parseResponse(result.content).text;
  } catch {
    aiText = "";
  }

  return buildStandardCrawlerSpec(description, { ...options, sources, aiText });
}

export function buildStandardCrawlerSpec(description, options = {}) {
  const parsed = parseJsonObject(options.aiText);
  const keywords = normalizeKeywords(parsed?.keywords, parsed?.query || description);
  const inferredSources = normalizeSources(options.sources || parsed?.sources || inferSources(description));
  const query = cleanText(parsed?.query || keywords.slice(0, 5).join(" ") || description);

  return {
    version: 1,
    mode: "standard",
    name: cleanText(parsed?.name || description).slice(0, 80) || "Standard crawler",
    query,
    keywords,
    sources: inferredSources,
    maxResults: clampNumber(options.maxResults ?? parsed?.maxResults ?? 10, 1, 25),
    filters: normalizeFilters(parsed?.filters),
  };
}

export async function runStandardCrawler(spec, options = {}) {
  const normalized = buildStandardCrawlerSpec(spec.query || spec.name || "", {
    ...spec,
    aiText: JSON.stringify(spec),
  });
  const connectors = options.connectors || defaultConnectors();
  const paperStore = options.paperStore || createMongoosePaperStore();
  const aiParser = options.aiParser || null;
  const aiParserOptions = options.aiParserOptions || {};
  const sourceResults = [];
  const errors = [];
  const collectedItems = [];

  // ── Phase 1: Fetch from all sources ──────────────────────────────
  for (const source of normalized.sources) {
    const connector = connectors[source];
    if (!connector) {
      errors.push({ source, error: "Unsupported source" });
      continue;
    }

    try {
      const rawItems = await connector(normalized.query, normalized.maxResults, {
        filters: normalized.filters,
        timeoutMs: options.timeoutMs || 8000,
        retries: options.retries ?? 1,
        retryDelay: options.retryDelay || 1000,
      });
      let acceptedCount = 0;
      let rejectedCount = 0;

      for (const raw of rawItems) {
        if (!isUsefulRawItem(raw, source)) {
          rejectedCount += 1;
          continue;
        }
        acceptedCount += 1;
        collectedItems.push({ raw: { ...raw, source: raw.source || source }, source });
      }

      sourceResults.push({
        source,
        fetched: rawItems.length,
        accepted: acceptedCount,
        rejected: rejectedCount,
        created: 0,
        duplicates: 0,
      });
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
      spec: normalized,
    });
  } else if (collectedItems.length > 0) {
    parsedItems = collectedItems.map(({ raw, source }) =>
      normalizeCrawledItem(raw, { source, spec: normalized })
    );
  } else {
    parsedItems = [];
  }

  // ── Phase 3: Deduplicate and store ───────────────────────────────
  const seen = new Set();
  const items = [];
  const sourceStats = new Map();

  for (const source of normalized.sources) {
    sourceStats.set(source, { created: 0, duplicates: 0 });
  }

  for (const item of parsedItems) {
    const identity = itemIdentity(item);
    if (seen.has(identity)) continue;
    seen.add(identity);

    const existing = await paperStore.findDuplicate(item);
    const itemSource = item.source || "unknown";
    const stats = sourceStats.get(itemSource) || { created: 0, duplicates: 0 };

    if (existing) {
      stats.duplicates += 1;
      items.push({ ...toResponseItem(existing), duplicate: true });
      continue;
    }

    const created = await paperStore.create(item);
    stats.created += 1;
    items.push({ ...toResponseItem(created), duplicate: false });
  }

  // Merge per-source stats back into sourceResults
  for (const sr of sourceResults) {
    const stats = sourceStats.get(sr.source);
    if (stats) {
      sr.created = stats.created;
      sr.duplicates = stats.duplicates;
    }
  }

  // ── Phase 4: Download PDFs for new papers ──────────────────────────
  const pdfDownloadItems = [];
  for (const item of items) {
    if (item.duplicate) continue;
    if (item.itemType === "repository") continue;
    // Collect pdfUrl from the original parsed item
    const parsed = parsedItems.find(
      (p) => itemIdentity(p) === itemIdentity(item)
    );
    if (parsed?.pdfUrl) {
      pdfDownloadItems.push({ paper: item, pdfUrl: parsed.pdfUrl });
    }
  }

  let pdfResults = null;
  if (pdfDownloadItems.length > 0) {
    pdfResults = await downloadBatchPdfs(pdfDownloadItems);
  }

  const papers = items.filter((item) => item.itemType !== "repository");
  const repositories = items.filter((item) => item.itemType === "repository");

  return {
    spec: normalized,
    query: normalized.query,
    sources: normalized.sources,
    sourceResults,
    errors,
    items,
    papers,
    repositories,
    itemCount: items.length,
    paperCount: papers.length,
    repositoryCount: repositories.length,
    newItemCount: items.filter((item) => !item.duplicate).length,
    pdfResults,
  };
}

export function createMongoosePaperStore(PaperModel = Paper) {
  return {
    async findDuplicate(item) {
      if (item.doi) {
        const byDoi = await PaperModel.findOne({ doi: item.doi });
        if (byDoi) return byDoi;
      }
      const bySourceUrl = item.url
        ? await PaperModel.findOne({ source: item.source, abstract: { $regex: escapeRegExp(item.url), $options: "i" } })
        : null;
      if (bySourceUrl) return bySourceUrl;
      if (!item.title) return null;
      return PaperModel.findOne({ title: item.title });
    },

    async create(item) {
      return PaperModel.create(item);
    },
  };
}

function normalizeCrawledItem(raw, context) {
  const { source, spec } = context;
  const itemType = raw.itemType || (source === "github" ? "repository" : "paper");
  const urlLine = raw.url ? `\nURL: ${raw.url}` : "";
  return {
    title: cleanText(raw.title),
    authors: Array.isArray(raw.authors) ? raw.authors.filter(Boolean) : [],
    abstract: `${cleanText(raw.abstract || raw.summary)}${urlLine}`.trim(),
    doi: cleanDoi(raw.doi),
    year: Number(raw.year) || new Date().getFullYear(),
    source,
    area: spec.name || spec.query,
    score: scoreItem(raw, source),
    sharing: "school",
    tags: [
      sourceLabel(source),
      itemType === "repository" ? "repository" : "paper",
      "standard-crawler",
      ...spec.keywords.slice(0, 3),
    ].filter(Boolean),
    status: "parsed",
    pdfUrl: cleanText(raw.pdfUrl) || null,
    url: cleanText(raw.url) || "",
  };
}

function isUsefulRawItem(raw, source) {
  const title = cleanText(raw?.title);
  if (!title) return false;

  if (source === "github" || raw.itemType === "repository") {
    return Boolean(cleanText(raw.url));
  }

  return Boolean(
    cleanText(raw.abstract || raw.summary)
      || cleanText(raw.pdfUrl)
      || cleanText(raw.url)
      || cleanText(raw.doi)
  );
}

function scoreItem(raw, source) {
  if (source === "github") {
    const stars = Number(raw.stars) || 0;
    if (stars > 1000) return 90;
    if (stars > 100) return 80;
    return 70;
  }
  const citations = Number(raw.citedByCount) || 0;
  if (citations > 100) return 90;
  if (citations > 10) return 82;
  return 75;
}

function inferSources(description) {
  const text = String(description || "").toLowerCase();
  const sources = [];
  if (/github|repo|repository|code|开源|代码/.test(text)) sources.push("github");
  if (/paper|论文|academic|arxiv|openalex|semantic|scholar|literature|文献/.test(text)) {
    sources.push(...DEFAULT_ACADEMIC_SOURCES);
  }
  return sources.length ? sources : DEFAULT_ACADEMIC_SOURCES;
}

function normalizeSources(input) {
  const values = Array.isArray(input) ? input : String(input || "").split(/[,，;；\s]+/);
  const normalized = values
    .map((source) => SOURCE_ALIASES[String(source).trim()] || String(source).trim().toLowerCase())
    .filter((source) => SUPPORTED_SOURCES.includes(source));
  return [...new Set(normalized)].length ? [...new Set(normalized)] : DEFAULT_ACADEMIC_SOURCES;
}

function normalizeKeywords(input, fallback) {
  const values = [];
  if (Array.isArray(input)) values.push(...input);
  else if (input) values.push(...String(input).split(/[,，;；]/));
  if (fallback) values.push(String(fallback));

  const terms = values.flatMap((value) => String(value).match(/[\p{L}\p{N}][\p{L}\p{N}-]{2,}/gu) || []);
  const seen = new Set();
  const keywords = [];
  for (const term of terms) {
    const normalized = term.toLowerCase();
    if (STOP_WORDS.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    keywords.push(term);
    if (keywords.length >= 10) break;
  }
  return keywords;
}

function normalizeFilters(filters) {
  return filters && typeof filters === "object" && !Array.isArray(filters) ? filters : {};
}

function parseJsonObject(text) {
  if (!text) return null;
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function toResponseItem(item) {
  const plain = typeof item.toObject === "function" ? item.toObject() : item;
  const itemType = (plain.tags || []).includes("repository") ? "repository" : "paper";
  return {
    _id: plain._id,
    title: plain.title,
    authors: plain.authors || [],
    abstract: plain.abstract || "",
    doi: plain.doi || "",
    year: plain.year,
    source: plain.source,
    score: plain.score,
    tags: plain.tags || [],
    itemType,
  };
}

function itemIdentity(item) {
  if (item.doi) return `doi:${item.doi.toLowerCase()}`;
  return `${item.source}:${item.title.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function defaultConnectors() {
  return {
    arxiv: searchArxiv,
    openalex: searchOpenAlex,
    semantic_scholar: searchSemanticScholar,
    github: searchGitHubRepositories,
  };
}

function sourceLabel(source) {
  return {
    arxiv: "arXiv",
    openalex: "OpenAlex",
    semantic_scholar: "Semantic Scholar",
    github: "GitHub",
  }[source] || source;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanDoi(value) {
  return String(value || "").replace(/^https?:\/\/doi\.org\//i, "").trim();
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default { buildStandardCrawlerSpec, suggestStandardCrawlerSpec, runStandardCrawler };
