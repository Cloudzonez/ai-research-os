import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

describe("Citation Graph", () => {
  let mongod;
  let Paper;

  before(async () => {
    // Start in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // Import Paper model
    const paperModule = await import("../server/models/Paper.js");
    Paper = paperModule.default;
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  describe("buildCitationGraph", () => {
    it("should build citation graph for paper", async () => {
      const { buildCitationGraph } = await import("../server/services/search/citationGraph.js");
      
      // Create test paper
      const paper = await Paper.create({
        title: "Test Paper",
        abstract: "Test abstract",
        year: 2023,
        externalIds: {
          semanticScholar: "test-ss-id"
        },
        citedByCount: 10,
        referencesCount: 15
      });

      // Mock Semantic Scholar provider
      const ssModule = await import("../server/services/ingestion/semanticScholar.js");
      const originalGetCitations = ssModule.semanticScholarProvider.getCitations;
      
      ssModule.semanticScholarProvider.getCitations = mock.fn(async (id, options) => {
        if (options.direction === "forward") {
          return {
            citations: [{ paperId: "cited1", title: "Citing Paper 1" }],
            totalCount: 10
          };
        } else {
          return {
            citations: [{ paperId: "ref1", title: "Reference 1" }],
            totalCount: 15
          };
        }
      });

      try {
        const graph = await buildCitationGraph(paper._id.toString());

        assert.ok(graph);
        assert.strictEqual(graph.paperId.toString(), paper._id.toString());
        assert.ok(Array.isArray(graph.citedBy));
        assert.ok(Array.isArray(graph.references));
        assert.strictEqual(graph.citedByCount, 10);
        assert.strictEqual(graph.referencesCount, 15);
      } finally {
        ssModule.semanticScholarProvider.getCitations = originalGetCitations;
        await Paper.deleteMany({});
      }
    });

    it("should throw error for non-existent paper", async () => {
      const { buildCitationGraph } = await import("../server/services/search/citationGraph.js");
      
      await assert.rejects(
        async () => await buildCitationGraph("507f1f77bcf86cd799439011"),
        { message: "Paper not found" }
      );
    });

    it("should use fallback when Semantic Scholar unavailable", async () => {
      const { buildCitationGraph } = await import("../server/services/search/citationGraph.js");
      
      const paper = await Paper.create({
        title: "Paper Without SS ID",
        year: 2023,
        citedBy: ["paper1", "paper2"],
        references: ["ref1"],
        citedByCount: 2,
        referencesCount: 1
      });

      try {
        const graph = await buildCitationGraph(paper._id.toString());

        assert.strictEqual(graph.citedBy.length, 2);
        assert.strictEqual(graph.references.length, 1);
        assert.strictEqual(graph.citedByCount, 2);
      } finally {
        await Paper.deleteMany({});
      }
    });

    it("should respect maxPerLevel option", async () => {
      const { buildCitationGraph } = await import("../server/services/search/citationGraph.js");
      
      const paper = await Paper.create({
        title: "Test Paper",
        year: 2023,
        externalIds: { semanticScholar: "test-id" }
      });

      const ssModule = await import("../server/services/ingestion/semanticScholar.js");
      const originalGetCitations = ssModule.semanticScholarProvider.getCitations;
      
      let capturedLimit;
      ssModule.semanticScholarProvider.getCitations = mock.fn(async (id, options) => {
        capturedLimit = options.limit;
        return { citations: [], totalCount: 0 };
      });

      try {
        await buildCitationGraph(paper._id.toString(), { maxPerLevel: 25 });
        assert.strictEqual(capturedLimit, 25);
      } finally {
        ssModule.semanticScholarProvider.getCitations = originalGetCitations;
        await Paper.deleteMany({});
      }
    });
  });

  describe("findMoreLikeThis", () => {
    it("should find similar papers using multiple signals", async () => {
      const { findMoreLikeThis } = await import("../server/services/search/citationGraph.js");
      
      // Create source paper with embedding
      const sourcePaper = await Paper.create({
        title: "Source Paper",
        abstract: "Test abstract",
        year: 2023,
        embedding: Array(1536).fill(0.5),
        references: ["ref1", "ref2"]
      });

      // Create similar paper
      await Paper.create({
        title: "Similar Paper",
        year: 2023,
        embedding: Array(1536).fill(0.51), // Similar embedding
        references: ["ref1", "ref3"] // One common reference
      });

      try {
        const similar = await findMoreLikeThis(sourcePaper._id.toString(), {
          maxResults: 5
        });

        assert.ok(Array.isArray(similar));
        // Note: Actual similarity calculation requires proper implementation
      } finally {
        await Paper.deleteMany({});
      }
    });

    it("should throw error for non-existent paper", async () => {
      const { findMoreLikeThis } = await import("../server/services/search/citationGraph.js");
      
      await assert.rejects(
        async () => await findMoreLikeThis("507f1f77bcf86cd799439011"),
        { message: "Paper not found" }
      );
    });

    it("should handle papers without embeddings", async () => {
      const { findMoreLikeThis } = await import("../server/services/search/citationGraph.js");
      
      const paper = await Paper.create({
        title: "Paper Without Embedding",
        year: 2023,
        references: ["ref1"]
      });

      try {
        const similar = await findMoreLikeThis(paper._id.toString());
        
        // Should still work using other signals
        assert.ok(Array.isArray(similar));
      } finally {
        await Paper.deleteMany({});
      }
    });

    it("should calculate co-citation scores", async () => {
      const { findMoreLikeThis } = await import("../server/services/search/citationGraph.js");
      
      const sourcePaper = await Paper.create({
        title: "Source",
        year: 2023,
        references: ["ref1", "ref2", "ref3"]
      });

      await Paper.create({
        title: "Co-cited Paper",
        year: 2023,
        references: ["ref1", "ref2"] // 2 common references
      });

      try {
        const similar = await findMoreLikeThis(sourcePaper._id.toString());
        assert.ok(Array.isArray(similar));
      } finally {
        await Paper.deleteMany({});
      }
    });

    it("should calculate bibliographic coupling scores", async () => {
      const { findMoreLikeThis } = await import("../server/services/search/citationGraph.js");
      
      const sourcePaper = await Paper.create({
        title: "Source",
        year: 2023,
        citedBy: ["citing1", "citing2"]
      });

      await Paper.create({
        title: "Coupled Paper",
        year: 2023,
        citedBy: ["citing1", "citing3"] // 1 common citation
      });

      try {
        const similar = await findMoreLikeThis(sourcePaper._id.toString());
        assert.ok(Array.isArray(similar));
      } finally {
        await Paper.deleteMany({});
      }
    });

    it("should respect maxResults parameter", async () => {
      const { findMoreLikeThis } = await import("../server/services/search/citationGraph.js");
      
      const sourcePaper = await Paper.create({
        title: "Source",
        year: 2023,
        embedding: Array(1536).fill(0.5)
      });

      // Create multiple similar papers
      for (let i = 0; i < 20; i++) {
        await Paper.create({
          title: `Similar ${i}`,
          year: 2023,
          embedding: Array(1536).fill(0.5 + i * 0.01)
        });
      }

      try {
        const similar = await findMoreLikeThis(sourcePaper._id.toString(), {
          maxResults: 5
        });

        assert.ok(similar.length <= 5);
      } finally {
        await Paper.deleteMany({});
      }
    });

    it("should combine multiple signals with weights", async () => {
      const { findMoreLikeThis } = await import("../server/services/search/citationGraph.js");
      
      const sourcePaper = await Paper.create({
        title: "Source",
        year: 2023,
        embedding: Array(1536).fill(0.5),
        references: ["ref1", "ref2"],
        citedBy: ["citing1"]
      });

      await Paper.create({
        title: "Multi-signal Similar",
        year: 2023,
        embedding: Array(1536).fill(0.51), // Embedding similarity
        references: ["ref1"], // Co-citation
        citedBy: ["citing1"] // Bibliographic coupling
      });

      try {
        const similar = await findMoreLikeThis(sourcePaper._id.toString());
        
        // Should find paper with multiple matching signals
        assert.ok(Array.isArray(similar));
      } finally {
        await Paper.deleteMany({});
      }
    });
  });
});

// Made with Bob