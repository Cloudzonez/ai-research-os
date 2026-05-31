import test from "node:test";
import assert from "node:assert/strict";
import { mockModel } from "./_helpers/mockMongooseModel.js";
import {
  buildTrackerSpec,
  crawlTrackerSpec,
  buildSearchQuery,
  createMongoosePaperStore,
} from "../server/services/trackerCrawl.js";

// ---------------------------------------------------------------------------
// Story 2: Create Tracker → Crawl Sources → Show Results
// Spec ref: docs/USER_STORIES.md Story 2
//
// Tests the tracker creation + crawl pipeline:
//   1. AI generates tracker spec from topic description
//   2. Tracker spec is parsed into keywords, sources, cadence
//   3. Multi-source crawl fetches papers, deduplicates, stores
//   4. Partial failures (one source down) don't block others
//   5. Crawl results include per-source stats and errors
// ---------------------------------------------------------------------------

// ─── Fixtures ──────────────────────────────────────────────────────

function rawArxivPaper(title, overrides = {}) {
  return {
    title,
    authors: ["Zhang Wei", "Li Ming"],
    abstract: `Abstract for ${title}: This paper explores novel approaches.`,
    doi: `10.1234/${title.toLowerCase().replace(/\s+/g, "-")}`,
    year: 2024,
    url: `https://arxiv.org/abs/${title.toLowerCase().replace(/\s+/g, "-")}`,
    ...overrides,
  };
}

function rawOpenAlexPaper(title, overrides = {}) {
  return {
    title,
    authors: ["Wang Fang"],
    abstract: `OpenAlex abstract for ${title}.`,
    doi: `10.5678/${title.toLowerCase().replace(/\s+/g, "-")}`,
    year: 2023,
    citedByCount: 15,
    ...overrides,
  };
}

// ─── buildTrackerSpec ──────────────────────────────────────────────

test("buildTrackerSpec parses AI JSON with keywords and sources", () => {
  const spec = buildTrackerSpec("multi-agent reinforcement learning", {
    locale: "en",
    aiText: JSON.stringify({
      name: "Multi-Agent RL Research",
      keywords: ["multi-agent", "reinforcement learning", "cooperation"],
      sources: ["arxiv", "openalex"],
      cadence: "Weekly",
    }),
  });

  assert.ok(spec.name.includes("Multi-Agent RL"));
  assert.ok(spec.keywords.includes("multi-agent"));
  assert.ok(spec.keywords.includes("reinforcement learning"));
  assert.ok(spec.keywords.includes("cooperation"));
  assert.deepEqual(spec.sources, ["arxiv", "openalex"]);
  assert.equal(spec.cadence, "Weekly");
  assert.ok(Array.isArray(spec.signals));
});

test("buildTrackerSpec uses topic as fallback when AI returns no JSON", () => {
  const spec = buildTrackerSpec("graph neural networks for drug discovery", {
    locale: "en",
    aiText: "Here is some unstructured text about GNNs...",
  });

  assert.ok(spec.name.length > 0);
  assert.ok(spec.keywords.length > 0);
  // Should extract keywords from topic
  assert.ok(spec.keywords.some((k) => k.toLowerCase().includes("graph")));
  // Should default to arxiv + openalex
  assert.deepEqual(spec.sources, ["arxiv", "openalex"]);
});

test("buildTrackerSpec defaults to Daily cadence when not specified", () => {
  const spec = buildTrackerSpec("quantum computing", {
    locale: "en",
    aiText: "",
  });

  assert.equal(spec.cadence, "Daily");
});

test("buildTrackerSpec filters stop words from keywords", () => {
  const spec = buildTrackerSpec("new research about the latest papers on AI", {
    locale: "en",
    aiText: "",
  });

  // Stop words like "new", "research", "about", "the", "latest", "papers", "on"
  // should be filtered out
  const stopWords = ["new", "research", "about", "the", "latest", "papers", "on"];
  for (const kw of spec.keywords) {
    assert.ok(!stopWords.includes(kw.toLowerCase()), `Stop word "${kw}" should be filtered`);
  }
  // But meaningful words should remain
  assert.ok(spec.keywords.some((k) => k.toLowerCase().includes("ai")));
});

test("buildTrackerSpec handles Chinese topic and locale", () => {
  const spec = buildTrackerSpec("多智能体强化学习在教育中的应用", {
    locale: "zh",
    aiText: JSON.stringify({
      name: "多智能体教育研究",
      keywords: ["多智能体", "强化学习", "教育"],
      sources: ["arxiv"],
      signals: ["新论文", "高相关"],
    }),
  });

  assert.ok(spec.name.includes("多智能体"));
  assert.equal(spec.cadence, "Daily"); // default
  assert.deepEqual(spec.sources, ["arxiv"]);
  assert.deepEqual(spec.signals, ["新论文", "高相关"]);
});

test("buildTrackerSpec normalizes unknown sources to defaults", () => {
  const spec = buildTrackerSpec("test topic", {
    locale: "en",
    aiText: JSON.stringify({
      sources: ["google", "baidu", "arxiv"],
    }),
  });

  // Only "arxiv" is supported; "google" and "baidu" are dropped
  assert.deepEqual(spec.sources, ["arxiv"]);
});

test("buildTrackerSpec handles empty aiText gracefully", () => {
  const spec = buildTrackerSpec("reinforcement learning", {
    locale: "en",
    aiText: "",
  });

  assert.ok(spec.name.length > 0);
  assert.ok(spec.keywords.length > 0);
  assert.deepEqual(spec.sources, ["arxiv", "openalex"]);
  assert.ok(Array.isArray(spec.signals));
});

test("buildTrackerSpec caps name at 60 characters", () => {
  const longTopic = "A".repeat(100);
  const spec = buildTrackerSpec(longTopic, { locale: "en", aiText: "" });
  assert.ok(spec.name.length <= 60);
});

test("buildTrackerSpec caps keywords at 8", () => {
  const spec = buildTrackerSpec("topic", {
    locale: "en",
    aiText: JSON.stringify({
      keywords: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"],
    }),
  });

  assert.ok(spec.keywords.length <= 8);
});

// ─── buildSearchQuery ──────────────────────────────────────────────

test("buildSearchQuery produces a non-empty search string from spec", () => {
  const spec = {
    name: "RL Research",
    keywords: ["reinforcement learning", "multi-agent", "cooperation", "education", "deep learning"],
    sources: ["arxiv"],
  };

  const query = buildSearchQuery(spec);
  assert.ok(query.length > 0);
  // Should contain meaningful keywords from the spec (not just stop words)
  assert.ok(
    query.includes("reinforcement") ||
    query.includes("learning") ||
    query.includes("multi-agent") ||
    query.includes("cooperation") ||
    query.includes("education")
  );
  // Query is built from keywords — should be a space-separated string
  assert.equal(typeof query, "string");
});

// ─── crawlTrackerSpec ──────────────────────────────────────────────

test("crawlTrackerSpec fetches from multiple sources and returns results", async () => {
  const searchers = {
    arxiv: async (query, max) => [
      rawArxivPaper("Multi-Agent Coordination in RL"),
      rawArxivPaper("Deep RL for Robot Navigation"),
    ],
    openalex: async (query, max) => [
      rawOpenAlexPaper("Cooperative Multi-Agent Learning"),
    ],
  };

  const paperStore = createMongoosePaperStore(mockModel([]));

  const result = await crawlTrackerSpec(
    { name: "Multi-Agent RL", keywords: ["multi-agent", "rl"], sources: ["arxiv", "openalex"] },
    { searchers, paperStore, maxResults: 5, locale: "en" }
  );

  // Phase 1: Both sources returned results
  assert.equal(result.paperCount, 3);
  assert.equal(result.newPaperCount, 3);
  assert.equal(result.sourceResults.length, 2);
  assert.equal(result.errors.length, 0);

  // Verify source-level stats
  const arxivResult = result.sourceResults.find((r) => r.source === "arxiv");
  assert.equal(arxivResult.count, 2);

  const openalexResult = result.sourceResults.find((r) => r.source === "openalex");
  assert.equal(openalexResult.count, 1);
});

test("crawlTrackerSpec handles partial source failures gracefully", async () => {
  const searchers = {
    arxiv: async () => {
      throw new Error("arXiv API timeout");
    },
    openalex: async (query, max) => [
      rawOpenAlexPaper("Cooperative Multi-Agent Learning"),
      rawOpenAlexPaper("RL in Education"),
    ],
  };

  const paperStore = createMongoosePaperStore(mockModel([]));

  const result = await crawlTrackerSpec(
    { name: "Multi-Agent RL", keywords: ["multi-agent"], sources: ["arxiv", "openalex"] },
    { searchers, paperStore, maxResults: 5, locale: "en" }
  );

  // OpenAlex succeeded even though arXiv failed
  assert.equal(result.paperCount, 2);
  assert.equal(result.newPaperCount, 2);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].source, "arxiv");
  assert.ok(result.errors[0].error.includes("timeout"));
});

test("crawlTrackerSpec deduplicates within the same crawl run", async () => {
  // Same paper appears from both sources (same title)
  const searchers = {
    arxiv: async () => [
      rawArxivPaper("Multi-Agent Coordination", { doi: "10.1234/multi-agent" }),
    ],
    openalex: async () => [
      rawOpenAlexPaper("Multi-Agent Coordination", { doi: "10.1234/multi-agent" }),
    ],
  };

  const paperStore = createMongoosePaperStore(mockModel([]));

  const result = await crawlTrackerSpec(
    { name: "Multi-Agent RL", keywords: ["multi-agent"], sources: ["arxiv", "openalex"] },
    { searchers, paperStore, maxResults: 5, locale: "en" }
  );

  // Same DOI should be deduplicated
  assert.equal(result.paperCount, 1);
  assert.equal(result.newPaperCount, 1);
});

test("crawlTrackerSpec detects duplicates across crawl runs", async () => {
  const existingPaper = {
    _id: "existing-1",
    title: "Multi-Agent Coordination in RL",
    doi: "10.1234/multi-agent",
  };

  const PaperModel = mockModel([existingPaper]);
  const paperStore = createMongoosePaperStore(PaperModel);

  const searchers = {
    arxiv: async () => [
      rawArxivPaper("Multi-Agent Coordination in RL", { doi: "10.1234/multi-agent" }),
    ],
    openalex: async () => [],
  };

  const result = await crawlTrackerSpec(
    { name: "Multi-Agent RL", keywords: ["multi-agent"], sources: ["arxiv", "openalex"] },
    { searchers, paperStore, maxResults: 5, locale: "en" }
  );

  // The paper already existed
  assert.equal(result.paperCount, 1);
  assert.equal(result.newPaperCount, 0); // no new papers

  // The returned paper should be marked as duplicate
});

test("crawlTrackerSpec returns empty results for unsupported sources", async () => {
  const searchers = {};
  const paperStore = createMongoosePaperStore(mockModel([]));

  const result = await crawlTrackerSpec(
    { name: "Test", keywords: ["test"], sources: ["unsupported-source"] },
    { searchers, paperStore, maxResults: 5, locale: "en" }
  );

  assert.equal(result.paperCount, 0);
  assert.ok(result.errors.length >= 1, "Should have at least one error for missing searchers");
  const errorSources = result.errors.map((e) => e.source);
  assert.ok(errorSources.includes("arxiv") || errorSources.includes("openalex"));
  const firstError = result.errors[0];
  assert.equal(firstError.error, "Source is not supported");
});

test("crawlTrackerSpec handles empty search results", async () => {
  const searchers = {
    arxiv: async () => [],
    openalex: async () => [],
  };

  const paperStore = createMongoosePaperStore(mockModel([]));

  const result = await crawlTrackerSpec(
    { name: "Niche Topic", keywords: ["obscure"], sources: ["arxiv", "openalex"] },
    { searchers, paperStore, maxResults: 5, locale: "en" }
  );

  assert.equal(result.paperCount, 0);
  assert.equal(result.newPaperCount, 0);
  assert.equal(result.errors.length, 0);
});

test("crawlTrackerSpec returns query used in crawl", async () => {
  const searchers = {
    arxiv: async () => [],
    openalex: async () => [],
  };

  const paperStore = createMongoosePaperStore(mockModel([]));

  const result = await crawlTrackerSpec(
    { name: "RL Research", keywords: ["reinforcement learning", "multi-agent", "deep rl", "policy gradient"], sources: ["arxiv"] },
    { searchers, paperStore, maxResults: 5, locale: "en" }
  );

  assert.ok(result.query.length > 0);
  assert.ok(result.query.includes("reinforcement learning"));
});

// ─── paperStore dedup behavior ─────────────────────────────────────

test("paperStore deduplicates by DOI", async () => {
  const doi = "10.1234/unique-paper";
  const PaperModel = mockModel([
    { _id: "existing", title: "Existing Paper", doi },
  ]);
  const store = createMongoosePaperStore(PaperModel);

  const duplicate = await store.findDuplicate({
    title: "Different Title",
    doi,
  });

  assert.ok(duplicate);
  assert.equal(duplicate._id, "existing");
});

test("paperStore deduplicates by DOI when DOI is present", async () => {
  const doi = "10.1234/multi-agent-coordination";
  const PaperModel = mockModel([
    {
      _id: "existing-doi",
      title: "Different Title Format",
      doi,
    },
  ]);
  const store = createMongoosePaperStore(PaperModel);

  // When DOI is present, the store checks by DOI first (simple exact match)
  const duplicate = await store.findDuplicate({
    title: "A Completely Different Title",
    doi,
  });

  assert.ok(duplicate);
  assert.equal(duplicate._id, "existing-doi");
});

test("paperStore returns null for items with no DOI and no matching title", async () => {
  const PaperModel = mockModel([
    {
      _id: "existing",
      title: "Some Unrelated Paper",
      doi: "10.9999/unrelated",
    },
  ]);
  const store = createMongoosePaperStore(PaperModel);

  const result = await store.findDuplicate({
    title: "A Brand New Paper Not in the Database",
    doi: "",
  });

  // No DOI match and no title match → null
  // Note: title-based dedup uses regex which requires real Mongoose
  assert.equal(result, null);
});

test("paperStore returns null when no duplicate found", async () => {
  const PaperModel = mockModel([
    { _id: "existing", title: "Completely Different Research", doi: "10.9999/other" },
  ]);
  const store = createMongoosePaperStore(PaperModel);

  const result = await store.findDuplicate({
    title: "A Brand New Paper Never Seen Before",
    doi: "10.9999/new-paper",
  });

  assert.equal(result, null);
});

// ─── Paper model stores crawled papers with correct fields ─────────

test("crawled papers are stored with correct source and tags", async () => {
  const PaperModel = mockModel([]);
  const paperStore = createMongoosePaperStore(PaperModel);

  const searchers = {
    arxiv: async () => [
      rawArxivPaper("Test Paper", {
        doi: "10.1234/test",
        authors: ["Author One"],
        year: 2024,
        abstract: "A test abstract.",
        url: "https://arxiv.org/abs/2401.00001",
      }),
    ],
    openalex: async () => [],
  };

  await crawlTrackerSpec(
    { name: "Test Tracker", keywords: ["test"], sources: ["arxiv", "openalex"] },
    { searchers, paperStore, maxResults: 5, locale: "en" }
  );

  const stored = await PaperModel.find({});
  assert.ok(stored.length >= 1);

  const paper = stored[0];
  assert.equal(paper.source, "arxiv");
  assert.equal(paper.sharing, "school");
  assert.ok(paper.tags.includes("arXiv"));
  assert.ok(paper.tags.includes("Tracker crawl"));
  assert.ok(paper.tags.includes("test"));
  assert.equal(paper.status, "triage_pending");
});
