import { Router } from "express";
import { parseQuery } from "../services/search/queryParser.js";
import { detectSeminalPapers } from "../services/search/seminalPaperDetector.js";
import { federatedSearch, searchSingleSource, getAvailableProviders, checkProvidersHealth } from "../services/search/federationManager.js";
import { authOptional } from "../middleware/auth.js";

const router = Router();

/**
 * POST /api/search/query
 * Natural language search across multiple sources
 */
router.post("/query", authOptional, async (req, res) => {
  try {
    const { query, sources, locale, skipCache } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // Parse natural language query into structured intent
    const intent = await parseQuery(query, { locale: locale || "en" });

    // Execute federated search
    const results = await federatedSearch(intent, { 
      sources, 
      skipCache: skipCache || false 
    });

    res.json({
      query: intent,
      results: results.papers,
      metadata: {
        totalFound: results.totalFound,
        totalUnique: results.totalUnique,
        sources: results.sources,
        timestamp: results.timestamp,
      },
    });
  } catch (error) {
    console.error("Search query error:", error);
    res.status(500).json({ 
      error: error.message || "Search failed",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

/**
 * POST /api/search/structured
 * Search with pre-structured query (skip parsing)
 */
router.post("/structured", authOptional, async (req, res) => {
  try {
    const { query, sources, skipCache } = req.body;
    
    if (!query || !query.searchQuery) {
      return res.status(400).json({ error: "Structured query with searchQuery is required" });
    }

    // Validate query structure
    const structuredQuery = {
      searchQuery: query.searchQuery,
      mainTopic: query.mainTopic || query.searchQuery,
      keywords: query.keywords || [],
      filters: query.filters || {},
      sortBy: query.sortBy || "relevance",
      maxResults: query.maxResults || 20,
    };

    const results = await federatedSearch(structuredQuery, { 
      sources, 
      skipCache: skipCache || false 
    });

    res.json({
      query: structuredQuery,
      results: results.papers,
      metadata: {
        totalFound: results.totalFound,
        totalUnique: results.totalUnique,
        sources: results.sources,
        timestamp: results.timestamp,
      },
    });
  } catch (error) {
    console.error("Structured search error:", error);
    res.status(500).json({ error: error.message || "Search failed" });
  }
});

/**
 * POST /api/search/source/:sourceName
 * Search a single source
 */
router.post("/source/:sourceName", authOptional, async (req, res) => {
  try {
    const { sourceName } = req.params;
    const { query, locale } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // Parse query
    const intent = await parseQuery(query, { locale: locale || "en" });

    // Search single source
    const results = await searchSingleSource(sourceName, intent);

    res.json({
      query: intent,
      source: sourceName,
      results: results.results,
      count: results.count,
    });
  } catch (error) {
    console.error(`Single source search error (${req.params.sourceName}):`, error);
    res.status(500).json({ error: error.message || "Search failed" });
  }
});

/**
 * GET /api/search/providers
 * Get list of available search providers
 */
router.get("/providers", authOptional, async (req, res) => {
  try {
    const providers = getAvailableProviders();
    res.json({ providers });
  } catch (error) {
    console.error("Get providers error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/search/health
 * Check health of all search providers
 */
router.get("/health", authOptional, async (req, res) => {
  try {
    const health = await checkProvidersHealth();
    res.json(health);
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({ error: error.message });
  }

/**
 * GET /api/search/seminal
 * Find seminal/foundational papers in a topic area
 */
router.get("/seminal", authOptional, async (req, res) => {
  try {
    const { topic, minScore, maxResults, minCitations, skipCache } = req.query;
    
    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const options = {
      minScore: minScore ? parseFloat(minScore) : 0.7,
      maxResults: maxResults ? parseInt(maxResults) : 20,
      minCitations: minCitations ? parseInt(minCitations) : 50,
      skipCache: skipCache === "true",
    };

    const seminalPapers = await detectSeminalPapers(topic, options);

    res.json({
      topic,
      count: seminalPapers.length,
      papers: seminalPapers,
      options,
    });
  } catch (error) {
    console.error("Seminal papers detection error:", error);
    res.status(500).json({ 
      error: error.message || "Seminal paper detection failed",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});
});

/**
 * GET /api/search/suggestions
 * Get query suggestions (placeholder for future implementation)
 */
router.get("/suggestions", authOptional, async (req, res) => {
  try {
    const { q } = req.query;
    
    // TODO: Implement query suggestions based on:
    // - Popular searches
    // - User's search history
    // - Trending topics
    
    res.json({ 
      suggestions: [],
      message: "Query suggestions not yet implemented"
    });
  } catch (error) {
    console.error("Suggestions error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/search/parse
 * Parse a natural language query without executing search
 */
router.post("/parse", authOptional, async (req, res) => {
  try {
    const { query, locale } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const intent = await parseQuery(query, { locale: locale || "en" });
    
    res.json({ intent });
  } catch (error) {
    console.error("Parse query error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

// Made with Bob
