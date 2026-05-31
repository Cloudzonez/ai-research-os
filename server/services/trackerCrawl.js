import Paper from "../models/Paper.js";
import { crawlArxiv, resolveArxivPdfFromDoi } from "./ingestion/arxiv.js";
import { searchOpenAlex } from "./ingestion/openalex.js";
import { searchSemanticScholar } from "./ingestion/semanticScholar.js";
import { searchGitHubRepositories } from "./ingestion/github.js";
import { downloadBatchPdfs } from "./pdfDownloader.js";
import { enqueue } from "./queue.js";
import { getSearchService } from "./paperSearch/index.js";
import { createTrackerDebugLog, setActiveDebugLog } from "./trackerDebugLog.js";

const SOURCE_ALIASES = {
  arxiv: "arxiv",
  "arXiv": "arxiv",
  openalex: "openalex",
  "OpenAlex": "openalex",
  "open alex": "openalex",
  semantic_scholar: "semantic_scholar",
  "semantic scholar": "semantic_scholar",
  "Semantic Scholar": "semantic_scholar",
  semanticScholar: "semantic_scholar",
  s2: "semantic_scholar",
  crossref: "crossref",
  Crossref: "crossref",
  pubmed: "pubmed",
  PubMed: "pubmed",
  github: "github",
  "GitHub": "github",
};

const SUPPORTED_SOURCES = ["arxiv", "openalex", "semantic_scholar", "crossref", "pubmed", "github"];
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
  const sources = normalizeSources(parsed?.sources, keywords);
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
  const debugLog = options.debugLog || createTrackerDebugLog();
  setActiveDebugLog(debugLog);
  const context = createCrawlContext(spec, { ...options, debugLog });
  const { logger, normalizedSpec, query, sources, maxResults, locale, aiParser } = context;

  debugLog.section(`Tracker Crawl Start: "${normalizedSpec.name}"`);
  debugLog.info("crawl_start", {
    trackerName: normalizedSpec.name,
    query,
    keywords: normalizedSpec.keywords,
    sources,
    maxResults,
    locale,
    hasAiParser: Boolean(aiParser),
    runId: debugLog.runId,
  });

  const sourceData = await fetchTrackerSources(context);
  const parsedItems = await parseCollectedItems(sourceData.collectedItems, context);
  const crawledPapers = await storeParsedItems(parsedItems, context);
  const pdfResults = await downloadCrawledPdfs(crawledPapers, parsedItems, context);

  const result = buildCrawlResult({
    sourceResults: sourceData.sourceResults,
    errors: sourceData.errors,
    crawledPapers,
    pdfResults,
  }, context);

  debugLog.info("crawl_complete_summary", {
    sourcesChecked: sources.length,
    sourcesWithErrors: sourceData.errors.length,
    itemsCollected: sourceData.collectedItems.length,
    itemsParsed: parsedItems.length,
    papersReturned: crawledPapers.length,
    newPapers: crawledPapers.filter((p) => !p.duplicate).length,
    pdfCandidates: pdfResults?.downloaded || 0,
    pdfErrors: pdfResults?.failed || 0,
  });
  debugLog.info("log_file", { path: debugLog.logFile });

  return result;
}

function createCrawlContext(spec, options) {
  const {
    maxResults = 50,
    paperStore = createMongoosePaperStore(),
    locale = "zh",
    aiParser = null,
    aiParserOptions = {},
    pdfDownloader = downloadBatchPdfs,
    debugLog,
  } = options;

  const searchers = options.searchers || defaultSearchers(options.searchService, debugLog);
  const logger = createCrawlLogger(options.logger ?? (!options.paperStore ? console : null));
  const queueSummaries = options.queueSummaries ?? !options.paperStore;
  const enqueueSummarization = options.enqueueSummarization || enqueue;
  const keywords = Array.isArray(spec.keywords) && spec.keywords.length
    ? spec.keywords.map(String).filter(Boolean)
    : normalizeKeywords(spec.keywords, spec.name);
  const sources = normalizeSources(spec.sources, keywords);
  const normalizedSpec = {
    ...spec,
    keywords,
    sources,
  };
  const query = buildSearchQuery(normalizedSpec);

  // Log source adjustments
  if (debugLog && hasChineseQuery(keywords) && spec.sources?.includes("arxiv")) {
    debugLog.warn("arxiv_skipped_cjk", { message: "arXiv removed from sources — does not support Chinese queries", originalSources: spec.sources, adjustedSources: sources });
  }
  const stats = {
    collected: 0,
    parsed: 0,
    skippedMissingTitle: 0,
    duplicateInRun: 0,
    duplicateExisting: 0,
    created: 0,
    queuedSummaries: 0,
    queueErrors: 0,
    pdfCandidates: 0,
  };

  return {
    maxResults,
    searchers,
    paperStore,
    locale,
    aiParser,
    aiParserOptions,
    pdfDownloader,
    logger,
    queueSummaries,
    enqueueSummarization,
    sources,
    normalizedSpec,
    query,
    stats,
    debugLog,
  };
}

async function fetchTrackerSources(context) {
  const { sources, searchers, query, maxResults, logger, stats, debugLog } = context;
  const sourceResults = [];
  const errors = [];
  const collectedItems = [];

  debugLog.begin(`fetchTrackerSources — query="${query}", maxResults=${maxResults}, sources=[${sources.join(", ")}]`);

  for (const source of sources) {
    const searcher = searchers[source];
    if (!searcher) {
      errors.push({ source, error: "Source is not supported" });
      logger.warn("source_unsupported", { source });
      debugLog.warn(`source_unsupported: "${source}" not in searcher registry`, { availableSearchers: Object.keys(searchers) });
      continue;
    }

    const t0 = Date.now();
    try {
      logger.info("source_fetch_start", { source, query, maxResults });
      debugLog.begin(`source="${source}" — calling searcher`);
      const rawResults = await searcher(query, maxResults);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      const papers = Array.isArray(rawResults) ? rawResults : [];

      if (!Array.isArray(rawResults)) {
        logger.warn("source_result_invalid", { source, resultType: typeof rawResults });
        debugLog.warn(`source="${source}" returned non-array: ${typeof rawResults}`);
      }

      sourceResults.push({ source, count: papers.length });
      logger.info("source_fetch_complete", { source, count: papers.length });
      debugLog.end(`source="${source}" DONE`, { resultCount: papers.length, elapsedSec: elapsed });

      for (const rawPaper of papers) {
        if (!rawPaper.title) {
          stats.skippedMissingTitle += 1;
          debugLog.detail(`skipped item (no title) from "${source}"`, { rawKeys: Object.keys(rawPaper).join(", ") });
          continue;
        }
        collectedItems.push(toCollectedItem(rawPaper, source));
      }
    } catch (err) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      const error = errorMessage(err);
      errors.push({ source, error });
      logger.warn("source_fetch_failed", { source, error });
      debugLog.end(`source="${source}" ERROR`, { error, elapsedSec: elapsed });
    }
  }

  stats.collected = collectedItems.length;
  logger.info("source_collection_complete", {
    collected: stats.collected,
    skippedMissingTitle: stats.skippedMissingTitle,
    errors: errors.length,
  });
  debugLog.end("fetchTrackerSources complete", {
    collected: stats.collected,
    skippedMissingTitle: stats.skippedMissingTitle,
    sourceErrors: errors.length,
  });

  return { sourceResults, errors, collectedItems };
}

async function parseCollectedItems(collectedItems, context) {
  const { aiParser, aiParserOptions, normalizedSpec, locale, logger, stats, debugLog } = context;

  if (aiParser && collectedItems.length > 0) {
    const rawBatch = collectedItems.map(({ raw }) => raw);
    debugLog.begin(`parseCollectedItems — AI parser mode, batch=${rawBatch.length}`);
    logger.info("parse_start", { mode: "ai", count: rawBatch.length });
    const t0 = Date.now();
    const parsed = await aiParser(rawBatch, {
      ...aiParserOptions,
      spec: normalizedSpec,
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    const parsedItems = Array.isArray(parsed) ? parsed : [];
    if (!Array.isArray(parsed)) {
      logger.warn("parse_result_invalid", { resultType: typeof parsed });
    }
    stats.parsed = parsedItems.length;
    logger.info("parse_complete", { count: stats.parsed });
    debugLog.end(`AI parse done`, { input: rawBatch.length, output: parsedItems.length, elapsedSec: elapsed });
    return parsedItems;
  }

  if (collectedItems.length > 0) {
    debugLog.begin(`parseCollectedItems — normalize mode, items=${collectedItems.length}`);
    logger.info("parse_start", { mode: "normalize", count: collectedItems.length });
    const parsedItems = collectedItems.map(({ raw, source }) =>
      normalizePaper(raw, { source, spec: normalizedSpec, locale })
    );
    stats.parsed = parsedItems.length;
    logger.info("parse_complete", { count: stats.parsed });
    debugLog.end("normalize done", { count: stats.parsed });
    return parsedItems;
  }

  const parsedItems = [];
  stats.parsed = parsedItems.length;
  logger.info("parse_complete", { count: stats.parsed });
  debugLog.warn("parseCollectedItems: no items to parse");
  return parsedItems;
}

async function storeParsedItems(parsedItems, context) {
  const { paperStore, queueSummaries, enqueueSummarization, logger, stats, debugLog } = context;
  const crawledPapers = [];
  const seen = new Set();

  debugLog.begin(`storeParsedItems — ${parsedItems.length} items to process`);

  for (const paper of parsedItems) {
    if (!paper.title) {
      stats.skippedMissingTitle += 1;
      debugLog.detail("skipped (no title)", { source: paper.source });
      continue;
    }

    const identity = paperIdentity(paper);
    if (seen.has(identity)) {
      stats.duplicateInRun += 1;
      debugLog.detail(`duplicate in this run: ${identity}`);
      continue;
    }
    seen.add(identity);

    const existing = await paperStore.findDuplicate(paper);
    if (existing) {
      stats.duplicateExisting += 1;
      const existingId = existing._id?.toString() || "?";
      debugLog.detail(`duplicate (already in DB): ${identity} → existing doc ${existingId}`, {
        existingTitle: existing.title?.slice(0, 60),
        existingSource: existing.source,
        incomingSource: paper.source,
      });
      crawledPapers.push({ ...toPlainPaper(existing), duplicate: true });
      continue;
    }

    const created = await paperStore.create(paper);
    stats.created += 1;
    const newId = created._id?.toString() || "?";
    debugLog.detail(`CREATED new paper: ${identity} → doc ${newId}`, {
      title: paper.title?.slice(0, 80),
      source: paper.source,
      hasAbstract: Boolean(paper.abstract),
      hasDoi: Boolean(paper.doi),
      hasPdfUrl: Boolean(paper.pdfUrl),
    });
    crawledPapers.push({ ...toPlainPaper(created), duplicate: false });

    await maybeEnqueueSummary(created, {
      queueSummaries,
      enqueueSummarization,
      logger,
      stats,
      debugLog,
    });
  }

  logger.info("store_complete", {
    papers: crawledPapers.length,
    created: stats.created,
    duplicateInRun: stats.duplicateInRun,
    duplicateExisting: stats.duplicateExisting,
    queuedSummaries: stats.queuedSummaries,
    queueErrors: stats.queueErrors,
  });
  debugLog.end("storeParsedItems complete", {
    created: stats.created,
    duplicateInRun: stats.duplicateInRun,
    duplicateExisting: stats.duplicateExisting,
    queuedSummaries: stats.queuedSummaries,
    queueErrors: stats.queueErrors,
  });

  return crawledPapers;
}

async function maybeEnqueueSummary(created, context) {
  const { queueSummaries, enqueueSummarization, logger, stats, debugLog } = context;
  if (!queueSummaries || !created._id || created.itemType === "repository") return;

  try {
    await enqueueSummarization("summarize_paper", { paperId: created._id.toString() }, {});
    stats.queuedSummaries += 1;
  } catch (err) {
    stats.queueErrors += 1;
    logger.warn("summary_enqueue_failed", {
      paperId: created._id.toString(),
      error: errorMessage(err),
    });
    if (debugLog) debugLog.warn("summary_enqueue_failed", { paperId: created._id.toString(), error: errorMessage(err) });
  }
}

async function downloadCrawledPdfs(crawledPapers, parsedItems, context) {
  const { pdfDownloader, logger, stats, debugLog } = context;

  // Enrich papers lacking pdfUrl by resolving their DOI against arXiv
  await enrichPdfUrlsViaDoiLookup(crawledPapers, parsedItems, context);

  const pdfDownloadItems = collectPdfDownloadItems(crawledPapers, parsedItems);

  let pdfResults = null;
  stats.pdfCandidates = pdfDownloadItems.length;
  if (pdfDownloadItems.length > 0) {
    try {
      debugLog.begin(`PDF download — ${pdfDownloadItems.length} candidates`);
      logger.info("pdf_download_start", { count: pdfDownloadItems.length });
      pdfResults = await pdfDownloader(pdfDownloadItems);
      logger.info("pdf_download_complete", {
        downloaded: pdfResults?.downloaded || 0,
        skipped: pdfResults?.skipped || 0,
        failed: pdfResults?.failed || 0,
      });
      debugLog.end("PDF download complete", {
        downloaded: pdfResults?.downloaded || 0,
        skipped: pdfResults?.skipped || 0,
        failed: pdfResults?.failed || 0,
      });
    } catch (err) {
      pdfResults = {
        results: [],
        downloaded: 0,
        skipped: 0,
        failed: pdfDownloadItems.length,
        error: errorMessage(err),
      };
      logger.warn("pdf_download_failed", {
        count: pdfDownloadItems.length,
        error: pdfResults.error,
      });
      debugLog.end("PDF download FAILED", { error: errorMessage(err) });
    }
  } else {
    debugLog.detail("PDF download: no candidates");
  }

  return pdfResults;
}

async function enrichPdfUrlsViaDoiLookup(crawledPapers, parsedItems, context) {
  const { debugLog } = context;

  // Find new papers that have a DOI but no pdfUrl
  const candidates = crawledPapers.filter((p) => !p.duplicate && p.itemType !== "repository" && p.doi && !p.pdfPath);
  if (!candidates.length) return;

  const toEnrich = [];
  for (const paper of candidates) {
    const parsed = findParsedSource(paper, parsedItems);
    if (!parsed?.pdfUrl && paper.doi) {
      toEnrich.push({ paper, parsed, doi: paper.doi });
    }
  }

  if (!toEnrich.length) return;
  if (debugLog) debugLog.begin(`DOI → arXiv lookup — ${toEnrich.length} papers lacking pdfUrl`);

  // Cap lookups to avoid excessive arXiv API calls
  const MAX_LOOKUPS = 10;
  let resolved = 0;
  let skipped = 0;
  for (const { paper, parsed, doi } of toEnrich) {
    if (resolved + skipped >= MAX_LOOKUPS) {
      if (debugLog) debugLog.detail(`DOI lookup limit reached (${MAX_LOOKUPS}), skipping remaining`, { remaining: toEnrich.length - resolved - skipped });
      break;
    }
    try {
      const resolvedPdf = await resolveArxivPdfFromDoi(doi);
      if (resolvedPdf) {
        if (parsed) parsed.pdfUrl = resolvedPdf.pdfUrl;
        resolved += 1;
        if (debugLog) debugLog.detail(`DOI resolved to arXiv PDF`, { doi: doi.slice(0, 40), arxivId: resolvedPdf.arxivId, title: paper.title?.slice(0, 50) });
      } else {
        skipped += 1;
      }
    } catch {
      skipped += 1;
    }
  }

  if (debugLog) debugLog.end(`DOI → arXiv lookup done`, { candidates: toEnrich.length, lookedUp: resolved + skipped, resolved, skipped });
}

function collectPdfDownloadItems(crawledPapers, parsedItems) {
  const items = [];

  for (const crawledPaper of crawledPapers) {
    if (crawledPaper.duplicate) continue;
    if (crawledPaper.itemType === "repository") continue;

    const parsed = findParsedSource(crawledPaper, parsedItems);
    if (parsed?.pdfUrl) {
      items.push({ paper: crawledPaper, pdfUrl: parsed.pdfUrl });
    }
  }

  return items;
}

function findParsedSource(crawledPaper, parsedItems) {
  return parsedItems.find((parsed) =>
    (parsed.doi && parsed.doi === crawledPaper.doi) ||
    parsed.title?.toLowerCase() === crawledPaper.title?.toLowerCase()
  );
}

function buildCrawlResult(resultParts, context) {
  const { sourceResults, errors, crawledPapers, pdfResults } = resultParts;
  const { query, sources, logger, stats } = context;
  const newPapers = crawledPapers.filter((paper) => !paper.duplicate);
  const newPaperIds = newPapers.map((p) => p._id?.toString()).filter(Boolean);

  logger.info("crawl_complete", {
    papers: crawledPapers.length,
    newPapers: newPapers.length,
    errors: errors.length,
    pdfCandidates: stats.pdfCandidates,
  });

  return {
    query,
    sources,
    sourceResults,
    errors,
    papers: crawledPapers,
    newPapers,
    newPaperIds,
    paperCount: crawledPapers.length,
    newPaperCount: newPapers.length,
    pdfResults,
  };
}

function toCollectedItem(rawPaper, source) {
  return {
    raw: { ...rawPaper, source: rawPaper.source || source },
    source,
  };
}

export function createMongoosePaperStore(PaperModel = Paper) {
  function isPreprintDoi(doi) {
    return /arxiv\./i.test(String(doi || "")) || /10\.48550/i.test(String(doi || ""));
  }

  return {
    async findDuplicate(paper) {
      // Pass 1: DOI exact match
      if (paper.doi) {
        const byDoi = await PaperModel.findOne({ doi: paper.doi });
        if (byDoi) return byDoi;
      }

      if (!paper.title) return null;

      // Pass 2: Title prefix + year-compatible merge
      const prefix = escapeRegExp(paper.title.slice(0, 80));
      const candidates = await PaperModel.find({
        title: { $regex: new RegExp(`^${prefix}`, "i") },
      }).lean();

      for (const candidate of candidates) {
        const candidateYear = candidate.year;
        const paperYear = paper.year;

        // Same year → always a match
        if (candidateYear && paperYear && candidateYear === paperYear) return candidate;

        // Adjacent years (±1) → match only if one has a preprint DOI
        if (candidateYear && paperYear && Math.abs(candidateYear - paperYear) <= 1) {
          if (isPreprintDoi(candidate.doi) || isPreprintDoi(paper.doi)) return candidate;
        }

        // One side missing year → match on title alone
        if (!candidateYear || !paperYear) return candidate;
      }

      return null;
    },

    async create(paper) {
      return PaperModel.create(paper);
    },
  };
}

export function buildSearchQuery(spec) {
  const keywords = normalizeKeywords(spec.keywords, null);
  if (keywords.length === 0 && spec.name) {
    keywords.push(...normalizeKeywords(null, spec.name));
  }
  // Prefer multi-word keywords; never let individual word tokens pollute the query
  // when the full phrase already exists
  const multiWord = keywords.filter((k) => k.includes(" ")).slice(0, 4);
  if (multiWord.length >= 2) return multiWord.join(" ");
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

function normalizeSources(input, keywords = []) {
  const rawSources = Array.isArray(input) && input.length ? input : DEFAULT_SOURCES;
  const normalized = rawSources
    .map((source) => SOURCE_ALIASES[String(source).trim()] || String(source).trim().toLowerCase())
    .filter((source) => SUPPORTED_SOURCES.includes(source));
  let sources = [...new Set(normalized)].length ? [...new Set(normalized)] : DEFAULT_SOURCES;

  // arXiv doesn't support Chinese queries — silently skip it and add alternatives
  const queryText = keywords.join(" ") || "";
  const hasChinese = /[\u4e00-\u9fff]/.test(queryText);
  if (hasChinese) {
    sources = sources.filter((s) => s !== "arxiv");
    // Ensure we have at least openalex and crossref which handle Chinese well
    if (!sources.includes("openalex")) sources.push("openalex");
    if (!sources.includes("crossref")) sources.push("crossref");
  }

  return sources;
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
    semantic_scholar: "Semantic Scholar",
    crossref: "Crossref",
    pubmed: "PubMed",
    github: "GitHub",
  }[source] || source;
  return {
    title: cleanText(rawPaper.title),
    sourceIds: normalizeSourceIds(rawPaper.sourceIds, rawPaper.doi),
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
    status: "triage_pending",
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
  if (Number(paper._score)) return Number(paper._score);
  if (Number(paper.citedByCount) > 10) return 85;
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
    sourceIds: plain.sourceIds || {},
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

function normalizeSourceIds(sourceIds, doi) {
  const normalized = {};
  for (const [key, value] of Object.entries(sourceIds || {})) {
    if (value) normalized[key] = String(value);
  }
  const cleanedDoi = cleanDoi(doi);
  if (cleanedDoi && !normalized.doi) normalized.doi = cleanedDoi;
  return normalized;
}

function createCrawlLogger(logger) {
  if (!logger) {
    return {
      info() {},
      warn() {},
    };
  }

  const write = (level, event, details = {}) => {
    const method = logger[level] || logger.log;
    if (typeof method !== "function") return;
    method.call(logger, `[trackerCrawl] ${event}`, compactLogDetails(details));
  };

  return {
    info(event, details) {
      write("info", event, details);
    },
    warn(event, details) {
      write("warn", event, details);
    },
  };
}

function compactLogDetails(details) {
  return Object.fromEntries(
    Object.entries(details || {}).filter(([, value]) => value !== undefined)
  );
}

function errorMessage(err) {
  return err?.message || String(err);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasChineseQuery(keywords) {
  return /[\u4e00-\u9fff]/.test((keywords || []).join(" "));
}

function defaultSearchers(searchService = getSearchService(), debugLog) {
  return {
    arxiv: createPaperSearchAdapter("arxiv", searchService, { fallback: crawlArxiv, debugLog }),
    openalex: createPaperSearchAdapter("openalex", searchService, { fallback: searchOpenAlex, debugLog }),
    semantic_scholar: createPaperSearchAdapter("semantic_scholar", searchService, { fallback: searchSemanticScholar, debugLog }),
    crossref: createPaperSearchAdapter("crossref", searchService, { debugLog }),
    pubmed: createPaperSearchAdapter("pubmed", searchService, { debugLog }),
    github: searchGitHubRepositories,
  };
}

function createPaperSearchAdapter(source, searchService, options = {}) {
  const { fallback = null, debugLog } = options;

  return async (query, maxResults) => {
    try {
      if (debugLog) debugLog.detail(`paperSearch adapter calling searchService.search()`, { source, query: query?.slice(0, 80), maxResults });
      const t0 = Date.now();
      const result = await searchService.search({
        query,
        maxResults,
        providers: [source],
        deduplicate: false,
        enrich: false,
        timeoutPerProvider: 6000,
      });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

      if (debugLog) debugLog.detail(`paperSearch returned`, {
        source,
        results: result.results?.length || 0,
        fetched: result.totalFetched,
        afterDedup: result.totalAfterDedup,
        errors: result.errors || [],
        timingMs: result.timingMs,
        elapsedSec: elapsed,
      });

      if (result.errors?.length && !result.results?.length) {
        throw new Error(result.errors.map((err) => err.error).filter(Boolean).join("; ") || `${source} failed`);
      }

      return (result.results || []).map((paper) => ({
        ...paper,
        source: paper.source || source,
      }));
    } catch (err) {
      if (fallback) {
        if (debugLog) debugLog.warn(`paperSearch FAILED for "${source}", falling back to direct adapter`, { error: errorMessage(err) });
        const t0 = Date.now();
        const fbResult = await fallback(query, maxResults);
        const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
        if (debugLog) debugLog.detail(`fallback returned`, { source, count: fbResult?.length || 0, elapsedSec: elapsed });
        return fbResult;
      }
      throw err;
    }
  };
}
