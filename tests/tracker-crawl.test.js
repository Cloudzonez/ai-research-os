import test from "node:test";
import assert from "node:assert/strict";
import { buildTrackerSpec, crawlTrackerSpec } from "../server/services/trackerCrawl.js";

function memoryPaperStore(seed = []) {
  const papers = [...seed];
  return {
    papers,
    async findDuplicate(paper) {
      return papers.find((existing) => {
        if (paper.doi && existing.doi) return paper.doi === existing.doi;
        return existing.title.toLowerCase() === paper.title.toLowerCase();
      }) || null;
    },
    async create(paper) {
      const created = { ...paper, _id: `paper-${papers.length + 1}` };
      papers.push(created);
      return created;
    },
  };
}

test("tracker spec extracts useful keywords and normalizes sources without depending on AI", () => {
  const spec = buildTrackerSpec("Track latest papers about multi-agent reinforcement learning in education", {
    locale: "en",
    aiText: "not json",
  });

  assert.ok(spec.name.startsWith("Track latest papers about multi-agent"));
  assert.ok(spec.name.length <= 60);
  assert.deepEqual(spec.sources, ["arxiv", "openalex"]);
  assert.ok(spec.keywords.includes("multi-agent"));
  assert.ok(spec.keywords.includes("reinforcement"));
  assert.ok(spec.keywords.includes("education"));
});

test("tracker crawl queries academic sources, deduplicates papers, and persists useful records", async () => {
  const spec = buildTrackerSpec("multi-agent reinforcement learning education", {
    locale: "en",
    aiText: JSON.stringify({
      name: "MARL Education",
      keywords: ["multi-agent reinforcement learning", "education"],
      sources: ["arXiv", "OpenAlex"],
      signals: ["new methods"],
    }),
  });
  const store = memoryPaperStore();
  const searchCalls = [];

  const crawl = await crawlTrackerSpec(spec, {
    locale: "en",
    maxResults: 3,
    paperStore: store,
    searchers: {
      async arxiv(query, maxResults) {
        searchCalls.push({ source: "arxiv", query, maxResults });
        return [
          {
            title: "Multi-Agent Reinforcement Learning for Classroom Simulation",
            authors: ["A. Teacher"],
            abstract: "A classroom simulation paper.",
            doi: "10.1234/marl-classroom",
            year: 2026,
          },
        ];
      },
      async openalex(query, maxResults) {
        searchCalls.push({ source: "openalex", query, maxResults });
        return [
          {
            title: "Multi-Agent Reinforcement Learning for Classroom Simulation",
            authors: ["A. Teacher"],
            abstract: "Duplicate by DOI.",
            doi: "10.1234/marl-classroom",
            year: 2026,
            citedByCount: 20,
          },
          {
            title: "Teacher Feedback Agents in STEM Education",
            authors: ["B. Researcher"],
            abstract: "A useful education agent paper.",
            doi: "10.5678/feedback-agents",
            year: 2025,
            citedByCount: 12,
          },
        ];
      },
    },
  });

  assert.equal(searchCalls.length, 2);
  assert.equal(searchCalls[0].maxResults, 3);
  assert.match(searchCalls[0].query, /multi-agent reinforcement learning/);
  assert.equal(crawl.paperCount, 2);
  assert.equal(crawl.newPaperCount, 2);
  assert.equal(store.papers.length, 2);
  assert.deepEqual(store.papers.map((paper) => paper.source), ["arxiv", "openalex"]);
  assert.ok(store.papers.every((paper) => paper.tags.includes("Tracker crawl")));
});

test("tracker crawl returns duplicates as tracked papers without creating duplicate records", async () => {
  const store = memoryPaperStore([
    {
      _id: "existing-paper",
      title: "Existing Paper",
      authors: [],
      abstract: "",
      doi: "10.1000/existing",
      year: 2024,
      source: "arxiv",
      score: 75,
      tags: [],
    },
  ]);

  const crawl = await crawlTrackerSpec({
    name: "Existing Paper Tracker",
    keywords: ["existing paper"],
    sources: ["arxiv"],
  }, {
    paperStore: store,
    searchers: {
      async arxiv() {
        return [{ title: "Existing Paper", doi: "10.1000/existing", year: 2024 }];
      },
    },
  });

  assert.equal(crawl.paperCount, 1);
  assert.equal(crawl.newPaperCount, 0);
  assert.equal(store.papers.length, 1);
  assert.equal(crawl.papers[0].duplicate, true);
});

test("tracker crawl can persist GitHub repositories with repository metadata", async () => {
  const store = memoryPaperStore();

  const crawl = await crawlTrackerSpec({
    name: "RAG repository tracker",
    keywords: ["rag evaluation"],
    sources: ["github"],
  }, {
    locale: "en",
    paperStore: store,
    searchers: {
      async github() {
        return [{
          title: "org/rag-eval",
          abstract: "A toolkit for evaluating retrieval augmented generation systems.",
          url: "https://github.com/org/rag-eval",
          stars: 420,
          forks: 31,
          language: "TypeScript",
          itemType: "repository",
        }];
      },
    },
  });

  assert.equal(crawl.paperCount, 1);
  assert.equal(store.papers[0].source, "github");
  assert.equal(store.papers[0].itemType, "repository");
  assert.equal(store.papers[0].url, "https://github.com/org/rag-eval");
  assert.equal(store.papers[0].stars, 420);
  assert.ok(store.papers[0].tags.includes("repository"));
});

test("tracker crawl records source errors while keeping successful results", async () => {
  const store = memoryPaperStore();
  const crawl = await crawlTrackerSpec({
    name: "Partial Tracker",
    keywords: ["learning analytics"],
    sources: ["arxiv", "openalex"],
  }, {
    paperStore: store,
    searchers: {
      async arxiv() {
        throw new Error("rate limited");
      },
      async openalex() {
        return [{ title: "Learning Analytics Paper", doi: "10.2000/la", year: 2026 }];
      },
    },
  });

  assert.equal(crawl.paperCount, 1);
  assert.equal(crawl.errors.length, 1);
  assert.equal(crawl.errors[0].source, "arxiv");
  assert.match(crawl.errors[0].error, /rate limited/);
});
