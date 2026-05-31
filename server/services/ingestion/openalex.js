import { getRateLimiter } from "../rateLimiter.js";
import { retryWithBackoff } from "../retryHandler.js";
import { getRequestCache } from "../requestCache.js";
import { getActiveDebugLog } from "../trackerDebugLog.js";

const limiter = getRateLimiter("openalex", 8);
const cache = getRequestCache("openalex", { maxSize: 200, ttlMs: 600000 });

export async function searchOpenAlex(query, maxResults = 10, options = {}) {
  const debugLog = getActiveDebugLog();
  const cacheKey = cache.generateKey("openalex", query, { maxResults });
  const cached = cache.get(cacheKey);
  if (cached) {
    if (debugLog) debugLog.detail("[ingestion/openalex] cache HIT", { query: query.slice(0, 60), count: cached.length });
    return cached;
  }

  if (debugLog) debugLog.begin(`[ingestion/openalex] API call`, { query: query.slice(0, 80), maxResults });
  await limiter.waitForPermission();

  const params = new URLSearchParams({
    search: query,
    per_page: String(maxResults),
    sort: "cited_by_count:desc",
  });

  const url = `https://api.openalex.org/works?${params.toString()}`;
  const t0 = Date.now();

  const result = await retryWithBackoff(
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "mailto:ai-research-os@university.edu" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
          if (debugLog) debugLog.error("[ingestion/openalex] HTTP failed", { status: res.status, statusText: res.statusText });
          const err = new Error(`OpenAlex API error: ${res.status}`);
          err.status = res.status;
          throw err;
        }
        const data = await res.json();
        const results = (data.results || []).map((work) => ({
          title: work.title || "",
          authors: (work.authorships || []).map((a) => a.author?.display_name || ""),
          abstract: work.abstract_inverted_index
            ? invertAbstract(work.abstract_inverted_index)
            : "",
          doi: work.doi || "",
          year: work.publication_year || new Date().getFullYear(),
          source: "openalex",
          url: work.doi ? `https://doi.org/${work.doi}` : "",
          pdfUrl: work.best_oa_location?.pdf_url || work.primary_location?.pdf_url || "",
          citedByCount: work.cited_by_count || 0,
          type: work.type || "",
        }));
        const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
        if (debugLog) debugLog.detail("[ingestion/openalex] HTTP response", { status: res.status, results: results.length, total: data.meta?.count || "?", elapsedSec: elapsed });
        return results;
      } catch (e) {
        clearTimeout(timeout);
        throw e;
      }
    },
    { context: "OpenAlex search", maxRetries: 3, initialDelayMs: 2000 }
  );

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  if (debugLog) debugLog.end(`[ingestion/openalex] done`, { resultCount: result.length, elapsedSec: elapsed });
  if (result.length === 0 && debugLog) debugLog.warn("[ingestion/openalex] returned 0 results", { query, maxResults });

  cache.set(cacheKey, result);
  return result;
}

function invertAbstract(invertedIndex) {
  if (!invertedIndex) return "";
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.join(" ");
}

export default { searchOpenAlex };
