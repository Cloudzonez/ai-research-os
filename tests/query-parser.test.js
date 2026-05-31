import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { parseQuery, parseQueriesBatch } from "../server/services/search/queryParser.js";

// Mock cache service
const mockCache = new Map();
const originalGetCache = global.getCache;
const originalSetCache = global.setCache;

before(async () => {
  // Mock cache functions
  global.getCache = async (key) => mockCache.get(key);
  global.setCache = async (key, value, ttl) => {
    mockCache.set(key, value);
    return true;
  };
});

after(async () => {
  // Restore original functions
  global.getCache = originalGetCache;
  global.setCache = originalSetCache;
  mockCache.clear();
});

describe("Query Parser", () => {
  describe("parseQuery", () => {
    it("should parse simple research query", async () => {
      const result = await parseQuery("machine learning papers");
      
      assert.ok(result.mainTopic);
      assert.ok(Array.isArray(result.keywords));
      assert.ok(result.searchQuery);
      assert.strictEqual(result.sortBy, "relevance");
      assert.strictEqual(typeof result.maxResults, "number");
    });

    it("should extract year filter from 'since' keyword", async () => {
      const result = await parseQuery("papers on AI since 2020");
      
      assert.ok(result.filters);
      assert.strictEqual(result.filters.yearFrom, 2020);
    });

    it("should detect RCT study type", async () => {
      const result = await parseQuery("RCTs on drug efficacy");
      
      assert.strictEqual(result.filters.studyType, "rct");
    });

    it("should detect population filter", async () => {
      const result = await parseQuery("studies in mice");
      
      assert.strictEqual(result.filters.population, "mice");
    });

    it("should detect code availability requirement", async () => {
      const result = await parseQuery("papers with code on transformers");
      
      assert.strictEqual(result.filters.hasCode, true);
    });

    it("should detect citation sorting preference", async () => {
      const result = await parseQuery("highly cited papers on climate change");
      
      assert.strictEqual(result.sortBy, "citations");
      assert.ok(result.filters.minCitations > 0);
    });

    it("should detect recent papers preference", async () => {
      const result = await parseQuery("recent papers on CRISPR");
      
      assert.strictEqual(result.sortBy, "date");
      assert.ok(result.filters.yearFrom);
    });

    it("should handle year range", async () => {
      const result = await parseQuery("papers from 2018-2022");
      
      assert.strictEqual(result.filters.yearFrom, 2018);
      assert.strictEqual(result.filters.yearTo, 2022);
    });

    it("should detect meta-analysis study type", async () => {
      const result = await parseQuery("meta-analysis on vaccine effectiveness");
      
      assert.strictEqual(result.filters.studyType, "meta_analysis");
    });

    it("should handle empty query gracefully", async () => {
      await assert.rejects(
        async () => await parseQuery(""),
        { message: /empty/ }
      );
    });

    it("should handle non-string query", async () => {
      await assert.rejects(
        async () => await parseQuery(123),
        { message: /string/ }
      );
    });

    it("should cache parsed queries", async () => {
      const query = "test query for caching";
      
      // First call - should parse
      const result1 = await parseQuery(query);
      
      // Second call - should use cache
      const result2 = await parseQuery(query);
      
      assert.deepStrictEqual(result1, result2);
    });

    it("should extract keywords from query", async () => {
      const result = await parseQuery("deep learning neural networks transformers");
      
      assert.ok(result.keywords.length > 0);
      assert.ok(result.keywords.some(k => k.includes("learning") || k.includes("neural") || k.includes("transformers")));
    });

    it("should handle complex multi-filter query", async () => {
      const result = await parseQuery("RCTs on drug X in humans since 2020 with code");
      
      assert.strictEqual(result.filters.studyType, "rct");
      assert.strictEqual(result.filters.population, "humans");
      assert.strictEqual(result.filters.yearFrom, 2020);
      assert.strictEqual(result.filters.hasCode, true);
    });

    it("should limit maxResults to reasonable range", async () => {
      const result = await parseQuery("papers on AI");
      
      assert.ok(result.maxResults >= 1);
      assert.ok(result.maxResults <= 100);
    });

    it("should normalize study type values", async () => {
      const result = await parseQuery("cohort study on diabetes");
      
      if (result.filters.studyType) {
        const validTypes = ["rct", "cohort", "case_study", "meta_analysis", "review", "survey", "experimental", "theoretical"];
        assert.ok(validTypes.includes(result.filters.studyType));
      }
    });
  });

  describe("parseQueriesBatch", () => {
    it("should parse multiple queries", async () => {
      const queries = [
        "machine learning papers",
        "RCTs since 2020",
        "papers with code"
      ];
      
      const results = await parseQueriesBatch(queries);
      
      assert.strictEqual(results.length, 3);
      results.forEach(result => {
        assert.ok(result.mainTopic);
        assert.ok(result.searchQuery);
      });
    });

    it("should handle empty array", async () => {
      const results = await parseQueriesBatch([]);
      
      assert.strictEqual(results.length, 0);
    });

    it("should handle mixed valid and invalid queries", async () => {
      const queries = [
        "valid query",
        "", // Invalid
        "another valid query"
      ];
      
      const results = await parseQueriesBatch(queries);
      
      assert.strictEqual(results.length, 3);
      // First and third should succeed, second should use fallback
      assert.ok(results[0].mainTopic);
      assert.ok(results[2].mainTopic);
    });

    it("should reject non-array input", async () => {
      await assert.rejects(
        async () => await parseQueriesBatch("not an array"),
        { message: /array/ }
      );
    });
  });

  describe("Fallback Parser", () => {
    it("should use fallback when LLM fails", async () => {
      // This will use fallback since we're not mocking the LLM
      const result = await parseQuery("simple test query");
      
      assert.ok(result.mainTopic);
      assert.ok(result.searchQuery);
      assert.ok(Array.isArray(result.keywords));
    });

    it("should extract basic filters in fallback mode", async () => {
      const result = await parseQuery("RCT since 2020 with code");
      
      assert.strictEqual(result.filters.studyType, "rct");
      assert.strictEqual(result.filters.yearFrom, 2020);
      assert.strictEqual(result.filters.hasCode, true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long queries", async () => {
      const longQuery = "a ".repeat(500) + "machine learning";
      const result = await parseQuery(longQuery);
      
      assert.ok(result.mainTopic);
      assert.ok(result.searchQuery);
    });

    it("should handle queries with special characters", async () => {
      const result = await parseQuery("papers on C++ & Python (2020-2023)");
      
      assert.ok(result.mainTopic);
      assert.ok(result.searchQuery);
    });

    it("should handle queries in different languages", async () => {
      const result = await parseQuery("机器学习论文", { locale: "zh" });
      
      assert.ok(result.mainTopic);
      assert.ok(result.searchQuery);
    });

    it("should handle queries with numbers", async () => {
      const result = await parseQuery("COVID-19 studies in 2020-2021");
      
      assert.ok(result.mainTopic);
      if (result.filters.yearFrom) {
        assert.strictEqual(result.filters.yearFrom, 2020);
      }
    });

    it("should handle queries with abbreviations", async () => {
      const result = await parseQuery("NLP and CV papers");
      
      assert.ok(result.mainTopic);
      assert.ok(result.keywords.length > 0);
    });
  });
});

// Made with Bob
