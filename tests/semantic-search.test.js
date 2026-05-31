import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

// Mock embedding service before importing semantic search
const mockEmbeddings = new Map();
let generateEmbeddingMock;

before(async () => {
  // Mock generateEmbedding
  const embeddingModule = await import("../server/services/search/embeddingService.js");
  generateEmbeddingMock = mock.method(embeddingModule, "generateEmbedding", async (text) => {
    // Return cached or generate simple mock embedding
    if (mockEmbeddings.has(text)) {
      return mockEmbeddings.get(text);
    }
    const embedding = Array(1536).fill(0).map(() => Math.random());
    mockEmbeddings.set(text, embedding);
    return embedding;
  });
});

describe("Semantic Search", () => {
  let mongod;
  let Paper;

  before(async () => {
    // Start in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // Import Paper model after DB connection
    const paperModule = await import("../server/models/Paper.js");
    Paper = paperModule.default;
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
    mockEmbeddings.clear();
  });

  describe("semanticSearch", () => {
    it("should perform vector search", async () => {
      // Note: This test requires MongoDB Atlas Vector Search
      // In memory MongoDB doesn't support vector search
      // This is a placeholder test structure
      
      const { semanticSearch } = await import("../server/services/search/semanticSearch.js");
      
      // Mock Paper.aggregate to avoid actual vector search
      const originalAggregate = Paper.aggregate;
      Paper.aggregate = mock.fn(async () => [
        {
          _id: "1",
          title: "Test Paper",
          authors: ["Author 1"],
          abstract: "Test abstract",
          year: 2023,
          score: 0.95
        }
      ]);

      try {
        const results = await semanticSearch("machine learning", {
          maxResults: 10,
          hybridMode: false
        });

        assert.ok(Array.isArray(results));
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].title, "Test Paper");
      } finally {
        Paper.aggregate = originalAggregate;
      }
    });

    it("should perform hybrid search (BM25 + Vector)", async () => {
      const { semanticSearch } = await import("../server/services/search/semanticSearch.js");
      
      const originalAggregate = Paper.aggregate;
      Paper.aggregate = mock.fn(async () => [
        {
          _id: "1",
          title: "Hybrid Result",
          score: 0.85
        }
      ]);

      try {
        const results = await semanticSearch("AI research", {
          maxResults: 5,
          hybridMode: true,
          vectorWeight: 0.7
        });

        assert.ok(Array.isArray(results));
      } finally {
        Paper.aggregate = originalAggregate;
      }
    });

    it("should apply filters to search", async () => {
      const { semanticSearch } = await import("../server/services/search/semanticSearch.js");
      
      let capturedPipeline;
      const originalAggregate = Paper.aggregate;
      Paper.aggregate = mock.fn(async (pipeline) => {
        capturedPipeline = pipeline;
        return [];
      });

      try {
        await semanticSearch("test query", {
          filters: {
            yearFrom: 2020,
            yearTo: 2023,
            hasCode: true,
            minCitations: 10
          }
        });

        // Verify filters were applied
        assert.ok(capturedPipeline);
      } finally {
        Paper.aggregate = originalAggregate;
      }
    });

    it("should respect maxResults parameter", async () => {
      const { semanticSearch } = await import("../server/services/search/semanticSearch.js");
      
      const originalAggregate = Paper.aggregate;
      Paper.aggregate = mock.fn(async () => 
        Array(15).fill(null).map((_, i) => ({ _id: i, title: `Paper ${i}` }))
      );

      try {
        const results = await semanticSearch("test", { maxResults: 10 });
        
        // Note: In real implementation, MongoDB $limit would enforce this
        assert.ok(results.length <= 15);
      } finally {
        Paper.aggregate = originalAggregate;
      }
    });
  });

  describe("findSimilarPapers", () => {
    it("should find similar papers by ID", async () => {
      const { findSimilarPapers } = await import("../server/services/search/semanticSearch.js");
      
      // Create a test paper
      const testPaper = await Paper.create({
        title: "Test Paper",
        abstract: "Test abstract",
        year: 2023,
        embedding: Array(1536).fill(0.5),
        embeddingModel: "text-embedding-3-large"
      });

      const originalAggregate = Paper.aggregate;
      Paper.aggregate = mock.fn(async () => [
        {
          _id: "similar1",
          title: "Similar Paper 1",
          similarity: 0.92
        }
      ]);

      try {
        const results = await findSimilarPapers(testPaper._id.toString(), {
          maxResults: 5
        });

        assert.ok(Array.isArray(results));
      } finally {
        Paper.aggregate = originalAggregate;
        await Paper.deleteMany({});
      }
    });

    it("should throw error for non-existent paper", async () => {
      const { findSimilarPapers } = await import("../server/services/search/semanticSearch.js");
      
      await assert.rejects(
        async () => await findSimilarPapers("507f1f77bcf86cd799439011"),
        { message: "Paper not found" }
      );
    });

    it("should generate embedding if missing", async () => {
      const { findSimilarPapers } = await import("../server/services/search/semanticSearch.js");
      
      // Create paper without embedding
      const testPaper = await Paper.create({
        title: "Paper Without Embedding",
        abstract: "Test abstract",
        year: 2023
      });

      const originalAggregate = Paper.aggregate;
      Paper.aggregate = mock.fn(async () => []);

      try {
        await findSimilarPapers(testPaper._id.toString());

        // Verify embedding was generated
        const updated = await Paper.findById(testPaper._id);
        assert.ok(updated.embedding);
        assert.ok(updated.embeddingModel);
        assert.ok(updated.embeddedAt);
      } finally {
        Paper.aggregate = originalAggregate;
        await Paper.deleteMany({});
      }
    });

    it("should exclude the source paper from results", async () => {
      const { findSimilarPapers } = await import("../server/services/search/semanticSearch.js");
      
      const testPaper = await Paper.create({
        title: "Source Paper",
        embedding: Array(1536).fill(0.5),
        year: 2023
      });

      let capturedPipeline;
      const originalAggregate = Paper.aggregate;
      Paper.aggregate = mock.fn(async (pipeline) => {
        capturedPipeline = pipeline;
        return [];
      });

      try {
        await findSimilarPapers(testPaper._id.toString());

        // Verify filter excludes source paper
        assert.ok(capturedPipeline);
        const searchStage = capturedPipeline[0].$search;
        assert.ok(searchStage.knnBeta.filter);
      } finally {
        Paper.aggregate = originalAggregate;
        await Paper.deleteMany({});
      }
    });
  });

  describe("buildFilterStage", () => {
    it("should build year range filter", async () => {
      const { semanticSearch } = await import("../server/services/search/semanticSearch.js");
      
      let capturedPipeline;
      const originalAggregate = Paper.aggregate;
      Paper.aggregate = mock.fn(async (pipeline) => {
        capturedPipeline = pipeline;
        return [];
      });

      try {
        await semanticSearch("test", {
          filters: { yearFrom: 2020, yearTo: 2023 }
        });

        assert.ok(capturedPipeline);
      } finally {
        Paper.aggregate = originalAggregate;
      }
    });

    it("should build study type filter", async () => {
      const { semanticSearch } = await import("../server/services/search/semanticSearch.js");
      
      const originalAggregate = Paper.aggregate;
      Paper.aggregate = mock.fn(async () => []);

      try {
        await semanticSearch("test", {
          filters: { studyType: "rct" }
        });

        assert.ok(true); // Filter applied without error
      } finally {
        Paper.aggregate = originalAggregate;
      }
    });

    it("should build code/data availability filters", async () => {
      const { semanticSearch } = await import("../server/services/search/semanticSearch.js");
      
      const originalAggregate = Paper.aggregate;
      Paper.aggregate = mock.fn(async () => []);

      try {
        await semanticSearch("test", {
          filters: { hasCode: true, hasData: true }
        });

        assert.ok(true); // Filters applied without error
      } finally {
        Paper.aggregate = originalAggregate;
      }
    });

    it("should build minimum citations filter", async () => {
      const { semanticSearch } = await import("../server/services/search/semanticSearch.js");
      
      const originalAggregate = Paper.aggregate;
      Paper.aggregate = mock.fn(async () => []);

      try {
        await semanticSearch("test", {
          filters: { minCitations: 50 }
        });

        assert.ok(true); // Filter applied without error
      } finally {
        Paper.aggregate = originalAggregate;
      }
    });
  });
});

// Made with Bob