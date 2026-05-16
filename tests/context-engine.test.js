import test from "node:test";
import assert from "node:assert/strict";
import { buildContextBundle, getRelevantPapers } from "../server/services/contextEngine.js";
import { mockModel } from "./_helpers/mockMongooseModel.js";

// ---------------------------------------------------------------------------
// contextEngine — validates context bundle building with paper retrieval and
//   relevance ranking
// Spec ref: ARCHITECTURE.md "Context Engine", BUILD_PLAN.md Phase 4
// ---------------------------------------------------------------------------

function paperFixture(overrides = {}) {
  return {
    _id: `paper-${Math.random().toString(36).slice(2, 8)}`,
    title: "Test Paper",
    source: "arxiv",
    area: "AI Research",
    score: 80,
    sharing: "school",
    tags: ["ai", "research"],
    doi: "10.1234/test",
    summary: "A test paper summary.",
    abstract: "Abstract of the test paper.",
    ...overrides,
  };
}

// Mongoose-compatible chainable query mock.
// Mongoose .find() returns a Query synchronously (not a Promise).
// The Query supports .sort().limit().lean() chaining and is thenable.
function mongooseQuery(initialResults) {
  let _results = [...initialResults];

  const query = {
    sort: () => query,
    limit: (n) => {
      _results = _results.slice(0, n);
      return query;
    },
    lean: () => query, // lean() returns the query, which is then awaited
    then: (resolve) => resolve(_results),
  };
  return query;
}

function paperModelWith(papers) {
  const store = mockModel(papers);
  return {
    find(filter, projection) {
      let results = [...store.records];

      // $text search throws to trigger regex fallback
      if (filter && filter.$text) {
        throw new Error("Text search not supported in mock");
      }

      // Basic filtering for $or queries (regex fallback path)
      if (filter && filter.$or) {
        results = results.filter((r) =>
          filter.$or.some((clause) =>
            Object.entries(clause).some(([key, val]) => {
              if (val instanceof RegExp) return val.test(r[key] || "");
              return r[key] === val;
            })
          )
        );
      }

      return mongooseQuery(results);
    },
  };
}

test("buildContextBundle returns context with matching papers via regex fallback", async () => {
  const PaperModel = paperModelWith([
    paperFixture({ title: "Multi-Agent RL Paper", abstract: "About multi-agent systems.", sharing: "school" }),
    paperFixture({ title: "Unrelated Paper", abstract: "About something else.", sharing: "school" }),
  ]);

  const context = await buildContextBundle("multi-agent", {
    locale: "en",
    maxPapers: 5,
    PaperModel,
  });

  assert.ok(context.papers.length >= 1);
  assert.ok(context.papers.some((p) => p.title.includes("Multi-Agent")));
});

test("buildContextBundle filters out non-school/university papers", async () => {
  const PaperModel = paperModelWith([
    paperFixture({ title: "School Paper", sharing: "school" }),
    paperFixture({ title: "Private Paper", sharing: "private" }),
    paperFixture({ title: "Project Paper", sharing: "project" }),
    paperFixture({ title: "University Paper", sharing: "university" }),
  ]);

  const context = await buildContextBundle("paper", {
    locale: "en",
    maxPapers: 10,
    PaperModel,
  });

  const titles = context.papers.map((p) => p.title);
  assert.ok(titles.includes("School Paper"));
  assert.ok(titles.includes("University Paper"));
  assert.ok(!titles.includes("Private Paper"));
  assert.ok(!titles.includes("Project Paper"));
});

test("buildContextBundle returns recent papers when query is empty", async () => {
  const PaperModel = paperModelWith([
    paperFixture({ title: "Paper 1", sharing: "school" }),
    paperFixture({ title: "Paper 2", sharing: "school" }),
  ]);

  const context = await buildContextBundle("", {
    locale: "en",
    maxPapers: 5,
    PaperModel,
  });

  assert.ok(context.papers.length >= 1);
});

test("buildContextBundle prioritizes recent papers for just-crawled follow-up questions", async () => {
  const PaperModel = paperModelWith([
    paperFixture({ title: "Newest Crawled Paper", sharing: "school", createdAt: "2026-05-16T06:00:00.000Z" }),
    paperFixture({ title: "Older Matching RAG Paper", sharing: "school", abstract: "retrieval augmented generation", createdAt: "2026-05-15T06:00:00.000Z" }),
  ]);

  const context = await buildContextBundle("Please summarize the papers that were just crawled", {
    locale: "en",
    maxPapers: 1,
    PaperModel,
  });

  assert.deepEqual(context.papers.map((paper) => paper.title), ["Newest Crawled Paper"]);
});

test("buildContextBundle limits results to maxPapers", async () => {
  const papers = Array.from({ length: 10 }, (_, i) =>
    paperFixture({ title: `Paper ${i}`, sharing: "school" })
  );
  const PaperModel = paperModelWith(papers);

  const context = await buildContextBundle("", {
    locale: "en",
    maxPapers: 3,
    PaperModel,
  });

  assert.ok(context.papers.length <= 3);
});

test("buildContextBundle returns correct structure fields", async () => {
  const PaperModel = paperModelWith([
    paperFixture({ title: "Test", sharing: "school" }),
  ]);

  const context = await buildContextBundle("test", {
    locale: "en",
    maxPapers: 5,
    PaperModel,
  });

  assert.ok(typeof context.tokens === "number");
  assert.ok(typeof context.artifacts === "number");
  assert.equal(context.source, "context_engine");
  assert.equal(context.query, "test");
  assert.ok(context.builtAt);
  assert.ok(Array.isArray(context.papers));
  assert.equal(context.allowedPercent, 100);

  if (context.papers.length > 0) {
    const paper = context.papers[0];
    assert.ok(paper.title);
    assert.ok(paper.source);
    assert.ok(typeof paper.score === "number");
    assert.ok(typeof paper.relevance === "number");
  }
});

test("buildContextBundle estimates tokens from paper content", async () => {
  const queryText = "AAAA";
  const PaperModel = paperModelWith([
    paperFixture({
      title: "AAAA" .repeat(25),
      summary: "BBBB".repeat(75),
      sharing: "school",
    }),
  ]);

  const context = await buildContextBundle(queryText, {
    locale: "en",
    maxPapers: 5,
    PaperModel,
  });

  // tokens should be roughly (100 + 300) / 3 ≈ 134
  assert.ok(context.tokens > 0);
});

test("buildContextBundle uses AI ranking when more papers than maxPapers", async () => {
  const queryText = "ranking";
  const papers = Array.from({ length: 8 }, (_, i) =>
    paperFixture({ title: `ranking Paper ${i}`, sharing: "school" })
  );
  const PaperModel = paperModelWith(papers);

  let aiCalled = false;
  const chatFn = async () => {
    aiCalled = true;
    return {
      content: JSON.stringify({ rankings: [0, 1, 2] }),
      tokensUsed: 50,
      model: "mock",
    };
  };

  const context = await buildContextBundle(queryText, {
    locale: "en",
    maxPapers: 3,
    PaperModel,
    chatFn,
  });

  assert.equal(aiCalled, true);
  assert.ok(context.papers.length <= 3);
});

test("buildContextBundle falls back to slice when AI ranking fails", async () => {
  const queryText = "fallback";
  const papers = Array.from({ length: 8 }, (_, i) =>
    paperFixture({ title: `fallback Paper ${i}`, sharing: "school" })
  );
  const PaperModel = paperModelWith(papers);

  const chatFn = async () => {
    throw new Error("AI unavailable");
  };

  const context = await buildContextBundle("test query", {
    locale: "en",
    maxPapers: 3,
    PaperModel,
    chatFn,
  });

  // Should still get results (first 3 papers by fallback slice)
  assert.ok(context.papers.length <= 3);
});

test("buildContextBundle does NOT call AI when papers <= maxPapers", async () => {
  const PaperModel = paperModelWith([
    paperFixture({ title: "No AI Needed", sharing: "school" }),
  ]);

  let aiCalled = false;
  const chatFn = async () => {
    aiCalled = true;
    return { content: "{}", tokensUsed: 0, model: "mock" };
  };

  // Use empty query to avoid regex filtering — returns all papers
  await buildContextBundle("", {
    locale: "en",
    maxPapers: 5,
    PaperModel,
    chatFn,
  });

  assert.equal(aiCalled, false);
});

test("getRelevantPapers returns papers array from context bundle", async () => {
  const PaperModel = paperModelWith([
    paperFixture({ title: "Relevant", sharing: "school" }),
  ]);

  const papers = await getRelevantPapers("relevant", "en", { PaperModel });
  assert.ok(Array.isArray(papers));
  assert.ok(papers.length >= 1);
});

test("buildContextBundle handles no matching papers gracefully", async () => {
  const PaperModel = paperModelWith([]);

  const context = await buildContextBundle("nonexistent", {
    locale: "en",
    maxPapers: 5,
    PaperModel,
  });

  assert.deepEqual(context.papers, []);
  assert.equal(context.artifacts, 0);
  assert.equal(context.tokens, 0);
});
