import { getRateLimiter } from "../rateLimiter.js";
import { retryWithBackoff } from "../retryHandler.js";
import { getRequestCache } from "../requestCache.js";
import { config } from "../../config.js";

const limiter = getRateLimiter("semantic_scholar", 1);
const cache = getRequestCache("semantic_scholar", { maxSize: 200, ttlMs: 600000 });
const apiKey = config.semanticScholarApiKey;

export async function searchSemanticScholar(query, maxResults = 10, options = {}) {
  const cacheKey = cache.generateKey("semantic_scholar", query, { maxResults });
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  await limiter.waitForPermission();

  const params = new URLSearchParams({
    query,
    limit: String(Math.min(Math.max(Number(maxResults) || 10, 1), 100)),
    fields: "title,authors,abstract,year,externalIds,url,openAccessPdf,citationCount,venue,publicationDate",
  });

  const headers = { Accept: "application/json" };
  const key = options.apiKey || apiKey;
  if (key) headers["x-api-key"] = key;

  const result = await retryWithBackoff(
    async () => {
      const res = await fetch(`${baseUrl}?${params.toString()}`, {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429 || res.status === 503) {
        const err = new Error(`S2 API ${res.status}`);
        err.status = res.status;
        err.response = res;
        throw err;
      }
      if (!res.ok) {
        throw new Error(`Semantic Scholar API error: ${res.status}`);
      }
      const data = await res.json();
      return (data.data || []).map((paper) => ({
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
    },
    { context: "Semantic Scholar", maxRetries: 3, initialDelayMs: 4000 }
  );

  cache.set(cacheKey, result);
  return result;
}

const baseUrl = "https://api.semanticscholar.org/graph/v1/paper/search";

export default { searchSemanticScholar };
