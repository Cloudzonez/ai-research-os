import { getRateLimiter } from "../rateLimiter.js";
import { retryWithBackoff } from "../retryHandler.js";
import { getRequestCache } from "../requestCache.js";
import { getActiveDebugLog } from "../trackerDebugLog.js";

const limiter = getRateLimiter("arxiv", 0.33);
const cache = getRequestCache("arxiv", { maxSize: 200, ttlMs: 600000 });

const API_TIMEOUT = 20000;

function extractArxivId(text) {
  const match = String(text || "").match(/(\d{4}\.\d{4,5})(?:v\d+)?/);
  return match ? match[1] : "";
}

function getTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
}

function getAuthors(xml) {
  const matches = xml.match(/<name>([^<]*)<\/name>/g);
  return matches ? matches.map((m) => m.replace(/<\/?name>/g, "").trim()) : [];
}

function parseAtomResponse(xml) {
  const entries = xml.split(/<entry>/).slice(1);
  return entries.map((entry) => {
    const id = getTag(entry, "id");
    const arxivId = extractArxivId(id);
    return {
      title: getTag(entry, "title"),
      authors: getAuthors(entry),
      abstract: getTag(entry, "summary"),
      doi: getTag(entry, "arxiv:doi") || `arxiv:${arxivId}`,
      year: parseInt(getTag(entry, "published")?.slice(0, 4)) || new Date().getFullYear(),
      source: "arxiv",
      url: `https://arxiv.org/abs/${arxivId}`,
      pdfUrl: `https://arxiv.org/pdf/${arxivId}`,
      published: getTag(entry, "published"),
      categories: (entry.match(/category term="([^"]+)"/g) || [])
        .map((c) => c.match(/category term="([^"]+)"/)?.[1] || "")
        .filter(Boolean),
    };
  });
}

async function fetchArxivApi(query, maxResults = 10) {
  const params = new URLSearchParams({
    search_query: `all:${query}`,
    start: "0",
    max_results: String(maxResults),
    sortBy: "submittedDate",
    sortOrder: "descending",
  });

  const url = `https://export.arxiv.org/api/query?${params.toString()}`;
  const debugLog = getActiveDebugLog();
  const t0 = Date.now();

  return retryWithBackoff(
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);
      try {
        const res = await fetch(url, {
          headers: { Accept: "application/atom+xml" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.status === 429 || res.status === 503) {
          if (debugLog) debugLog.warn("[ingestion/arxiv] HTTP error", { status: res.status, retrying: true });
          const err = new Error(`arXiv API ${res.status}`);
          err.status = res.status;
          err.response = res;
          throw err;
        }
        if (!res.ok) {
          if (debugLog) debugLog.error("[ingestion/arxiv] HTTP failed", { status: res.status, statusText: res.statusText });
          throw new Error(`arXiv API error: ${res.status} ${res.statusText}`);
        }
        const text = await res.text();
        const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
        if (debugLog) debugLog.detail("[ingestion/arxiv] HTTP response", { status: res.status, bytes: text.length, elapsedSec: elapsed, url: url.slice(0, 120) });
        return text;
      } catch (e) {
        clearTimeout(timeout);
        throw e;
      }
    },
    { context: "arXiv API", maxRetries: 2, initialDelayMs: 5000, maxDelayMs: 30000 }
  );
}

export async function searchArxiv(query, maxResults = 10, options = {}) {
  const debugLog = getActiveDebugLog();
  const cacheKey = cache.generateKey("arxiv", query, { maxResults });
  const cached = cache.get(cacheKey);
  if (cached) {
    if (debugLog) debugLog.detail("[ingestion/arxiv] cache HIT", { query: query.slice(0, 60), count: cached.length });
    return cached;
  }

  if (debugLog) debugLog.begin(`[ingestion/arxiv] API call`, { query: query.slice(0, 80), maxResults });
  await limiter.waitForPermission();

  const t0 = Date.now();
  const xml = await fetchArxivApi(query, maxResults);
  const results = parseAtomResponse(xml);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

  if (debugLog) debugLog.end(`[ingestion/arxiv] done`, { resultCount: results.length, elapsedSec: elapsed });
  if (results.length === 0 && debugLog) debugLog.warn("[ingestion/arxiv] returned 0 results", { query, maxResults });

  cache.set(cacheKey, results);
  return results;
}

export async function crawlArxiv(query, maxResultsOrOptions, legacyOptions = {}) {
  let maxResults, options;
  if (typeof maxResultsOrOptions === "number") {
    maxResults = maxResultsOrOptions;
    options = legacyOptions;
  } else {
    options = maxResultsOrOptions || {};
    maxResults = options.maxResults || 50;
  }

  return searchArxiv(query, maxResults, options);
}

export { extractArxivId };

export async function resolveArxivPdfFromDoi(doi) {
  if (!doi) return null;
  const clean = String(doi).replace(/^https?:\/\/doi\.org\//i, "").trim();
  if (!clean.startsWith("10.")) return null;

  try {
    const xml = await fetchArxivApi(`doi:${clean}`, 1);
    const results = parseAtomResponse(xml);
    if (results.length > 0 && results[0].pdfUrl) {
      return {
        pdfUrl: results[0].pdfUrl,
        arxivId: results[0].url?.split("/abs/")[1] || "",
        title: results[0].title,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export default { searchArxiv, crawlArxiv, extractArxivId, resolveArxivPdfFromDoi };
