import { openAlexProvider } from "../ingestion/openalex.js";
import { arxivProvider } from "../ingestion/arxiv.js";
import { semanticScholarProvider } from "../ingestion/semanticScholar.js";
import { pubmedProvider } from "../ingestion/pubmed.js";
import { philpapersProvider } from "../ingestion/philpapers.js";
import { coreProvider } from "../ingestion/core.js";
import { baseProvider } from "../ingestion/base.js";
import { opengreyProvider } from "../ingestion/opengrey.js";
import { usptoProvider } from "../ingestion/uspto.js";
import { GoogleScholarProvider } from "../ingestion/googleScholar.js";
import { getCache, setCache } from "../cache.js";
import { config } from "../../config.js";

// Initialize Google Scholar provider
const googleScholarProvider = new GoogleScholarProvider();

// Registry of available providers
const PROVIDERS = {
  openalex: openAlexProvider,
  arxiv: arxivProvider,
  semanticScholar: semanticScholarProvider,
  pubmed: pubmedProvider,
  philpapers: philpapersProvider,
  core: coreProvider,
  base: baseProvider,
  opengrey: opengreyProvider,
  uspto: usptoProvider,
  googleScholar: googleScholarProvider,
};

/**
 * Federated search across multiple sources
 * @param {Object} query - Structured query from queryParser
 * @param {Object} options - Search options
 * @param {string[]} options.sources - Sources to search (default: all)
 * @param {boolean} options.skipCache - Skip cache lookup
 * @param {number} options.timeout - Timeout per source in ms
 * @returns {Promise<Object>} Federated search results
 */
export async function federatedSearch(query, options = {}) {
  const activeSources = options.sources || ["openalex", "arxiv", "semanticScholar", "pubmed", "philpapers", "core"];
  const timeout = options.timeout || config.searchTimeout || 15000;
  
  // Check cache
  const cacheKey = `federated:${JSON.stringify({ query: query.searchQuery, sources: activeSources })}`;
  if (!options.skipCache) {
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log("Federation: Cache hit");
      return cached;
    }
  }

  console.log(`Federation: Searching ${activeSources.length} sources for: "${query.searchQuery}"`);

  // Query all sources in parallel
  const promises = activeSources.map(async (sourceName) => {
    const provider = PROVIDERS[sourceName];
    if (!provider) {
      console.warn(`Federation: Unknown provider: ${sourceName}`);
      return { source: sourceName, results: [], error: "Unknown provider", duration: 0 };
    }

    const startTime = Date.now();
    try {
      const results = await Promise.race([
        provider.search(query),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), timeout)
        ),
      ]);
      
      const duration = Date.now() - startTime;
      console.log(`Federation: ${sourceName} returned ${results.length} results in ${duration}ms`);
      
      return { source: sourceName, results, error: null, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Federation: ${sourceName} error after ${duration}ms:`, error.message);
      return { source: sourceName, results: [], error: error.message, duration };
    }
  });

  const sourceResults = await Promise.all(promises);

  // Flatten all results
  const allPapers = sourceResults.flatMap(sr => sr.results);
  console.log(`Federation: Total papers before dedup: ${allPapers.length}`);

  // Deduplicate
  const deduplicated = await deduplicatePapers(allPapers);
  console.log(`Federation: Papers after dedup: ${deduplicated.length}`);

  // Rank using Reciprocal Rank Fusion (RRF)
  const ranked = rankByRRF(deduplicated, sourceResults);

  const result = {
    papers: ranked.slice(0, query.maxResults || 20),
    totalFound: allPapers.length,
    totalUnique: deduplicated.length,
    sources: sourceResults.map(sr => ({
      name: sr.source,
      count: sr.results.length,
      error: sr.error,
      duration: sr.duration,
    })),
    query,
    timestamp: new Date().toISOString(),
  };

  // Cache for configured TTL (default 5 minutes)
  await setCache(cacheKey, result, config.searchCacheTtl || 300);

  return result;
}

/**
 * Deduplicate papers using multi-stage matching
 * @param {Array} papers - Array of papers from all sources
 * @returns {Array} Deduplicated papers
 */
async function deduplicatePapers(papers) {
  const seen = new Map();
  const unique = [];

  for (const paper of papers) {
    // Stage 1: Check DOI (exact match)
    if (paper.doi && paper.doi.length > 5) {
      const normalizedDoi = normalizeDoi(paper.doi);
      if (seen.has(`doi:${normalizedDoi}`)) {
        // Merge metadata from duplicate
        const existing = seen.get(`doi:${normalizedDoi}`);
        mergePaperMetadata(existing, paper);
        continue;
      }
      seen.set(`doi:${normalizedDoi}`, paper);
      unique.push(paper);
      continue;
    }

    // Stage 2: Check external IDs
    const externalIdKey = getExternalIdKey(paper);
    if (externalIdKey && seen.has(externalIdKey)) {
      const existing = seen.get(externalIdKey);
      mergePaperMetadata(existing, paper);
      continue;
    }

    // Stage 3: Fuzzy title matching
    let isDuplicate = false;
    const normalizedTitle = normalizeTitle(paper.title);
    
    for (const [key, existingPaper] of seen.entries()) {
      if (key.startsWith("title:")) {
        const existingTitle = normalizeTitle(existingPaper.title);
        const similarity = titleSimilarity(normalizedTitle, existingTitle);
        
        if (similarity > (config.titleSimilarityThreshold || 0.95)) {
          isDuplicate = true;
          mergePaperMetadata(existingPaper, paper);
          break;
        }
      }
    }
    
    if (isDuplicate) continue;

    // Add to unique set
    const key = externalIdKey || `title:${normalizedTitle}`;
    seen.set(key, paper);
    unique.push(paper);
  }

  return unique;
}

/**
 * Normalize DOI for comparison
 */
function normalizeDoi(doi) {
  return doi
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:/i, "")
    .trim();
}

/**
 * Get external ID key for deduplication
 */
function getExternalIdKey(paper) {
  if (paper.externalIds) {
    if (paper.externalIds.openAlex) return `openalex:${paper.externalIds.openAlex}`;
    if (paper.externalIds.arxiv) return `arxiv:${paper.externalIds.arxiv}`;
    if (paper.externalIds.semanticScholar) return `s2:${paper.externalIds.semanticScholar}`;
    if (paper.externalIds.pubmed) return `pubmed:${paper.externalIds.pubmed}`;
  }
  return null;
}

/**
 * Normalize title for comparison
 */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculate title similarity using Levenshtein distance
 */
function titleSimilarity(title1, title2) {
  if (title1 === title2) return 1.0;
  
  const maxLen = Math.max(title1.length, title2.length);
  if (maxLen === 0) return 1.0;
  
  const distance = levenshteinDistance(title1, title2);
  return 1 - (distance / maxLen);
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(a, b) {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,      // insertion
        matrix[j - 1][i] + 1,      // deletion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Merge metadata from duplicate paper into existing paper
 */
function mergePaperMetadata(existing, duplicate) {
  // Prefer non-empty values
  if (!existing.abstract && duplicate.abstract) {
    existing.abstract = duplicate.abstract;
  }
  if (!existing.pdfUrl && duplicate.pdfUrl) {
    existing.pdfUrl = duplicate.pdfUrl;
  }
  if (!existing.doi && duplicate.doi) {
    existing.doi = duplicate.doi;
  }
  
  // Merge external IDs
  if (duplicate.externalIds) {
    existing.externalIds = existing.externalIds || {};
    Object.assign(existing.externalIds, duplicate.externalIds);
  }
  
  // Take higher citation count
  if (duplicate.citedByCount > (existing.citedByCount || 0)) {
    existing.citedByCount = duplicate.citedByCount;
  }
  
  // Merge code/data URLs
  if (duplicate.codeUrls && duplicate.codeUrls.length > 0) {
    existing.codeUrls = existing.codeUrls || [];
    existing.codeUrls.push(...duplicate.codeUrls);
    existing.codeUrls = [...new Set(existing.codeUrls)]; // Deduplicate
    existing.codeAvailable = true;
  }
  
  if (duplicate.dataUrls && duplicate.dataUrls.length > 0) {
    existing.dataUrls = existing.dataUrls || [];
    existing.dataUrls.push(...duplicate.dataUrls);
    existing.dataUrls = [...new Set(existing.dataUrls)];
    existing.dataAvailable = true;
  }
}

/**
 * Rank papers using Reciprocal Rank Fusion (RRF)
 * @param {Array} papers - Deduplicated papers
 * @param {Array} sourceResults - Results from each source
 * @returns {Array} Ranked papers
 */
function rankByRRF(papers, sourceResults) {
  const k = 60; // RRF constant (standard value)
  const scores = new Map();

  // Calculate RRF score for each paper
  for (const { source, results } of sourceResults) {
    results.forEach((paper, index) => {
      const key = getPaperKey(paper);
      const currentScore = scores.get(key) || 0;
      const rrfScore = 1 / (k + index + 1);
      scores.set(key, currentScore + rrfScore);
    });
  }

  // Assign scores to papers and sort
  return papers
    .map(paper => ({
      ...paper,
      searchRelevanceScore: scores.get(getPaperKey(paper)) || 0,
    }))
    .sort((a, b) => {
      // Primary sort: RRF score
      if (b.searchRelevanceScore !== a.searchRelevanceScore) {
        return b.searchRelevanceScore - a.searchRelevanceScore;
      }
      // Secondary sort: citation count
      return (b.citedByCount || 0) - (a.citedByCount || 0);
    });
}

/**
 * Get unique key for paper (for RRF scoring)
 */
function getPaperKey(paper) {
  if (paper.doi) return `doi:${normalizeDoi(paper.doi)}`;
  const externalIdKey = getExternalIdKey(paper);
  if (externalIdKey) return externalIdKey;
  return `title:${normalizeTitle(paper.title)}`;
}

/**
 * Search a single source
 * @param {string} sourceName - Provider name
 * @param {Object} query - Structured query
 * @returns {Promise<Object>} Source results
 */
export async function searchSingleSource(sourceName, query) {
  const provider = PROVIDERS[sourceName];
  if (!provider) {
    throw new Error(`Unknown provider: ${sourceName}`);
  }

  const results = await provider.search(query);
  return {
    source: sourceName,
    results,
    count: results.length,
  };
}

/**
 * Get available providers
 * @returns {Array} Provider metadata
 */
export function getAvailableProviders() {
  return Object.entries(PROVIDERS).map(([name, provider]) => ({
    name,
    ...provider.getMetadata(),
  }));
}

/**
 * Check health of all providers
 * @returns {Promise<Object>} Health status
 */
export async function checkProvidersHealth() {
  const checks = await Promise.all(
    Object.entries(PROVIDERS).map(async ([name, provider]) => {
      const startTime = Date.now();
      try {
        const isAvailable = await provider.isAvailable();
        return {
          name,
          available: isAvailable,
          latency: Date.now() - startTime,
        };
      } catch (error) {
        return {
          name,
          available: false,
          latency: Date.now() - startTime,
          error: error.message,
        };
      }
    })
  );

  return {
    providers: checks,
    allAvailable: checks.every(c => c.available),
    timestamp: new Date().toISOString(),
  };
}

export default {
  federatedSearch,
  searchSingleSource,
  getAvailableProviders,
  checkProvidersHealth,
};

// Made with Bob
