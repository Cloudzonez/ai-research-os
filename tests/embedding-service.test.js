import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { generateEmbedding, batchGenerateEmbeddings, cosineSimilarity } from "../server/services/search/embeddingService.js";

// Mock cache and config
const mockCache = new Map();
const originalGetCache = global.getCache;
const originalSetCache = global.setCache;
const originalFetch = global.fetch;
const originalConfig = {};

before(async () => {
  // Mock cache functions
  global.getCache = async (key) => mockCache.get(key);
  global.setCache = async (key, value, ttl) => {
    mockCache.set(key, value);
    return true;
  };

  // Store original config
  const { config } = await import("../server/config.js");
  Object.assign(originalConfig, config);
  config.openaiApiKey = "test-key";
  config.embeddingModel = "text-embedding-3-large";
});

after(async () => {
  // Restore original functions
  global.getCache = originalGetCache;
  global.setCache = originalSetCache;
  global.fetch = originalFetch;
  mockCache.clear();
});

describe("Embedding Service", () => {
  describe("generateEmbedding", () => {
    it("should generate embedding for text", async () => {
      // Mock OpenAI API response
      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2, 0.3] }]
        })
      }));

      const embedding = await generateEmbedding("test text");
      
      assert.ok(Array.isArray(embedding));
      assert.strictEqual(embedding.length, 3);
      assert.strictEqual(embedding[0], 0.1);
    });

    it("should throw error for empty text", async () => {
      await assert.rejects(
        async () => await generateEmbedding(""),
        { message: "Text is required for embedding generation" }
      );
    });

    it("should throw error when API key not configured", async () => {
      const { config } = await import("../server/config.js");
      const originalKey = config.openaiApiKey;
      config.openaiApiKey = null;

      await assert.rejects(
        async () => await generateEmbedding("test"),
        { message: "OpenAI API key not configured" }
      );

      config.openaiApiKey = originalKey;
    });

    it("should use cached embedding if available", async () => {
      const cachedEmbedding = [0.5, 0.6, 0.7];
      const cacheKey = "embedding:text-embedding-3-large:test text for";
      mockCache.set(cacheKey, cachedEmbedding);

      const embedding = await generateEmbedding("test text for caching");
      
      assert.deepStrictEqual(embedding, cachedEmbedding);
    });

    it("should handle API errors gracefully", async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 429,
        text: async () => "Rate limit exceeded"
      }));

      await assert.rejects(
        async () => await generateEmbedding("test"),
        { message: /OpenAI API error: 429/ }
      );
    });

    it("should truncate long text to 8000 chars", async () => {
      const longText = "a".repeat(10000);
      let capturedInput;

      global.fetch = mock.fn(async (url, options) => {
        const body = JSON.parse(options.body);
        capturedInput = body.input;
        return {
          ok: true,
          json: async () => ({
            data: [{ embedding: [0.1, 0.2] }]
          })
        };
      });

      await generateEmbedding(longText);
      
      assert.strictEqual(capturedInput.length, 8000);
    });
  });

  describe("batchGenerateEmbeddings", () => {
    it("should generate embeddings for multiple texts", async () => {
      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.1, 0.2] },
            { embedding: [0.3, 0.4] }
          ]
        })
      }));

      const embeddings = await batchGenerateEmbeddings(["text1", "text2"]);
      
      assert.strictEqual(embeddings.length, 2);
      assert.deepStrictEqual(embeddings[0], [0.1, 0.2]);
      assert.deepStrictEqual(embeddings[1], [0.3, 0.4]);
    });

    it("should throw error for empty array", async () => {
      await assert.rejects(
        async () => await batchGenerateEmbeddings([]),
        { message: "Texts array is required" }
      );
    });

    it("should throw error for non-array input", async () => {
      await assert.rejects(
        async () => await batchGenerateEmbeddings("not an array"),
        { message: "Texts array is required" }
      );
    });

    it("should batch requests with custom batch size", async () => {
      let requestCount = 0;
      global.fetch = mock.fn(async () => {
        requestCount++;
        return {
          ok: true,
          json: async () => ({
            data: [
              { embedding: [0.1, 0.2] },
              { embedding: [0.3, 0.4] }
            ]
          })
        };
      });

      const texts = ["text1", "text2", "text3", "text4"];
      await batchGenerateEmbeddings(texts, { batchSize: 2 });
      
      assert.strictEqual(requestCount, 2); // 4 texts / 2 batch size = 2 requests
    });

    it("should handle batch failures gracefully", async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 500
      }));

      const embeddings = await batchGenerateEmbeddings(["text1", "text2"]);
      
      // Should return nulls for failed batch
      assert.strictEqual(embeddings.length, 2);
      assert.strictEqual(embeddings[0], null);
      assert.strictEqual(embeddings[1], null);
    });
  });

  describe("cosineSimilarity", () => {
    it("should calculate similarity between identical vectors", () => {
      const vec = [1, 2, 3];
      const similarity = cosineSimilarity(vec, vec);
      
      assert.ok(Math.abs(similarity - 1.0) < 0.0001); // Should be ~1.0
    });

    it("should calculate similarity between orthogonal vectors", () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const similarity = cosineSimilarity(vec1, vec2);
      
      assert.ok(Math.abs(similarity) < 0.0001); // Should be ~0.0
    });

    it("should calculate similarity between opposite vectors", () => {
      const vec1 = [1, 2, 3];
      const vec2 = [-1, -2, -3];
      const similarity = cosineSimilarity(vec1, vec2);
      
      assert.ok(Math.abs(similarity - (-1.0)) < 0.0001); // Should be ~-1.0
    });

    it("should throw error for mismatched vector lengths", () => {
      assert.throws(
        () => cosineSimilarity([1, 2], [1, 2, 3]),
        { message: "Invalid embeddings for similarity calculation" }
      );
    });

    it("should throw error for null vectors", () => {
      assert.throws(
        () => cosineSimilarity(null, [1, 2, 3]),
        { message: "Invalid embeddings for similarity calculation" }
      );
    });

    it("should calculate correct similarity for real-world example", () => {
      const vec1 = [0.5, 0.5, 0.5];
      const vec2 = [0.6, 0.4, 0.5];
      const similarity = cosineSimilarity(vec1, vec2);
      
      assert.ok(similarity > 0.9); // Should be high similarity
      assert.ok(similarity < 1.0); // But not identical
    });
  });
});

// Made with Bob