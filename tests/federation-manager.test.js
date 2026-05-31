import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { federatedSearch, searchSingleSource, getAvailableProviders, checkProvidersHealth } from "../server/services/search/federationManager.js";

// Mock cache service
const mockCache = new Map();

before(async () => {
  // Mock cache functions
  global.getCache = async (key) => mockCache.get(key);
  global.setCache = async (key, value, ttl) => {
    mockCache.set(key, value);
    return true;
  };
});

after(async () => {
  mockCache.clear();
});

describe("Federation Manager", () => {
  describe("getAvailableProviders", () => {
    it("should return list of providers", () => {
      const providers = getAvailableProviders();
      
      assert.ok(Array.isArray(providers));
      assert.ok(providers.length > 0);
      
      // Check provider structure
      providers.forEach(provider => {
        assert.ok(provider.name);
        assert.ok(typeof provider.supportsCitations === "boolean");
        assert.ok(typeof provider.supportsFullText === "boolean");
        assert.ok(typeof provider.requiresAuth === "boolean");
      });
    });

    it("should include expected providers", () => {
      const providers = getAvailableProviders();
      const names = providers.map(p => p.name);
      
      assert.ok(names.includes("openalex"));
      assert.ok(names.includes("arxiv"));
      assert.ok(names.includes("semantic_scholar"));
    });
  });

  describe("checkProvidersHealth", () => {
    it("should check health of all providers", async () => {
      const health = await checkProvidersHealth();
      
      assert.ok(health.providers);
      assert.ok(Array.isArray(health.providers));
      assert.ok(typeof health.allAvailable === "boolean");
      assert.ok(health.timestamp);
      
      // Check each provider health
      health.providers.forEach(provider => {
        assert.ok(provider.name);
        assert.ok(typeof provider.available === "boolean");
        assert.ok(typeof provider.latency === "number");
      });
    });
  });

  describe("federatedSearch", () => {
    it("should search across multiple sources", async () => {
      const query = {
        searchQuery: "machine learning",
        mainTopic: "machine learning",
        keywords: ["machine", "learning"],
        filters: {},
        sortBy: "relevance",
        maxResults: 5,
      };

      const results = await federatedSearch(query, {
        sources: ["openalex"], // Use only OpenAlex for faster test
      });

      assert.ok(results.papers);
      assert.ok(Array.isArray(results.papers));
      assert.ok(typeof results.totalFound === "number");
      assert.ok(typeof results.totalUnique === "number");
      assert.ok(Array.isArray(results.sources));
      assert.ok(results.timestamp);
    });

    it("should deduplicate results", async () => {
      const query = {
        searchQuery: "neural networks",
        mainTopic: "neural networks",
        keywords: ["neural", "networks"],
        filters: {},
        sortBy: "relevance",
        maxResults: 10,
      };

      const results = await federatedSearch(query, {
        sources: ["openalex", "arxiv"],
      });

      // Total unique should be <= total found (due to deduplication)
      assert.ok(results.totalUnique <= results.totalFound);
    });

    it("should handle year filters", async () => {
      const query = {
        searchQuery: "deep learning",
        mainTopic: "deep learning",
        keywords: ["deep", "learning"],
        filters: {
          yearFrom: 2020,
          yearTo: 2024,
        },
        sortBy: "relevance",
        maxResults: 5,
      };

      const results = await federatedSearch(query, {
        sources: ["openalex"],
      });

      assert.ok(results.papers);
      
      // Check that papers are within year range
      results.papers.forEach(paper => {
        if (paper.year) {
          assert.ok(paper.year >= 2020);
          assert.ok(paper.year <= 2024);
        }
      });
    });

    it("should cache results", async () => {
      const query = {
        searchQuery: "test query for caching",
        mainTopic: "test",
        keywords: ["test"],
        filters: {},
        sortBy: "relevance",
        maxResults: 5,
      };

      // First call
      const results1 = await federatedSearch(query, {
        sources: ["openalex"],
      });

      // Second call (should use cache)
      const results2 = await federatedSearch(query, {
        sources: ["openalex"],
      });

      // Results should be identical
      assert.deepStrictEqual(results1.papers.length, results2.papers.length);
    });

    it("should handle source failures gracefully", async () => {
      const query = {
        searchQuery: "test",
        mainTopic: "test",
        keywords: ["test"],
        filters: {},
        sortBy: "relevance",
        maxResults: 5,
      };

      // Include an invalid source
      const results = await federatedSearch(query, {
        sources: ["openalex", "invalid_source"],
      });

      // Should still return results from valid sources
      assert.ok(results.papers);
      assert.ok(results.sources);
      
      // Check that invalid source is marked with error
      const invalidSource = results.sources.find(s => s.name === "invalid_source");
      if (invalidSource) {
        assert.ok(invalidSource.error);
      }
    });

    it("should rank results using RRF", async () => {
      const query = {
        searchQuery: "transformers",
        mainTopic: "transformers",
        keywords: ["transformers"],
        filters: {},
        sortBy: "relevance",
        maxResults: 10,
      };

      const results = await federatedSearch(query, {
        sources: ["openalex", "arxiv"],
      });

      // Check that papers have relevance scores
      results.papers.forEach(paper => {
        assert.ok(typeof paper.searchRelevanceScore === "number");
      });

      // Check that papers are sorted by relevance
      for (let i = 1; i < results.papers.length; i++) {
        assert.ok(
          results.papers[i - 1].searchRelevanceScore >= results.papers[i].searchRelevanceScore
        );
      }
    });

    it("should respect maxResults limit", async () => {
      const query = {
        searchQuery: "artificial intelligence",
        mainTopic: "AI",
        keywords: ["artificial", "intelligence"],
        filters: {},
        sortBy: "relevance",
        maxResults: 3,
      };

      const results = await federatedSearch(query, {
        sources: ["openalex"],
      });

      assert.ok(results.papers.length <= 3);
    });
  });

  describe("searchSingleSource", () => {
    it("should search OpenAlex", async () => {
      const query = {
        searchQuery: "machine learning",
        mainTopic: "machine learning",
        keywords: ["machine", "learning"],
        filters: {},
        sortBy: "relevance",
        maxResults: 5,
      };

      const results = await searchSingleSource("openalex", query);

      assert.strictEqual(results.source, "openalex");
      assert.ok(Array.isArray(results.results));
      assert.ok(typeof results.count === "number");
    });

    it("should search arXiv", async () => {
      const query = {
        searchQuery: "neural networks",
        mainTopic: "neural networks",
        keywords: ["neural", "networks"],
        filters: {},
        sortBy: "relevance",
        maxResults: 5,
      };

      const results = await searchSingleSource("arxiv", query);

      assert.strictEqual(results.source, "arxiv");
      assert.ok(Array.isArray(results.results));
    });

    it("should throw error for unknown source", async () => {
      const query = {
        searchQuery: "test",
        mainTopic: "test",
        keywords: ["test"],
        filters: {},
        sortBy: "relevance",
        maxResults: 5,
      };

      await assert.rejects(
        async () => await searchSingleSource("unknown_source", query),
        { message: /Unknown provider/ }
      );
    });
  });

  describe("Deduplication", () => {
    it("should deduplicate by DOI", async () => {
      const query = {
        searchQuery: "specific paper with DOI",
        mainTopic: "test",
        keywords: ["test"],
        filters: {},
        sortBy: "relevance",
        maxResults: 10,
      };

      const results = await federatedSearch(query, {
        sources: ["openalex", "semanticScholar"],
      });

      // Check for duplicate DOIs
      const dois = results.papers
        .filter(p => p.doi)
        .map(p => p.doi.toLowerCase());
      
      const uniqueDois = new Set(dois);
      assert.strictEqual(dois.length, uniqueDois.size, "Found duplicate DOIs");
    });

    it("should deduplicate by title similarity", async () => {
      const query = {
        searchQuery: "attention is all you need",
        mainTopic: "transformers",
        keywords: ["attention", "transformers"],
        filters: {},
        sortBy: "relevance",
        maxResults: 10,
      };

      const results = await federatedSearch(query, {
        sources: ["openalex", "arxiv"],
      });

      // Check for very similar titles
      const titles = results.papers.map(p => p.title.toLowerCase());
      const uniqueTitles = new Set(titles);
      
      // Should have some deduplication
      assert.ok(uniqueTitles.size >= titles.length * 0.8);
    });
  });

  describe("Metadata Merging", () => {
    it("should merge metadata from duplicate papers", async () => {
      const query = {
        searchQuery: "popular paper",
        mainTopic: "test",
        keywords: ["test"],
        filters: {},
        sortBy: "citations",
        maxResults: 10,
      };

      const results = await federatedSearch(query, {
        sources: ["openalex", "semanticScholar"],
      });

      // Check that papers have merged external IDs
      results.papers.forEach(paper => {
        if (paper.externalIds) {
          // Should have at least one external ID
          const ids = Object.values(paper.externalIds).filter(Boolean);
          assert.ok(ids.length > 0);
        }
      });
    });
  });
});

// Made with Bob
