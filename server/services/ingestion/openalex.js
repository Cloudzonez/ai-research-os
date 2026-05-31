import { getRateLimiter } from "../rateLimiter.js";
import { retryWithBackoff, createFetchWithRetry } from "../retryHandler.js";
import { getRequestCache } from "../requestCache.js";

const limiter = getRateLimiter("openalex", 8);
const cache = getRequestCache("openalex", { maxSize: 200, ttlMs: 600000 });
const fetchR = createFetchWithRetry({ maxRetries: 3, timeoutMs: 15000, context: "OpenAlex" });

export async function searchOpenAlex(query, maxResults = 10, options = {}) {
  const cacheKey = cache.generateKey("openalex", query, { maxResults });
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  await limiter.waitForPermission();

  const params = new URLSearchParams({
    search: query,
    per_page: String(maxResults),
    sort: "cited_by_count:desc",
  });

  const url = `https://api.openalex.org/works?${params.toString()}`;

  const result = await retryWithBackoff(
    async () => {
      const res = await fetchR(url, {
        headers: { "User-Agent": "mailto:ai-research-os@university.edu" },
      });
      if (!res.ok) {
        const err = new Error(`OpenAlex API error: ${res.status}`);
        err.status = res.status;
        err.response = res;
        throw err;
      }
      const data = await res.json();
      return (data.results || []).map((work) => ({
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
    },
    { context: "OpenAlex search", maxRetries: 3, initialDelayMs: 2000 }
  );

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
