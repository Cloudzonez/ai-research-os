import { getRateLimiter } from "./rateLimiter.js";
import { retryWithBackoff } from "./retryHandler.js";
import { getRequestCache } from "./requestCache.js";
import { config } from "../config.js";

const limiter = getRateLimiter("s2_snowball", 0.5);
const cache = getRequestCache("s2_snowball", { maxSize: 500, ttlMs: 86400000 });
const apiKey = config.semanticScholarApiKey;

const S2_BASE = "https://api.semanticscholar.org/graph/v1";
const PAPER_FIELDS = "title,authors,abstract,year,externalIds,url,openAccessPdf,citationCount";

async function s2Fetch(path, params = {}) {
  const headers = { Accept: "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;

  const url = new URL(path, S2_BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  await limiter.waitForPermission();

  return retryWithBackoff(
    async () => {
      const res = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(15000) });
      if (res.status === 429 || res.status >= 500) {
        const err = new Error(`S2 ${res.status}`);
        err.status = res.status;
        err.response = res;
        throw err;
      }
      if (!res.ok) throw new Error(`S2 error: ${res.status}`);
      return res.json();
    },
    { context: "S2 snowball", maxRetries: 2, initialDelayMs: 4000 }
  );
}

function toPaper(item) {
  return {
    title: item.title || "",
    authors: (item.authors || []).map((a) => a.name || "").filter(Boolean),
    abstract: item.abstract || "",
    doi: item.externalIds?.DOI || "",
    sourceIds: { doi: item.externalIds?.DOI || "", semanticScholar: item.paperId || "" },
    year: item.year || (item.publicationDate ? parseInt(item.publicationDate.slice(0, 4)) : null),
    source: "semantic_scholar",
    url: item.url || "",
    pdfUrl: item.openAccessPdf?.url || "",
    citedByCount: item.citationCount || 0,
  };
}

async function getCitationsBatch(paperIds, direction = "citations", limit = 20) {
  const results = [];
  for (const id of paperIds) {
    const cacheKey = cache.generateKey("s2_snowball", id, { direction, limit });
    const cached = cache.get(cacheKey);
    if (cached) {
      results.push(...cached);
      continue;
    }

    const endpoint = `/paper/${id}/${direction}`;
    const params = { limit: String(Math.min(limit, 500)), fields: PAPER_FIELDS };

    try {
      const data = await s2Fetch(endpoint, params);
      const papers = (data.data || []).map(toPaper);
      cache.set(cacheKey, papers);
      results.push(...papers);
    } catch (err) {
      console.warn(`[Snowball] Failed to get ${direction} for ${id}: ${err.message}`);
    }
  }
  return results;
}

export async function getForwardCitations(paperIds, { limit = 20 } = {}) {
  return getCitationsBatch(
    Array.isArray(paperIds) ? paperIds : [paperIds],
    "citations",
    limit
  );
}

export async function getBackwardReferences(paperIds, { limit = 20 } = {}) {
  return getCitationsBatch(
    Array.isArray(paperIds) ? paperIds : [paperIds],
    "references",
    limit
  );
}

export async function snowballSearch(seedPaperIds, { maxDepth = 1, direction = "both", limit = 20 } = {}) {
  const visited = new Set();
  const allPapers = [];
  let frontier = Array.isArray(seedPaperIds) ? [...seedPaperIds] : [seedPaperIds];

  for (const id of frontier) visited.add(id);

  for (let depth = 0; depth < maxDepth; depth++) {
    if (frontier.length === 0) break;

    const newPapers = [];
    const nextFrontier = [];

    for (const id of frontier) {
      if (direction === "both" || direction === "forward") {
        const forward = await getForwardCitations([id], { limit });
        for (const p of forward) {
          const pid = p.sourceIds?.semanticScholar || p.doi;
          if (!pid || visited.has(pid)) continue;
          visited.add(pid);
          p._snowballDepth = depth + 1;
          p._snowballDirection = "forward";
          newPapers.push(p);
        }
      }

      if (direction === "both" || direction === "backward") {
        const backward = await getBackwardReferences([id], { limit });
        for (const p of backward) {
          const pid = p.sourceIds?.semanticScholar || p.doi;
          if (!pid || visited.has(pid)) continue;
          visited.add(pid);
          p._snowballDepth = depth + 1;
          p._snowballDirection = "backward";
          newPapers.push(p);
        }
      }
    }

    allPapers.push(...newPapers);
    if (depth < maxDepth - 1) {
      frontier = newPapers
        .filter((p) => p.sourceIds?.semanticScholar)
        .map((p) => p.sourceIds.semanticScholar)
        .slice(0, limit);
    }
  }

  return allPapers;
}

export default { getForwardCitations, getBackwardReferences, snowballSearch };
