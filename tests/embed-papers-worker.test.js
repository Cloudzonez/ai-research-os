import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

describe("Embed Papers Worker", () => {
  let mongod;
  let Paper;
  let batchGenerateEmbeddingsMock;

  before(async () => {
    // Start in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // Import Paper model
    Paper = (await import("../server/models/Paper.js")).default;

    // Mock batchGenerateEmbeddings
    const embeddingModule = await import("../server/services/search/embeddingService.js");
    batchGenerateEmbeddingsMock = mock.method(
      embeddingModule,
      "batchGenerateEmbeddings",
      async (texts) => {
        // Return mock embeddings for each text
        return texts.map(() => Array(1536).fill(0.5));
      }
    );
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  describe("embedAllPapers", () => {
    it("should generate embeddings for papers without embeddings", async () => {
      const { embedAllPapers } = await import("../server/workers/embedPapers.js");
      
      // Create papers without embeddings
      await Paper.create([
        { title: "Paper 1", abstract: "Abstract 1", year: 2023 },
        { title: "Paper 2", abstract: "Abstract 2", year: 2023 },
        { title: "Paper 3", abstract: "Abstract 3", year: 2023 }
      ]);

      try {
        const result = await embedAllPapers();

        assert.ok(result);
        assert.strictEqual(result.processed, 3);
        assert.strictEqual(result.success, 3);
        assert.strictEqual(result.failed, 0);

        // Verify embeddings were saved
        const papers = await Paper.find({});
        for (const paper of papers) {
          assert.ok(paper.embedding);
          assert.ok(Array.isArray(paper.embedding));
          assert.strictEqual(paper.embeddingModel, "text-embedding-3-large");
          assert.ok(paper.embeddedAt);
        }
      } finally {
        await Paper.deleteMany({});
      }
    });

    it("should skip papers that already have embeddings", async () => {
      const { embedAllPapers } = await import("../server/workers/embedPapers.js");
      
      // Create papers with and without embeddings
      await Paper.create([
        { 
          title: "Paper 1", 
          abstract: "Abstract 1", 
          year: 2023,
          embedding: Array(1536).fill(0.5),
          embeddingModel: "text-embedding-3-large"
        },
        { title: "Paper 2", abstract: "Abstract 2", year: 2023 }
      ]);

      try {
        const result = await embedAllPapers();

        // Should only process the one without embedding
        assert.strictEqual(result.processed, 1);
        assert.strictEqual(result.success, 1);
      } finally {
        await Paper.deleteMany({});
      }
    });

    it("should return zero counts when no papers to embed", async () => {
      const { embedAllPapers } = await import("../server/workers/embedPapers.js");
      
      // Create papers that all have embeddings
      await Paper.create([
        { 
          title: "Paper 1", 
          year: 2023,
          embedding: Array(1536).fill(0.5)
        }
      ]);

      try {
        const result = await embedAllPapers();

        assert.strictEqual(result.processed, 0);
        assert.strictEqual(result.success, 0);
        assert.strictEqual(result.failed, 0);
      } finally {
        await Paper.deleteMany({});
      }
    });

    it("should handle papers without abstracts", async () => {
      const { embedAllPapers } = await import("../server/workers/embedPapers.js");
      
      await Paper.create([
        { title: "Paper Without Abstract", year: 2023 }
      ]);

      try {
        const result = await embedAllPapers();

        assert.strictEqual(result.processed, 1);
        assert.strictEqual(result.success, 1);

        const paper = await Paper.findOne({});
        assert.ok(paper.embedding);
      } finally {
        await Paper.deleteMany({});
      }
    });

    it("should truncate long texts to 8000 chars", async () => {
      const { embedAllPapers } = await import("../server/workers/embedPapers.js");
      
      const longAbstract = "a".repeat(10000);
      await Paper.create([
        { title: "Long Paper", abstract: longAbstract, year: 2023 }
      ]);

      let capturedTexts;
      batchGenerateEmbeddingsMock.mock.mockImplementationOnce(async (texts) => {
        capturedTexts = texts;
        return texts.map(() => Array(1536).fill(0.5));
      });

      try {
        await embedAllPapers();

        assert.ok(capturedTexts);
        assert.ok(capturedTexts[0].length <= 8000);
      } finally {
        await Paper.deleteMany({});
      }
    });

    it("should handle embedding generation failures", async () => {
      const { embedAllPapers } = await import("../server/workers/embedPapers.js");
      
      await Paper.create([
        { title: "Paper 1", abstract: "Abstract 1", year: 2023 },
        { title: "Paper 2", abstract: "Abstract 2", year: 2023 }
      ]);

      // Mock to return one success and one failure
      batchGenerateEmbeddingsMock.mock.mockImplementationOnce(async () => {
        return [Array(1536).fill(0.5), null]; // Second one failed
      });

      try {
        const result = await embedAllPapers();

        assert.strictEqual(result.processed, 2);
        assert.strictEqual(result.success, 1);
        assert.strictEqual(result.failed, 1);
      } finally {
        await Paper.deleteMany({});
      }
    });

    it("should process papers in batches of 1000", async () => {
      const { embedAllPapers } = await import("../server/workers/embedPapers.js");
      
      // Create 1500 papers (should only process first 1000)
      const papers = [];
      for (let i = 0; i < 1500; i++) {
        papers.push({
          title: `Paper ${i}`,
          abstract: `Abstract ${i}`,
          year: 2023
        });
      }
      await Paper.insertMany(papers);

      try {
        const result = await embedAllPapers();

        // Should only process 1000 (batch limit)
        assert.strictEqual(result.processed, 1000);
      } finally {
        await Paper.deleteMany({});
      }
    });

    it("should use bulkWrite for efficient updates", async () => {
      const { embedAllPapers } = await import("../server/workers/embedPapers.js");
      
      await Paper.create([
        { title: "Paper 1", abstract: "Abstract 1", year: 2023 },
        { title: "Paper 2", abstract: "Abstract 2", year: 2023 }
      ]);

      // Mock Paper.bulkWrite to verify it's called
      const originalBulkWrite = Paper.bulkWrite;
      let bulkWriteCalled = false;
      Paper.bulkWrite = mock.fn(async (operations) => {
        bulkWriteCalled = true;
        return originalBulkWrite.call(Paper, operations);
      });

      try {
        await embedAllPapers();

        assert.ok(bulkWriteCalled, "bulkWrite should be called for efficiency");
      } finally {
        Paper.bulkWrite = originalBulkWrite;
        await Paper.deleteMany({});
      }
    });

    it("should set embeddingModel and embeddedAt", async () => {
      const { embedAllPapers } = await import("../server/workers/embedPapers.js");
      
      await Paper.create([
        { title: "Paper 1", abstract: "Abstract 1", year: 2023 }
      ]);

      try {
        await embedAllPapers();

        const paper = await Paper.findOne({});
        assert.strictEqual(paper.embeddingModel, "text-embedding-3-large");
        assert.ok(paper.embeddedAt);
        assert.ok(paper.embeddedAt instanceof Date);
      } finally {
        await Paper.deleteMany({});
      }
    });

    it("should handle database errors gracefully", async () => {
      const { embedAllPapers } = await import("../server/workers/embedPapers.js");
      
      // Disconnect to cause error
      await mongoose.disconnect();

      await assert.rejects(
        async () => await embedAllPapers(),
        /MongoNotConnectedError|not connected/
      );

      // Reconnect for cleanup
      await mongoose.connect(mongod.getUri());
    });

    it("should log progress information", async () => {
      const { embedAllPapers } = await import("../server/workers/embedPapers.js");
      
      await Paper.create([
        { title: "Paper 1", abstract: "Abstract 1", year: 2023 }
      ]);

      // Capture console.log calls
      const originalLog = console.log;
      const logs = [];
      console.log = mock.fn((...args) => {
        logs.push(args.join(" "));
      });

      try {
        await embedAllPapers();

        // Verify logging occurred
        assert.ok(logs.some(log => log.includes("Starting paper embedding job")));
        assert.ok(logs.some(log => log.includes("Found") && log.includes("papers to embed")));
        assert.ok(logs.some(log => log.includes("Embedding complete")));
      } finally {
        console.log = originalLog;
        await Paper.deleteMany({});
      }
    });
  });

  describe("MongoDB Connection", () => {
    it("should connect to MongoDB if not connected", async () => {
      const { embedAllPapers } = await import("../server/workers/embedPapers.js");
      
      // Disconnect first
      await mongoose.disconnect();

      await Paper.create([
        { title: "Paper 1", abstract: "Abstract 1", year: 2023 }
      ]);

      try {
        // Should auto-connect
        const result = await embedAllPapers();
        assert.ok(result);
      } finally {
        await Paper.deleteMany({});
      }
    });
  });
});

// Made with Bob