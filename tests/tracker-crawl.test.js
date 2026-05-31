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

function captureLogger() {
  const entries = [];
  return {
    entries,
    logger: {
      info(message, details) {
        entries.push({ level: "info", message, details });
      },
      warn(message, details) {
        entries.push({ level: "warn", message, details });
      },
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

test("tracker spec accepts paperSearch academic provider aliases", () => {
  const spec = buildTrackerSpec("knowledge tracing", {
    locale: "en",
    aiText: JSON.stringify({
      name: "Knowledge Tracing",
      keywords: ["knowledge tracing"],
      sources: ["Semantic Scholar", "Crossref", "PubMed", "GitHub"],
    }),
  });

  assert.deepEqual(spec.sources, ["semantic_scholar", "crossref", "pubmed", "github"]);
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

test("tracker crawl logs phases and skips malformed records before storing", async () => {
  const store = memoryPaperStore();
  const { entries, logger } = captureLogger();

  const crawl = await crawlTrackerSpec({
    name: "Malformed Input Tracker",
    keywords: ["learning analytics"],
    sources: ["arxiv"],
  }, {
    logger,
    paperStore: store,
    searchers: {
      async arxiv() {
        return [
          { title: "", doi: "10.3000/missing-title" },
          { abstract: "No title here either." },
          { title: "Learning Analytics with Teacher Dashboards", doi: "10.3000/dashboard" },
        ];
      },
    },
  });

  assert.equal(crawl.paperCount, 1);
  assert.equal(store.papers.length, 1);
  assert.ok(entries.some((entry) => entry.message === "[trackerCrawl] crawl_start"));
  assert.ok(entries.some((entry) => entry.message === "[trackerCrawl] source_collection_complete"));
  assert.ok(entries.some((entry) =>
    entry.message === "[trackerCrawl] source_collection_complete" &&
    entry.details.skippedMissingTitle === 2
  ));
  assert.ok(entries.some((entry) => entry.message === "[trackerCrawl] crawl_complete"));
});

test("tracker crawl uses AI parser output and deduplicates parsed items", async () => {
  const store = memoryPaperStore();
  const rawBatchSeen = [];
  const parserOptionsSeen = [];

  const crawl = await crawlTrackerSpec({
    name: "AI Parsed Tracker",
    keywords: ["agent tutoring"],
    sources: ["arxiv", "openalex"],
  }, {
    locale: "en",
    paperStore: store,
    searchers: {
      async arxiv() {
        return [{ title: "Raw arXiv Item", doi: "10.4000/raw-arxiv" }];
      },
      async openalex() {
        return [{ title: "Raw OpenAlex Item", doi: "10.4000/raw-openalex" }];
      },
    },
    aiParserOptions: { strict: true },
    async aiParser(rawBatch, options) {
      rawBatchSeen.push(...rawBatch);
      parserOptionsSeen.push(options);
      return [
        {
          title: "Agent Tutoring Systems",
          doi: "10.4000/agent-tutoring",
          year: 2026,
          source: "arxiv",
          tags: ["AI parsed"],
          status: "triage_pending",
        },
        {
          title: "Agent Tutoring Systems",
          doi: "10.4000/agent-tutoring",
          year: 2026,
          source: "openalex",
          tags: ["AI parsed"],
          status: "triage_pending",
        },
        { title: "", doi: "10.4000/no-title" },
      ];
    },
  });

  assert.equal(rawBatchSeen.length, 2);
  assert.equal(parserOptionsSeen[0].strict, true);
  assert.equal(parserOptionsSeen[0].spec.name, "AI Parsed Tracker");
  assert.equal(crawl.paperCount, 1);
  assert.equal(crawl.newPaperCount, 1);
  assert.equal(store.papers.length, 1);
  assert.equal(store.papers[0].title, "Agent Tutoring Systems");
});

test("tracker crawl keeps papers when summary queueing fails", async () => {
  const store = memoryPaperStore();
  const { entries, logger } = captureLogger();

  const crawl = await crawlTrackerSpec({
    name: "Queue Failure Tracker",
    keywords: ["paper queue"],
    sources: ["arxiv"],
  }, {
    logger,
    paperStore: store,
    queueSummaries: true,
    async enqueueSummarization() {
      throw new Error("queue offline");
    },
    searchers: {
      async arxiv() {
        return [{ title: "Queueable Paper", doi: "10.5000/queueable" }];
      },
    },
  });

  assert.equal(crawl.paperCount, 1);
  assert.equal(crawl.newPaperCount, 1);
  assert.equal(store.papers.length, 1);
  assert.ok(entries.some((entry) =>
    entry.level === "warn" &&
    entry.message === "[trackerCrawl] summary_enqueue_failed" &&
    /queue offline/.test(entry.details.error)
  ));
});

test("tracker crawl reports PDF download failure without dropping crawled papers", async () => {
  const store = memoryPaperStore();
  const { entries, logger } = captureLogger();

  const crawl = await crawlTrackerSpec({
    name: "PDF Failure Tracker",
    keywords: ["open access"],
    sources: ["arxiv", "github"],
  }, {
    logger,
    locale: "en",
    paperStore: store,
    async pdfDownloader(items) {
      assert.equal(items.length, 1);
      assert.equal(items[0].paper.title, "Open Access Paper");
      throw new Error("storage unavailable");
    },
    searchers: {
      async arxiv() {
        return [{
          title: "Open Access Paper",
          doi: "10.6000/open-access",
          pdfUrl: "https://arxiv.org/pdf/2601.00001.pdf",
        }];
      },
      async github() {
        return [{
          title: "org/open-access-code",
          itemType: "repository",
          url: "https://github.com/org/open-access-code",
          pdfUrl: "https://arxiv.org/pdf/2601.00002.pdf",
        }];
      },
    },
  });

  assert.equal(crawl.paperCount, 2);
  assert.equal(crawl.newPaperCount, 2);
  assert.equal(crawl.pdfResults.failed, 1);
  assert.match(crawl.pdfResults.error, /storage unavailable/);
  assert.ok(entries.some((entry) =>
    entry.level === "warn" &&
    entry.message === "[trackerCrawl] pdf_download_failed"
  ));
});

test("tracker crawl handles missing keywords and invalid connector/parser results", async () => {
  const store = memoryPaperStore();
  const { entries, logger } = captureLogger();

  const crawl = await crawlTrackerSpec({
    name: "Spec Without Keywords",
    sources: ["arxiv", "openalex"],
  }, {
    logger,
    paperStore: store,
    searchers: {
      async arxiv() {
        return null;
      },
      async openalex() {
        return [{ title: "Raw Item", doi: "10.7000/raw" }];
      },
    },
    async aiParser() {
      return { title: "Not an array" };
    },
  });

  assert.match(crawl.query, /Spec|Without|Keywords/);
  assert.equal(crawl.paperCount, 0);
  assert.equal(crawl.newPaperCount, 0);
  assert.deepEqual(crawl.sources, ["arxiv", "openalex"]);
  assert.ok(entries.some((entry) =>
    entry.level === "warn" &&
    entry.message === "[trackerCrawl] source_result_invalid" &&
    entry.details.source === "arxiv"
  ));
  assert.ok(entries.some((entry) =>
    entry.level === "warn" &&
    entry.message === "[trackerCrawl] parse_result_invalid"
  ));
});

test("tracker crawl uses unified paperSearch providers by default for academic sources", async () => {
  const store = memoryPaperStore();
  const searchCalls = [];

  const crawl = await crawlTrackerSpec({
    name: "Semantic Scholar Tracker",
    keywords: ["agent tutoring"],
    sources: ["semantic_scholar"],
  }, {
    locale: "en",
    paperStore: store,
    searchService: {
      async search(params) {
        searchCalls.push(params);
        return {
          results: [{
            title: "Agent Tutoring with Retrieval",
            source: "semantic_scholar",
            sourceIds: { semanticScholar: "s2-paper-1" },
            doi: "10.8000/agent-tutoring",
            abstract: "A semantic scholar normalized result.",
            authors: ["A. Scholar"],
            year: 2026,
            citedByCount: 42,
            _score: 88,
          }],
          errors: [],
        };
      },
    },
  });

  assert.equal(searchCalls.length, 1);
  assert.match(searchCalls[0].query, /agent tutoring/);
  assert.equal(searchCalls[0].maxResults, 50);
  assert.deepEqual(searchCalls[0].providers, ["semantic_scholar"]);
  assert.equal(searchCalls[0].deduplicate, false);
  assert.equal(crawl.paperCount, 1);
  assert.equal(store.papers[0].source, "semantic_scholar");
  assert.equal(store.papers[0].sourceIds.semanticScholar, "s2-paper-1");
  assert.equal(store.papers[0].score, 88);
  assert.ok(store.papers[0].tags.includes("Semantic Scholar"));
});
