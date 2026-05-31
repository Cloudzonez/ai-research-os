import { getRateLimiter } from "../rateLimiter.js";
import { retryWithBackoff } from "../retryHandler.js";
import { getRequestCache } from "../requestCache.js";
import { getActiveDebugLog } from "../trackerDebugLog.js";

const limiter = getRateLimiter("github", 1);
const cache = getRequestCache("github", { maxSize: 200, ttlMs: 600000 });

export async function searchGitHubRepositories(query, maxResults = 10, options = {}) {
  const debugLog = getActiveDebugLog();
  const cacheKey = cache.generateKey("github", query, { maxResults, sort: options.sort });
  const cached = cache.get(cacheKey);
  if (cached) {
    if (debugLog) debugLog.detail("[ingestion/github] cache HIT", { query: query.slice(0, 60), count: cached.length });
    return cached;
  }

  if (debugLog) debugLog.begin("[ingestion/github] API call", { query: query.slice(0, 80), maxResults });
  await limiter.waitForPermission();

  const baseUrl = "https://api.github.com/search/repositories";
  const params = new URLSearchParams({
    q: query,
    sort: options.sort || "stars",
    order: options.order || "desc",
    per_page: String(Math.min(Math.max(Number(maxResults) || 10, 1), 100)),
  });

  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ai-research-os",
  };
  const token = options.token || process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const t0 = Date.now();

  const data = await retryWithBackoff(
    async () => {
      const res = await fetch(`${baseUrl}?${params.toString()}`, {
        headers,
        signal: AbortSignal.timeout(options.timeoutMs || 15000),
      });
      if (!res.ok) {
        if (debugLog) debugLog.error("[ingestion/github] HTTP failed", { status: res.status, statusText: res.statusText });
        throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    { context: "GitHub API", maxRetries: 2, initialDelayMs: 3000 }
  );

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  const results = (data.items || []).map((repo) => ({
    title: repo.full_name || repo.name || "",
    authors: repo.owner?.login ? [repo.owner.login] : [],
    abstract: repo.description || "",
    doi: "",
    year: Number(repo.created_at?.slice(0, 4)) || new Date().getFullYear(),
    source: "github",
    url: repo.html_url || "",
    stars: repo.stargazers_count || 0,
    forks: repo.forks_count || 0,
    language: repo.language || "",
    updatedAt: repo.updated_at || "",
    itemType: "repository",
  }));

  if (debugLog) debugLog.end("[ingestion/github] done", { resultCount: results.length, elapsedSec: elapsed });
  cache.set(cacheKey, results);
  return results;
}

export default { searchGitHubRepositories };
