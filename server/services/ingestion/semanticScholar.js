import { getRateLimiter } from "../rateLimiter.js";
import { retryWithBackoff } from "../retryHandler.js";
import { getRequestCache } from "../requestCache.js";
import { config } from "../../config.js";
import { getActiveDebugLog } from "../trackerDebugLog.js";

const limiter = getRateLimiter("semantic_scholar", 1);
const cache = getRequestCache("semantic_scholar", { maxSize: 200, ttlMs: 600000 });
const apiKey = config.semanticScholarApiKey;

export async function searchSemanticScholar(query, maxResults = 10, options = {}) {
  const debugLog = getActiveDebugLog();
  const cacheKey = cache.generateKey("semantic_scholar", query, { maxResults });
  const cached = cache.get(cacheKey);
  if (cached) {
    if (debugLog) debugLog.detail("[ingestion/semanticScholar] cache HIT", { query: query.slice(0, 60), count: cached.length });
    return cached;
  }

  if (debugLog) debugLog.begin(`[ingestion/semanticScholar] API call`, { query: query.slice(0, 80), maxResults, hasApiKey: Boolean(options.apiKey || apiKey) });
  await limiter.waitForPermission();

  const params = new URLSearchParams({
    query,
    limit: String(Math.min(Math.max(Number(maxResults) || 10, 1), 100)),
    fields: "title,authors,abstract,year,externalIds,url,openAccessPdf,citationCount,venue,publicationDate",
  });

  const headers = { Accept: "application/json" };
  const key = options.apiKey || apiKey;
  if (key) headers["x-api-key"] = key;

  const t0 = Date.now();
  const url = `${baseUrl}?${params.toString()}`;

  const result = await retryWithBackoff(
    async () => {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429 || res.status === 503) {
        if (debugLog) debugLog.warn("[ingestion/semanticScholar] HTTP rate-limit", { status: res.status, retrying: true });
        const err = new Error(`S2 API ${res.status}`);
        err.status = res.status;
        err.response = res;
        throw err;
      }
      if (!res.ok) {
        if (debugLog) debugLog.error("[ingestion/semanticScholar] HTTP failed", { status: res.status, statusText: res.statusText });
        throw new Error(`Semantic Scholar API error: ${res.status}`);
      }
      const data = await res.json();
      const results = (data.data || []).map((paper) => ({
        title: paper.title || "",
        authors: (paper.authors || []).map((author) => author.name || "").filter(Boolean),
        abstract: paper.abstract || "",
        doi: paper.externalIds?.DOI || "",
        year: paper.year || Number(paper.publicationDate?.slice(0, 4)) || new Date().getFullYear(),
        source: "semantic_scholar",
        url: paper.url || "",
        pdfUrl: paper.openAccessPdf?.url || "",
        citedByCount: paper.citationCount || 0,
        venue: paper.venue || "",
      }));
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      if (debugLog) debugLog.detail("[ingestion/semanticScholar] HTTP response", { status: res.status, results: results.length, total: data.total || "?", elapsedSec: elapsed });
      return results;
    },
    { context: "Semantic Scholar", maxRetries: 3, initialDelayMs: 4000 }
  );

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  if (debugLog) debugLog.end(`[ingestion/semanticScholar] done`, { resultCount: result.length, elapsedSec: elapsed });
  if (result.length === 0 && debugLog) debugLog.warn("[ingestion/semanticScholar] returned 0 results", { query, maxResults });

  cache.set(cacheKey, result);
  return result;
}

const baseUrl = "https://api.semanticscholar.org/graph/v1/paper/search";

export default { searchSemanticScholar };
