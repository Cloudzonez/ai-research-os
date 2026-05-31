import test from "node:test";
import assert from "node:assert/strict";
import { runAITriage } from "../server/services/aiTriage.js";

// ---------------------------------------------------------------------------
// aiTriage — AI batch triage for high-volume tracker crawls
// Spec ref: plan glittery-cuddling-puddle.md (AI Triage Engine)
// ---------------------------------------------------------------------------

function paperFixture(overrides = {}) {
  return {
    _id: `paper-${Math.random().toString(36).slice(2, 8)}`,
    title: "Test Paper",
    abstract: "An abstract about AI methods.",
    status: "triage_pending",
    triageRelevance: null,
    triageCategory: null,
    triageNovelty: null,
    triageReasoning: null,
    triagedAt: null,
    save() {
      // In-memory save for testing
      return Promise.resolve(this);
    },
    ...overrides,
  };
}

function paperModelFrom(fixtures) {
  const byId = new Map(fixtures.map((f) => [f._id, f]));
  return {
    async findById(id) {
      return byId.get(String(id)) || null;
    },
  };
}

// ─── Basic triage ──────────────────────────────────────────────────

test("runAITriage assigns relevance, category, novelty, reasoning to each paper", async () => {
  const papers = [
    paperFixture({ _id: "p1", title: "Multi-Agent RL for Education", abstract: "Applies MARL to classroom settings." }),
    paperFixture({ _id: "p2", title: "Quantum Computing Basics", abstract: "Introduction to qubits." }),
    paperFixture({ _id: "p3", title: "Deep RL in Robotics", abstract: "Using PPO for robot manipulation." }),
  ];
  const PaperModel = paperModelFrom(papers);

  const chatFn = async () => ({
    content: JSON.stringify({
      assessments: [
        { index: 1, relevance: 9, category: "application", novelty: "interesting", reasoning: "Directly applies MARL to education." },
        { index: 2, relevance: 1, category: "unrelated", novelty: "unknown", reasoning: "Not related to multi-agent RL." },
        { index: 3, relevance: 7, category: "method", novelty: "interesting", reasoning: "Uses RL for robotics control." },
      ],
    }),
    tokensUsed: 300,
    model: "deepseek-chat",
  });

  const result = await runAITriage(
    { name: "Multi-Agent RL", keywords: ["multi-agent", "rl"] },
    ["p1", "p2", "p3"],
    { PaperModel, chatFn }
  );

  // Summary stats
  assert.equal(result.totalCrawled, 3);
  assert.equal(result.triaged, 3);
  assert.equal(result.relevant, 2); // p1 (9) and p3 (7) >= 5
  assert.equal(result.breakthroughs, 0);

  // Paper updates
  assert.equal(papers[0].triageRelevance, 9);
  assert.equal(papers[0].triageCategory, "application");
  assert.equal(papers[0].triageNovelty, "interesting");
  assert.equal(papers[0].triageReasoning, "Directly applies MARL to education.");
  assert.equal(papers[0].status, "triaged");

  assert.equal(papers[1].triageRelevance, 1);
  assert.equal(papers[1].triageCategory, "unrelated");

  assert.equal(papers[2].triageRelevance, 7);
  assert.equal(papers[2].triageCategory, "method");
});

test("runAITriage handles breakthroughs correctly", async () => {
  const papers = [
    paperFixture({ _id: "b1", title: "Breakthrough Paper", abstract: "Revolutionary approach." }),
  ];
  const PaperModel = paperModelFrom(papers);

  const chatFn = async () => ({
    content: JSON.stringify({
      assessments: [
        { index: 1, relevance: 10, category: "method", novelty: "breakthrough", reasoning: "Could change the field." },
      ],
    }),
    tokensUsed: 100,
    model: "deepseek-chat",
  });

  const result = await runAITriage(
    { name: "AI Research", keywords: ["ai"] },
    ["b1"],
    { PaperModel, chatFn }
  );

  assert.equal(result.breakthroughs, 1);
  assert.equal(result.relevant, 1);
  assert.equal(papers[0].triageNovelty, "breakthrough");
});

// ─── Empty / edge cases ────────────────────────────────────────────

test("runAITriage returns zero stats for empty paper list", async () => {
  const PaperModel = paperModelFrom([]);
  const result = await runAITriage(
    { name: "Test" },
    [],
    { PaperModel }
  );

  assert.equal(result.totalCrawled, 0);
  assert.equal(result.triaged, 0);
  assert.equal(result.relevant, 0);
  assert.equal(result.breakthroughs, 0);
  assert.deepEqual(result.byCategory, {});
});

test("runAITriage skips papers that are not triage_pending", async () => {
  const papers = [
    paperFixture({ _id: "p1", status: "triaged" }), // already triaged
    paperFixture({ _id: "p2", status: "triage_pending" }),
  ];
  const PaperModel = paperModelFrom(papers);

  const chatFn = async () => ({
    content: JSON.stringify({
      assessments: [{ index: 1, relevance: 5, category: "theory", novelty: "incremental", reasoning: "OK." }],
    }),
    tokensUsed: 50,
    model: "deepseek-chat",
  });

  const result = await runAITriage(
    { name: "Test" },
    ["p1", "p2"],
    { PaperModel, chatFn }
  );

  // Only p2 was triaged (it's the only one with triage_pending status)
  assert.equal(result.triaged, 1);
  assert.equal(papers[0].status, "triaged"); // unchanged — was already triaged
  assert.equal(papers[1].status, "triaged"); // newly triaged
});

test("runAITriage throws if PaperModel is not provided", async () => {
  await assert.rejects(
    () => runAITriage({ name: "Test" }, ["p1"], {}),
    /PaperModel is required/
  );
});

// ─── Batch processing ──────────────────────────────────────────────

test("runAITriage processes papers in batches", async () => {
  const papers = Array.from({ length: 30 }, (_, i) =>
    paperFixture({
      _id: `batch-p${i}`,
      title: `Paper ${i}`,
      abstract: `Abstract for paper ${i}.`,
    })
  );
  const PaperModel = paperModelFrom(papers);

  let batchCount = 0;
  const chatFn = async () => {
    batchCount++;
    const batchAssessments = [];
    return {
      content: JSON.stringify({
        assessments: Array.from({ length: Math.min(25, 30) }, (_, i) => ({
          index: i + 1,
          relevance: 5 + (i % 5),
          category: "survey",
          novelty: "interesting",
          reasoning: `Paper ${i} is relevant.`,
        })),
      }),
      tokensUsed: 500,
      model: "deepseek-chat",
    };
  };

  const result = await runAITriage(
    { name: "Batch Test", keywords: ["test"] },
    papers.map((p) => p._id),
    { PaperModel, chatFn, batchSize: 25 }
  );

  // 30 papers in batches of 25 = 2 batches
  assert.ok(batchCount >= 2, `Expected >= 2 batches, got ${batchCount}`);
  assert.equal(result.triaged, 30);
});

// ─── Score clamping ────────────────────────────────────────────────

test("runAITriage clamps relevance scores to 0-10", async () => {
  const papers = [
    paperFixture({ _id: "c1", title: "High Score" }),
    paperFixture({ _id: "c2", title: "Low Score" }),
    paperFixture({ _id: "c3", title: "Weird Score" }),
  ];
  const PaperModel = paperModelFrom(papers);

  const chatFn = async () => ({
    content: JSON.stringify({
      assessments: [
        { index: 1, relevance: 15, category: "method", novelty: "breakthrough", reasoning: "x" },
        { index: 2, relevance: -3, category: "theory", novelty: "unknown", reasoning: "y" },
        { index: 3, relevance: "not a number", category: "application", novelty: "incremental", reasoning: "z" },
      ],
    }),
    tokensUsed: 100,
    model: "deepseek-chat",
  });

  await runAITriage(
    { name: "Clamp Test" },
    ["c1", "c2", "c3"],
    { PaperModel, chatFn }
  );

  assert.equal(papers[0].triageRelevance, 10);   // clamped to 10
  assert.equal(papers[1].triageRelevance, 0);     // clamped to 0
  assert.equal(papers[2].triageRelevance, 0);     // NaN → 0
});

// ─── Category and novelty normalization ────────────────────────────

test("runAITriage normalizes invalid categories to 'unrelated'", async () => {
  const papers = [paperFixture({ _id: "bad1", title: "Test" })];
  const PaperModel = paperModelFrom(papers);

  const chatFn = async () => ({
    content: JSON.stringify({
      assessments: [
        { index: 1, relevance: 5, category: "invalid_category", novelty: "groundbreaking", reasoning: "x" },
      ],
    }),
    tokensUsed: 50,
    model: "deepseek-chat",
  });

  await runAITriage(
    { name: "Normalize Test" },
    ["bad1"],
    { PaperModel, chatFn }
  );

  assert.equal(papers[0].triageCategory, "unrelated");
  assert.equal(papers[0].triageNovelty, "unknown");
});

// ─── Malformed AI responses ────────────────────────────────────────

test("runAITriage handles AI response without JSON gracefully", async () => {
  const papers = [paperFixture({ _id: "err1", title: "Test" })];
  const PaperModel = paperModelFrom(papers);

  const chatFn = async () => ({
    content: "Sorry, I cannot process this request right now.",
    tokensUsed: 20,
    model: "deepseek-chat",
  });

  const result = await runAITriage(
    { name: "Error Test" },
    ["err1"],
    { PaperModel, chatFn }
  );

  // Should fall back to default values without crashing
  assert.equal(result.triaged, 1);
  assert.equal(papers[0].status, "triaged");
  assert.equal(papers[0].triageCategory, "unrelated");
  assert.ok(papers[0].triageReasoning.includes("AI triage failed"));
});

test("runAITriage handles AI call throwing an error", async () => {
  const papers = [paperFixture({ _id: "err2", title: "Test" })];
  const PaperModel = paperModelFrom(papers);

  const chatFn = async () => {
    throw new Error("DeepSeek API timeout");
  };

  const result = await runAITriage(
    { name: "Error Test 2" },
    ["err2"],
    { PaperModel, chatFn }
  );

  // Should still mark papers as triaged with fallback values
  assert.equal(result.triaged, 1);
  assert.equal(papers[0].status, "triaged");
  assert.ok(papers[0].triageReasoning.includes("timeout"));
});

// ─── By-category tally ─────────────────────────────────────────────

test("runAITriage returns correct byCategory counts", async () => {
  const papers = [
    paperFixture({ _id: "cat1", title: "Method Paper" }),
    paperFixture({ _id: "cat2", title: "Method Paper 2" }),
    paperFixture({ _id: "cat3", title: "Application Paper" }),
    paperFixture({ _id: "cat4", title: "Theory Paper" }),
  ];
  const PaperModel = paperModelFrom(papers);

  const chatFn = async () => ({
    content: JSON.stringify({
      assessments: [
        { index: 1, relevance: 8, category: "method", novelty: "interesting", reasoning: "a" },
        { index: 2, relevance: 7, category: "method", novelty: "incremental", reasoning: "b" },
        { index: 3, relevance: 9, category: "application", novelty: "breakthrough", reasoning: "c" },
        { index: 4, relevance: 6, category: "theory", novelty: "interesting", reasoning: "d" },
      ],
    }),
    tokensUsed: 200,
    model: "deepseek-chat",
  });

  const result = await runAITriage(
    { name: "Category Test" },
    ["cat1", "cat2", "cat3", "cat4"],
    { PaperModel, chatFn }
  );

  assert.equal(result.byCategory["method"], 2);
  assert.equal(result.byCategory["application"], 1);
  assert.equal(result.byCategory["theory"], 1);
});
