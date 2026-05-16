import test from "node:test";
import assert from "node:assert/strict";
import { buildStandardCrawlerSpec, runStandardCrawler } from "../server/services/standardCrawler.js";

function memoryPaperStore(seed = []) {
  const records = [...seed];
  return {
    records,
    async findDuplicate(item) {
      return records.find((record) => {
        if (item.doi && record.doi) return item.doi === record.doi;
        return record.source === item.source && record.title === item.title;
      }) || null;
    },
    async create(item) {
      const created = { ...item, _id: `item-${records.length + 1}` };
      records.push(created);
      return created;
    },
  };
}

test("standard crawler spec uses AI suggestion as parameters, not generated code", () => {
  const spec = buildStandardCrawlerSpec("Find GitHub repositories for RAG evaluation", {
    aiText: JSON.stringify({
      name: "RAG evaluation repos",
      query: "rag evaluation benchmark",
      sources: ["github"],
      keywords: ["RAG", "evaluation", "benchmark"],
      maxResults: 7,
    }),
  });

  assert.equal(spec.mode, "standard");
  assert.equal(spec.query, "rag evaluation benchmark");
  assert.deepEqual(spec.sources, ["github"]);
  assert.equal(spec.maxResults, 7);
});

test("standard crawler runs maintained academic and GitHub connectors", async () => {
  const spec = buildStandardCrawlerSpec("multi agent education papers and github code", {
    aiText: JSON.stringify({
      query: "multi agent education",
      sources: ["arxiv", "openalex", "semantic_scholar", "github"],
      keywords: ["multi-agent", "education"],
      maxResults: 3,
    }),
  });
  const store = memoryPaperStore();
  const calls = [];

  const crawl = await runStandardCrawler(spec, {
    paperStore: store,
    connectors: {
      async arxiv(query, maxResults) {
        calls.push(["arxiv", query, maxResults]);
        return [{ title: "arXiv MARL Education", abstract: "Paper abstract from arXiv.", doi: "10.1/arxiv", pdfUrl: "https://arxiv.org/pdf/2601.00001", year: 2026 }];
      },
      async openalex(query, maxResults) {
        calls.push(["openalex", query, maxResults]);
        return [{ title: "OpenAlex MARL Education", abstract: "OpenAlex reconstructed abstract.", doi: "10.1/openalex", year: 2025, citedByCount: 30 }];
      },
      async semantic_scholar(query, maxResults) {
        calls.push(["semantic_scholar", query, maxResults]);
        return [{ title: "Semantic Scholar MARL Education", abstract: "Semantic Scholar abstract.", doi: "10.1/s2", year: 2024, citedByCount: 50 }];
      },
      async github(query, maxResults) {
        calls.push(["github", query, maxResults]);
        return [{ title: "org/marl-education", abstract: "code", url: "https://github.com/org/marl-education", stars: 1200, itemType: "repository" }];
      },
    },
  });

  assert.deepEqual(calls.map(([source]) => source), ["arxiv", "openalex", "semantic_scholar", "github"]);
  assert.ok(calls.every(([, query, maxResults]) => query === "multi agent education" && maxResults === 3));
  assert.equal(crawl.paperCount, 3);
  assert.equal(crawl.repositoryCount, 1);
  assert.equal(crawl.itemCount, 4);
  assert.equal(store.records.length, 4);
  assert.ok(store.records.some((record) => record.source === "github" && record.tags.includes("repository")));
  assert.ok(store.records.filter((record) => record.source !== "github").every((record) => record.abstract || record.doi));
});

test("standard crawler rejects paper hits without abstract, pdf, url, or DOI evidence", async () => {
  const store = memoryPaperStore();
  const spec = buildStandardCrawlerSpec("weak paper results", {
    sources: ["arxiv"],
    maxResults: 5,
  });

  const crawl = await runStandardCrawler(spec, {
    paperStore: store,
    connectors: {
      async arxiv() {
        return [
          { title: "Title Only Paper" },
          { title: "Useful Abstract Paper", abstract: "This is an actual abstract." },
          { title: "Useful PDF Paper", pdfUrl: "https://arxiv.org/pdf/2601.00001" },
        ];
      },
    },
  });

  assert.equal(crawl.paperCount, 2);
  assert.equal(crawl.sourceResults[0].fetched, 3);
  assert.equal(crawl.sourceResults[0].accepted, 2);
  assert.equal(crawl.sourceResults[0].rejected, 1);
  assert.deepEqual(store.records.map((record) => record.title), ["Useful Abstract Paper", "Useful PDF Paper"]);
});

test("standard crawler rejects GitHub hits without repository URL evidence", async () => {
  const store = memoryPaperStore();
  const spec = buildStandardCrawlerSpec("github rag repositories", {
    sources: ["github"],
    maxResults: 5,
  });

  const crawl = await runStandardCrawler(spec, {
    paperStore: store,
    connectors: {
      async github() {
        return [
          { title: "org/no-url", abstract: "Missing URL", itemType: "repository" },
          { title: "org/real-url", url: "https://github.com/org/real-url", stars: 12, itemType: "repository" },
        ];
      },
    },
  });

  assert.equal(crawl.repositoryCount, 1);
  assert.equal(crawl.sourceResults[0].rejected, 1);
  assert.equal(store.records[0].title, "org/real-url");
});

test("standard crawler records partial source failures without discarding successful sources", async () => {
  const spec = buildStandardCrawlerSpec("learning analytics", {
    sources: ["arxiv", "github"],
    maxResults: 2,
  });
  const crawl = await runStandardCrawler(spec, {
    paperStore: memoryPaperStore(),
    connectors: {
      async arxiv() {
        throw new Error("rate limited");
      },
      async github() {
        return [{ title: "org/learning-analytics", url: "https://github.com/org/learning-analytics", itemType: "repository" }];
      },
    },
  });

  assert.equal(crawl.errors.length, 1);
  assert.equal(crawl.errors[0].source, "arxiv");
  assert.equal(crawl.repositoryCount, 1);
  assert.equal(crawl.itemCount, 1);
});
