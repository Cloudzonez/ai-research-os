import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";

describe("Metadata Extractor", () => {
  let chatMock;

  before(async () => {
    // Mock deepseek chat function
    const deepseekModule = await import("../server/services/deepseek.js");
    chatMock = mock.method(deepseekModule, "chat", async () => ({
      content: JSON.stringify({
        studyType: "rct",
        sampleSize: 100,
        population: "humans",
        datasets: [{ name: "Test Dataset", description: "Test data" }],
        methodology: "Randomized controlled trial",
        hasCode: true,
        hasData: true
      })
    }));
  });

  describe("extractMetadata", () => {
    it("should extract metadata from paper abstract", async () => {
      const { extractMetadata } = await import("../server/services/search/metadataExtractor.js");
      
      const paper = {
        title: "Test Study",
        abstract: "This randomized controlled trial with n=100 participants evaluated the effectiveness of the intervention. Code and data are available on GitHub."
      };

      const metadata = await extractMetadata(paper);

      assert.ok(metadata);
      assert.strictEqual(metadata.studyType, "rct");
      assert.strictEqual(metadata.sampleSize, 100);
      assert.strictEqual(metadata.population, "humans");
      assert.strictEqual(metadata.hasCode, true);
      assert.strictEqual(metadata.hasData, true);
    });

    it("should return null for papers without abstract", async () => {
      const { extractMetadata } = await import("../server/services/search/metadataExtractor.js");
      
      const paper = { title: "Test", abstract: "" };
      const metadata = await extractMetadata(paper);

      assert.strictEqual(metadata, null);
    });

    it("should return null for short abstracts", async () => {
      const { extractMetadata } = await import("../server/services/search/metadataExtractor.js");
      
      const paper = { title: "Test", abstract: "Too short" };
      const metadata = await extractMetadata(paper);

      assert.strictEqual(metadata, null);
    });

    it("should handle LLM errors gracefully", async () => {
      const { extractMetadata } = await import("../server/services/search/metadataExtractor.js");
      
      // Make chat throw error
      chatMock.mock.mockImplementationOnce(async () => {
        throw new Error("LLM error");
      });

      const paper = {
        title: "Test",
        abstract: "This is a test abstract with sufficient length for processing."
      };

      const metadata = await extractMetadata(paper);
      assert.strictEqual(metadata, null);
    });

    it("should handle invalid JSON responses", async () => {
      const { extractMetadata } = await import("../server/services/search/metadataExtractor.js");
      
      chatMock.mock.mockImplementationOnce(async () => ({
        content: "Not valid JSON"
      }));

      const paper = {
        title: "Test",
        abstract: "This is a test abstract with sufficient length for processing."
      };

      const metadata = await extractMetadata(paper);
      assert.strictEqual(metadata, null);
    });

    it("should extract datasets array", async () => {
      const { extractMetadata } = await import("../server/services/search/metadataExtractor.js");
      
      chatMock.mock.mockImplementationOnce(async () => ({
        content: JSON.stringify({
          studyType: "experimental",
          datasets: [
            { name: "ImageNet", description: "Image classification dataset" },
            { name: "COCO", description: "Object detection dataset" }
          ],
          hasCode: true,
          hasData: true
        })
      }));

      const paper = {
        title: "Test",
        abstract: "We used ImageNet and COCO datasets for our experiments."
      };

      const metadata = await extractMetadata(paper);
      assert.ok(Array.isArray(metadata.datasets));
      assert.strictEqual(metadata.datasets.length, 2);
    });
  });

  describe("enrichPaperMetadata", () => {
    it("should enrich paper with extracted metadata", async () => {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const mongoose = await import("mongoose");
      
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await mongoose.default.connect(uri);

      try {
        const Paper = (await import("../server/models/Paper.js")).default;
        const { enrichPaperMetadata } = await import("../server/services/search/metadataExtractor.js");
        
        const paper = await Paper.create({
          title: "Test Paper",
          abstract: "This is a randomized controlled trial with n=100 participants.",
          year: 2023
        });

        const enriched = await enrichPaperMetadata(paper._id.toString());

        assert.ok(enriched.studyType);
        assert.ok(enriched.sampleSize);
        assert.ok(typeof enriched.codeAvailable === "boolean");
        assert.ok(typeof enriched.dataAvailable === "boolean");

        await Paper.deleteMany({});
      } finally {
        await mongoose.default.disconnect();
        await mongod.stop();
      }
    });

    it("should throw error for non-existent paper", async () => {
      const { enrichPaperMetadata } = await import("../server/services/search/metadataExtractor.js");
      
      await assert.rejects(
        async () => await enrichPaperMetadata("507f1f77bcf86cd799439011"),
        { message: "Paper not found" }
      );
    });
  });
});

// Made with Bob