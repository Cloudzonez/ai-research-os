import test from "node:test";
import assert from "node:assert/strict";
import { mockModel } from "./_helpers/mockMongooseModel.js";
import { buildContextBundle } from "../server/services/contextEngine.js";
import { selectTierForQuery, TIERS, DEFAULT_TIER, MAX_CONTEXT_TOKENS } from "../server/services/contextTiers.js";

// ---------------------------------------------------------------------------
// contextTiers — Pyramid of Context tier selection, field inclusion,
//   token estimation, and budget enforcement
// Spec ref: plan glittery-cuddling-puddle.md
// ---------------------------------------------------------------------------

function paperFixture(overrides = {}) {
  return {
    _id: `paper-${Math.random().toString(36).slice(2, 8)}`,
    title: "Test Paper",
    source: "arxiv",
    area: "AI Research",
    score: 80,
    sharing: "school",
    tags: ["ai"],
    doi: "10.1234/test",
    summary: "A paper about AI methods and their applications in education.",
    abstract: "This paper explores AI methods for education.",
    authors: ["Zhang Wei"],
    year: 2024,
    text: "Full paper text. ".repeat(500), // ~2500 words
    contributions: "Novel RL-based tutoring approach with empirical validation.",
    methods: "Reinforcement learning with controlled A/B experiment.",
    limitations: "Limited geographic diversity and moderate sample size.",
    evidenceCards: [
      { claim: "RL improves learning outcomes by 23%", evidence: "500-student controlled trial, p<0.01", sourceSection: "Results" },
    ],
    ...overrides,
  };
}

function paperModelForContext(papers) {
  const store = mockModel(papers);
  return {
    find(filter) {
      let results = [...store.records];
      if (filter && filter.$text) throw new Error("Text search not supported in mock");
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
    findById(id) {
      return store.findById(id);
    },
  };
}

function mongooseQuery(results) {
  let _results = [...results];
  const query = {
    sort: () => query,
    limit: (n) => {
      _results = _results.slice(0, n);
      return query;
    },
    lean: () => query,
    then: (resolve) => resolve(_results),
  };
  return query;
}

// ─── selectTierForQuery ────────────────────────────────────────────

test("selectTierForQuery returns DEFAULT_TIER (1) for short/vague queries", () => {
  assert.equal(selectTierForQuery("hi"), 1);
  assert.equal(selectTierForQuery(""), 1);
  assert.equal(selectTierForQuery("a"), 1);
});

test("selectTierForQuery returns tier 0 for lookup/count queries", () => {
  assert.equal(selectTierForQuery("find papers about RL"), 0);
  assert.equal(selectTierForQuery("list all papers"), 0);
  assert.equal(selectTierForQuery("how many papers are there"), 0);
  assert.equal(selectTierForQuery("show me machine learning papers"), 0);
  assert.equal(selectTierForQuery("搜索强化学习论文"), 0);
});

test("selectTierForQuery returns tier 1 for what-is/abstract queries", () => {
  assert.equal(selectTierForQuery("what is this paper about"), 1);
  assert.equal(selectTierForQuery("give me an overview of the research"), 1);
  assert.equal(selectTierForQuery("描述一下这篇论文"), 1);
});

test("selectTierForQuery returns tier 2 for method/compare queries", () => {
  assert.equal(selectTierForQuery("compare the approaches in these papers"), 2);
  assert.equal(selectTierForQuery("what methods do they use"), 2);
  assert.equal(selectTierForQuery("analyze the limitations"), 2);
  assert.equal(selectTierForQuery("compare methods between papers"), 2);
});

test("selectTierForQuery returns tier 3 for evidence/claim queries", () => {
  assert.equal(selectTierForQuery("what evidence supports this claim"), 3);
  assert.equal(selectTierForQuery("verify the results"), 3);
  assert.equal(selectTierForQuery("cite the source"), 3);
  assert.equal(selectTierForQuery("有什么证据支撑这个结论"), 3);
});

test("selectTierForQuery returns tier 4 for deep review queries", () => {
  assert.equal(selectTierForQuery("write a related work section"), 4);
  assert.equal(selectTierForQuery("do a detailed literature review"), 4);
  assert.equal(selectTierForQuery("comprehensive analysis of this field"), 4);
  assert.equal(selectTierForQuery("写一份详细的文献综述"), 4);
});

test("selectTierForQuery returns tier 2 for long multi-sentence queries", () => {
  const longQuery = "I need to understand the current state of research in multi-agent reinforcement learning and how it compares to single-agent approaches in terms of scalability and sample efficiency";
  assert.equal(selectTierForQuery(longQuery), 2);
});

// ─── buildContextBundle tier-aware field inclusion ──────────────────

test("buildContextBundle tier=0 returns only metadata fields", async () => {
  const PaperModel = paperModelForContext([
    paperFixture({ title: "RL Paper", abstract: "An abstract about RL.", summary: "A summary." }),
  ]);

  const context = await buildContextBundle("RL", {
    locale: "en", maxPapers: 5, tier: 0, PaperModel,
    chatFn: async () => ({ content: "{}", tokensUsed: 0, model: "mock" }),
  });

  assert.equal(context.tier, 0);
  assert.equal(context.tierLabel, "metadata");
  const paper = context.papers[0];
  assert.ok(paper.title);
  assert.ok(paper.authors);
  assert.equal(paper.abstract, undefined);    // Tier 0: no abstract
  assert.equal(paper.contributions, undefined); // Tier 0: no contributions
  assert.equal(paper.methods, undefined);       // Tier 0: no methods
});

test("buildContextBundle tier=1 includes abstract", async () => {
  const PaperModel = paperModelForContext([
    paperFixture({ title: "RL Paper", abstract: "An abstract about RL." }),
  ]);

  const context = await buildContextBundle("RL", {
    locale: "en", maxPapers: 5, tier: 1, PaperModel,
    chatFn: async () => ({ content: "{}", tokensUsed: 0, model: "mock" }),
  });

  assert.equal(context.tier, 1);
  assert.equal(context.tierLabel, "abstract");
  const paper = context.papers[0];
  assert.equal(paper.abstract, "An abstract about RL.");
  assert.equal(paper.contributions, undefined); // Not at tier 1
});

test("buildContextBundle tier=2 includes structured summary fields", async () => {
  const PaperModel = paperModelForContext([paperFixture({})]);

  const context = await buildContextBundle("paper", {
    locale: "en", maxPapers: 5, tier: 2, PaperModel,
    chatFn: async () => ({ content: "{}", tokensUsed: 0, model: "mock" }),
  });

  assert.equal(context.tier, 2);
  assert.equal(context.tierLabel, "structured_summary");
  const paper = context.papers[0];
  assert.ok(paper.contributions.includes("Novel RL-based"));
  assert.ok(paper.methods.includes("Reinforcement learning"));
  assert.ok(paper.limitations.includes("geographic diversity"));
});

test("buildContextBundle tier=3 includes evidence cards", async () => {
  const PaperModel = paperModelForContext([paperFixture({})]);

  const context = await buildContextBundle("", {
    locale: "en", maxPapers: 5, tier: 3, PaperModel,
    chatFn: async () => ({ content: "{}", tokensUsed: 0, model: "mock" }),
  });

  assert.equal(context.tier, 3);
  assert.equal(context.tierLabel, "evidence_cards");
  const paper = context.papers[0];
  assert.ok(paper.evidenceCards);
  assert.equal(paper.evidenceCards.length, 1);
  assert.ok(paper.evidenceCards[0].claim.includes("23%"));
});

test("buildContextBundle tier=4 includes text chunks", async () => {
  const PaperModel = paperModelForContext([paperFixture({})]);

  const context = await buildContextBundle("", {
    locale: "en", maxPapers: 5, tier: 4, PaperModel,
    chatFn: async () => ({ content: "{}", tokensUsed: 0, model: "mock" }),
  });

  assert.equal(context.tier, 4);
  assert.equal(context.tierLabel, "chunked_full_text");
  const paper = context.papers[0];
  assert.ok(paper.textChunks);
  assert.ok(paper.textChunks.length >= 1);
  assert.equal(paper.textChunkCount, paper.textChunks.length);
});

test("buildContextBundle auto-selects tier when tier is null", async () => {
  const PaperModel = paperModelForContext([paperFixture({})]);

  // "find papers" should select tier 0
  const context = await buildContextBundle("find papers about AI", {
    locale: "en", maxPapers: 5, tier: null, PaperModel,
    chatFn: async () => ({ content: "{}", tokensUsed: 0, model: "mock" }),
  });

  assert.equal(context.tier, 0);
});

// ─── Token estimation ──────────────────────────────────────────────

test("buildContextBundle estimates tokens per tier accurately", async () => {
  const PaperModel = paperModelForContext([paperFixture({})]);

  // Tier 0: ~metadata only
  const ctx0 = await buildContextBundle("paper", {
    locale: "en", maxPapers: 5, tier: 0, PaperModel,
    chatFn: async () => ({ content: "{}", tokensUsed: 0, model: "mock" }),
  });
  assert.ok(ctx0.tokens > 0);
  assert.ok(ctx0.tokens < 100); // ~50 tokens for 1 paper

  // Tier 1: + abstract
  const ctx1 = await buildContextBundle("paper", {
    locale: "en", maxPapers: 5, tier: 1, PaperModel,
    chatFn: async () => ({ content: "{}", tokensUsed: 0, model: "mock" }),
  });
  assert.ok(ctx1.tokens > ctx0.tokens);

  // Tier 2: + summary + contributions + methods + limitations
  const ctx2 = await buildContextBundle("paper", {
    locale: "en", maxPapers: 5, tier: 2, PaperModel,
    chatFn: async () => ({ content: "{}", tokensUsed: 0, model: "mock" }),
  });
  assert.ok(ctx2.tokens > ctx1.tokens);
});

test("buildContextBundle includes _estimatedTokens on each paper", async () => {
  const PaperModel = paperModelForContext([paperFixture({})]);

  const context = await buildContextBundle("paper", {
    locale: "en", maxPapers: 5, tier: 2, PaperModel,
    chatFn: async () => ({ content: "{}", tokensUsed: 0, model: "mock" }),
  });

  for (const paper of context.papers) {
    assert.ok(typeof paper._estimatedTokens === "number");
    assert.ok(paper._estimatedTokens > 0);
  }
});

// ─── MAX_CONTEXT_TOKENS enforcement ────────────────────────────────

test("buildContextBundle enforces MAX_CONTEXT_TOKENS by trimming papers", async () => {
  // Create many papers at tier 4 (3000 tokens each) — should exceed MAX_CONTEXT_TOKENS (8000)
  const papers = Array.from({ length: 10 }, (_, i) =>
    paperFixture({ title: `Paper ${i}`, text: "x".repeat(10000) })
  );
  const PaperModel = paperModelForContext(papers);

  const context = await buildContextBundle("", {
    locale: "en", maxPapers: 10, tier: 4, PaperModel,
    chatFn: async () => ({ content: "{}", tokensUsed: 0, model: "mock" }),
  });

  // Should have trimmed papers to fit within MAX_CONTEXT_TOKENS
  assert.ok(context.tokens <= MAX_CONTEXT_TOKENS + 500, `Expected <= ${MAX_CONTEXT_TOKENS + 500}, got ${context.tokens}`);
  assert.ok(context.papers.length < 10, `Expected < 10 papers after trimming, got ${context.papers.length}`);
});

test("buildContextBundle never trims below 1 paper", async () => {
  const PaperModel = paperModelForContext([paperFixture({ text: "x".repeat(100000) })]);

  const context = await buildContextBundle("paper", {
    locale: "en", maxPapers: 1, tier: 4, PaperModel,
    chatFn: async () => ({ content: "{}", tokensUsed: 0, model: "mock" }),
  });

  assert.ok(context.papers.length >= 1);
});

// ─── Context bundle metadata fields ────────────────────────────────

test("buildContextBundle returns tier metadata in bundle", async () => {
  const PaperModel = paperModelForContext([paperFixture({})]);

  const context = await buildContextBundle("paper", {
    locale: "en", maxPapers: 5, tier: 2, PaperModel,
    chatFn: async () => ({ content: "{}", tokensUsed: 0, model: "mock" }),
  });

  assert.equal(context.tier, 2);
  assert.equal(context.tierLabel, "structured_summary");
  assert.ok(typeof context.perPaperBudget === "number");
  assert.equal(context.source, "context_engine");
  assert.ok(context.builtAt);
  assert.ok(Array.isArray(context.papers));
});

// ─── TIERS configuration ───────────────────────────────────────────

test("TIERS has all 5 tiers defined", () => {
  for (let t = 0; t <= 4; t++) {
    assert.ok(TIERS[t], `Tier ${t} should be defined`);
    assert.ok(TIERS[t].label);
    assert.ok(Array.isArray(TIERS[t].fields));
    assert.ok(typeof TIERS[t].tokensPerPaper === "number");
  }
});

test("TIERS tokens per paper increases with each tier", () => {
  for (let t = 1; t <= 4; t++) {
    assert.ok(TIERS[t].tokensPerPaper >= TIERS[t - 1].tokensPerPaper);
  }
});

test("DEFAULT_TIER is a valid tier", () => {
  assert.ok(TIERS[DEFAULT_TIER]);
});
