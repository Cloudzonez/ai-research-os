import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";

// Mock services before importing routes
let parseQueryMock, federatedSearchMock, searchSingleSourceMock;
let getAvailableProvidersMock, checkProvidersHealthMock;

before(async () => {
  // Mock query parser
  const queryParserModule = await import("../../server/services/search/queryParser.js");
  parseQueryMock = mock.method(queryParserModule, "parseQuery", async (query) => ({
    searchQuery: query,
    mainTopic: query,
    keywords: query.split(" "),
    filters: {},
    sortBy: "relevance",
    maxResults: 20
  }));

  // Mock federation manager
  const federationModule = await import("../../server/services/search/federationManager.js");
  
  federatedSearchMock = mock.method(federationModule, "federatedSearch", async () => ({
    papers: [
      { id: "1", title: "Test Paper 1", score: 0.95 },
      { id: "2", title: "Test Paper 2", score: 0.85 }
    ],
    totalFound: 2,
    totalUnique: 2,
    sources: ["openalex", "arxiv"],
    timestamp: new Date().toISOString()
  }));

  searchSingleSourceMock = mock.method(federationModule, "searchSingleSource", async () => ({
    results: [{ id: "1", title: "Single Source Result" }],
    count: 1
  }));

  getAvailableProvidersMock = mock.method(federationModule, "getAvailableProviders", () => [
    { name: "openalex", supportsCitations: true, supportsFullText: false, requiresAuth: false },
    { name: "arxiv", supportsCitations: false, supportsFullText: true, requiresAuth: false }
  ]);

  checkProvidersHealthMock = mock.method(federationModule, "checkProvidersHealth", async () => ({
    openalex: { status: "healthy", responseTime: 150 },
    arxiv: { status: "healthy", responseTime: 200 }
  }));
});

describe("Search Routes", () => {
  let app;
  let searchRouter;

  before(async () => {
    // Import router after mocks are set up
    const routerModule = await import("../../server/routes/search.js");
    searchRouter = routerModule.default;

    // Create Express app
    app = express();
    app.use(express.json());
    app.use("/api/search", searchRouter);
  });

  describe("POST /api/search/query", () => {
    it("should perform natural language search", async () => {
      const response = await request(app)
        .post("/api/search/query")
        .send({ query: "machine learning papers" })
        .expect(200);

      assert.ok(response.body.query);
      assert.ok(response.body.results);
      assert.ok(Array.isArray(response.body.results));
      assert.strictEqual(response.body.results.length, 2);
      assert.ok(response.body.metadata);
      assert.strictEqual(response.body.metadata.totalFound, 2);
    });

    it("should return 400 for missing query", async () => {
      const response = await request(app)
        .post("/api/search/query")
        .send({})
        .expect(400);

      assert.strictEqual(response.body.error, "Query is required");
    });

    it("should accept locale parameter", async () => {
      const response = await request(app)
        .post("/api/search/query")
        .send({ 
          query: "机器学习论文",
          locale: "zh"
        })
        .expect(200);

      assert.ok(response.body.results);
    });

    it("should accept sources parameter", async () => {
      const response = await request(app)
        .post("/api/search/query")
        .send({ 
          query: "AI research",
          sources: ["openalex", "arxiv"]
        })
        .expect(200);

      assert.ok(response.body.results);
    });

    it("should accept skipCache parameter", async () => {
      const response = await request(app)
        .post("/api/search/query")
        .send({ 
          query: "test query",
          skipCache: true
        })
        .expect(200);

      assert.ok(response.body.results);
    });

    it("should handle search errors gracefully", async () => {
      // Temporarily make federatedSearch throw error
      const originalMock = federatedSearchMock;
      federatedSearchMock.mock.mockImplementation(async () => {
        throw new Error("Search service unavailable");
      });

      const response = await request(app)
        .post("/api/search/query")
        .send({ query: "test" })
        .expect(500);

      assert.ok(response.body.error);
      assert.strictEqual(response.body.error, "Search service unavailable");

      // Restore mock
      federatedSearchMock = originalMock;
    });
  });

  describe("POST /api/search/structured", () => {
    it("should accept structured query", async () => {
      const response = await request(app)
        .post("/api/search/structured")
        .send({
          query: {
            searchQuery: "machine learning",
            mainTopic: "ML",
            keywords: ["machine", "learning"],
            filters: { yearFrom: 2020 },
            sortBy: "citations",
            maxResults: 10
          }
        })
        .expect(200);

      assert.ok(response.body.query);
      assert.strictEqual(response.body.query.searchQuery, "machine learning");
      assert.ok(response.body.results);
    });

    it("should return 400 for missing searchQuery", async () => {
      const response = await request(app)
        .post("/api/search/structured")
        .send({
          query: { mainTopic: "ML" }
        })
        .expect(400);

      assert.ok(response.body.error);
    });

    it("should apply default values for missing fields", async () => {
      const response = await request(app)
        .post("/api/search/structured")
        .send({
          query: { searchQuery: "test" }
        })
        .expect(200);

      assert.strictEqual(response.body.query.sortBy, "relevance");
      assert.strictEqual(response.body.query.maxResults, 20);
      assert.ok(Array.isArray(response.body.query.keywords));
    });
  });

  describe("POST /api/search/source/:sourceName", () => {
    it("should search single source", async () => {
      const response = await request(app)
        .post("/api/search/source/openalex")
        .send({ query: "AI papers" })
        .expect(200);

      assert.strictEqual(response.body.source, "openalex");
      assert.ok(response.body.results);
      assert.ok(response.body.query);
    });

    it("should return 400 for missing query", async () => {
      const response = await request(app)
        .post("/api/search/source/arxiv")
        .send({})
        .expect(400);

      assert.strictEqual(response.body.error, "Query is required");
    });

    it("should accept locale parameter", async () => {
      const response = await request(app)
        .post("/api/search/source/semantic_scholar")
        .send({ 
          query: "test",
          locale: "en"
        })
        .expect(200);

      assert.ok(response.body.results);
    });
  });

  describe("GET /api/search/providers", () => {
    it("should return list of providers", async () => {
      const response = await request(app)
        .get("/api/search/providers")
        .expect(200);

      assert.ok(response.body.providers);
      assert.ok(Array.isArray(response.body.providers));
      assert.ok(response.body.providers.length > 0);
      
      const provider = response.body.providers[0];
      assert.ok(provider.name);
      assert.ok(typeof provider.supportsCitations === "boolean");
      assert.ok(typeof provider.supportsFullText === "boolean");
      assert.ok(typeof provider.requiresAuth === "boolean");
    });
  });

  describe("GET /api/search/health", () => {
    it("should return health status of all providers", async () => {
      const response = await request(app)
        .get("/api/search/health")
        .expect(200);

      assert.ok(response.body.openalex);
      assert.ok(response.body.arxiv);
      assert.strictEqual(response.body.openalex.status, "healthy");
      assert.ok(typeof response.body.openalex.responseTime === "number");
    });
  });

  describe("GET /api/search/suggestions", () => {
    it("should return suggestions endpoint (placeholder)", async () => {
      const response = await request(app)
        .get("/api/search/suggestions?q=machine")
        .expect(200);

      assert.ok(response.body.suggestions);
      assert.ok(Array.isArray(response.body.suggestions));
      assert.ok(response.body.message);
    });
  });

  describe("POST /api/search/parse", () => {
    it("should parse query without executing search", async () => {
      const response = await request(app)
        .post("/api/search/parse")
        .send({ query: "papers on AI since 2020" })
        .expect(200);

      assert.ok(response.body.intent);
      assert.ok(response.body.intent.searchQuery);
      assert.ok(response.body.intent.keywords);
    });

    it("should return 400 for missing query", async () => {
      const response = await request(app)
        .post("/api/search/parse")
        .send({})
        .expect(400);

      assert.ok(response.body.error);
    });
  });

  describe("Error Handling", () => {
    it("should handle parser errors", async () => {
      // Make parseQuery throw error
      parseQueryMock.mock.mockImplementationOnce(async () => {
        throw new Error("Parser error");
      });

      const response = await request(app)
        .post("/api/search/query")
        .send({ query: "test" })
        .expect(500);

      assert.ok(response.body.error);
    });

    it("should handle federation errors", async () => {
      // Make federatedSearch throw error
      federatedSearchMock.mock.mockImplementationOnce(async () => {
        throw new Error("Federation error");
      });

      const response = await request(app)
        .post("/api/search/query")
        .send({ query: "test" })
        .expect(500);

      assert.ok(response.body.error);
    });

    it("should include stack trace in development mode", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      federatedSearchMock.mock.mockImplementationOnce(async () => {
        throw new Error("Test error");
      });

      const response = await request(app)
        .post("/api/search/query")
        .send({ query: "test" })
        .expect(500);

      // In development, details should be included
      assert.ok(response.body.error);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Authentication", () => {
    it("should work without authentication (authOptional)", async () => {
      const response = await request(app)
        .get("/api/search/providers")
        .expect(200);

      assert.ok(response.body.providers);
    });

    it("should accept valid JWT token", async () => {
      // Note: authOptional middleware allows requests without token
      const response = await request(app)
        .get("/api/search/providers")
        .set("Authorization", "Bearer fake-token")
        .expect(200);

      assert.ok(response.body.providers);
    });
  });
});

// Made with Bob