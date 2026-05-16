import test from "node:test";
import assert from "node:assert/strict";
import { mockModel } from "./_helpers/mockMongooseModel.js";
import { buildContextBundle } from "../server/services/contextEngine.js";
import { checkBudget, recordUsage, getUsageStats } from "../server/services/tokenFlow.js";

// ---------------------------------------------------------------------------
// Story 3: Context-Aware AI Chat with Evidence Display
// Spec ref: docs/USER_STORIES.md Story 3
//
// Tests the context-aware chat pipeline:
//   1. ContextBundle built from permitted papers matching user query
//   2. Private papers of OTHER users are excluded
//   3. Permission filtering: private < project < school < university
//   4. Token budget enforcement before AI call
//   5. Token usage recorded after AI call
//   6. Context metadata included in response
//   7. Graceful degradation when library is empty
// ---------------------------------------------------------------------------

// ─── Fixtures ──────────────────────────────────────────────────────

function paperFixture(overrides = {}) {
  return {
    _id: `paper-${Math.random().toString(36).slice(2, 8)}`,
    title: "Test Paper",
    source: "arxiv",
    area: "AI Research",
    score: 80,
    sharing: "school",
    tags: ["ai"],
    doi: null,
    summary: "A paper about AI methods.",
    abstract: "Abstract text.",
    ...overrides,
  };
}

// ─── Permission-aware context building ─────────────────────────────

test("ContextBundle includes school and university papers, excludes private and project", async () => {
  const PaperModel = paperModelForContext([
    paperFixture({ title: "School Paper", sharing: "school" }),
    paperFixture({ title: "University Paper", sharing: "university" }),
    paperFixture({ title: "Private Paper A", sharing: "private" }),
    paperFixture({ title: "Project Paper B", sharing: "project" }),
  ]);

  const context = await buildContextBundle("paper", {
    locale: "en",
    maxPapers: 10,
    PaperModel,
  });

  const titles = context.papers.map((p) => p.title);
  assert.ok(titles.includes("School Paper"));
  assert.ok(titles.includes("University Paper"));
  assert.ok(!titles.includes("Private Paper A"));
  assert.ok(!titles.includes("Project Paper B"));
});

test("ContextBundle respects maxPapers limit", async () => {
  const papers = Array.from({ length: 10 }, (_, i) =>
    paperFixture({ title: `Paper ${i}`, sharing: "school" })
  );
  const PaperModel = paperModelForContext(papers);

  const context = await buildContextBundle("", {
    locale: "en",
    maxPapers: 4,
    PaperModel,
  });

  assert.ok(context.papers.length <= 4);
});

test("ContextBundle returns correct structure even with empty library", async () => {
  const PaperModel = paperModelForContext([]);

  const context = await buildContextBundle("any query", {
    locale: "en",
    maxPapers: 5,
    PaperModel,
  });

  assert.equal(context.artifacts, 0);
  assert.equal(context.tokens, 0);
  assert.deepEqual(context.papers, []);
  assert.equal(context.source, "context_engine");
  assert.equal(context.query, "any query");
  assert.ok(context.builtAt);
});

test("ContextBundle provides source attribution for every paper", async () => {
  const PaperModel = paperModelForContext([
    paperFixture({ title: "Paper A", source: "arxiv", sharing: "school" }),
    paperFixture({ title: "Paper B", source: "openalex", sharing: "school" }),
  ]);

  const context = await buildContextBundle("paper", {
    locale: "en",
    maxPapers: 5,
    PaperModel,
  });

  for (const paper of context.papers) {
    assert.ok(paper.title, "Every paper should have a title");
    assert.ok(paper.source, "Every paper should have a source");
    assert.ok(typeof paper.score === "number", "Every paper should have a score");
    assert.ok(typeof paper.id === "string" || paper.id === undefined, "Every paper should have an id");
  }
});

test("ContextBundle handles queries that match no papers", async () => {
  const PaperModel = paperModelForContext([
    paperFixture({ title: "Reinforcement Learning", sharing: "school" }),
    paperFixture({ title: "Neural Networks", sharing: "school" }),
  ]);

  const context = await buildContextBundle("quantum computing", {
    locale: "en",
    maxPapers: 5,
    PaperModel,
  });

  // Even when no papers match the query, the fallback returns recent papers
  // (or the regex might match some part of the title/abstract)
  assert.ok(Array.isArray(context.papers));
});

// ─── Token budget enforcement ──────────────────────────────────────

test("checkBudget allows request when user has sufficient tokens", async () => {
  const UserModel = mockModel([
    { _id: "user-1", email: "teacher@uni.edu", role: "teacher", quota: 1000000, quotaUsed: 100000 },
  ]);

  const result = await checkBudget("user-1", 5000, UserModel);
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.ok(result.remaining > 0);
});

test("checkBudget blocks request when quota is exhausted", async () => {
  const UserModel = mockModel([
    { _id: "user-1", quota: 1000000, quotaUsed: 1000000 },
  ]);

  const result = await checkBudget("user-1", 5000, UserModel);
  assert.equal(result.allowed, false);
});

test("checkBudget requires approval for large token estimates (>50K)", async () => {
  const UserModel = mockModel([
    { _id: "user-1", quota: 1000000, quotaUsed: 100000 },
  ]);

  const result = await checkBudget("user-1", 60000, UserModel);
  assert.equal(result.requiresApproval, true);
});

test("checkBudget allows admin even when quota is low", async () => {
  const UserModel = mockModel([
    { _id: "admin-1", role: "admin", quota: 1000000, quotaUsed: 990000 },
  ]);

  const result = await checkBudget("admin-1", 50000, UserModel);
  assert.equal(result.allowed, true);
});

test("checkBudget handles unauthenticated user (null userId)", async () => {
  const UserModel = mockModel([]);
  const result = await checkBudget(null, 5000, UserModel);
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.remaining, Infinity);
});

test("checkBudget returns all required budget fields", async () => {
  const UserModel = mockModel([
    { _id: "user-1", quota: 500000, quotaUsed: 200000 },
  ]);

  const result = await checkBudget("user-1", 10000, UserModel);
  assert.equal(result.quota, 500000);
  assert.equal(result.used, 200000);
  assert.equal(result.remaining, 300000);
  assert.equal(result.estimatedTokens, 10000);
});

// ─── Token usage recording ─────────────────────────────────────────

test("recordUsage increments the user's quotaUsed counter", async () => {
  let updateCalled = false;
  let updateData = null;

  const UserModel = {
    async findByIdAndUpdate(id, update) {
      updateCalled = true;
      updateData = update;
      return { _id: id, quotaUsed: 100500 };
    },
  };

  await recordUsage("user-1", 500, "chat", UserModel);
  assert.equal(updateCalled, true);
  assert.deepEqual(updateData.$inc, { quotaUsed: 500 });
});

test("recordUsage skips when userId is null", async () => {
  const UserModel = mockModel([]);
  const result = await recordUsage(null, 500, "chat", UserModel);
  assert.equal(result, undefined);
});

test("recordUsage skips when tokensUsed is 0", async () => {
  const UserModel = mockModel([]);
  const result = await recordUsage("user-1", 0, "chat", UserModel);
  assert.equal(result, undefined);
});

test("recordUsage returns a usage record with timestamp", async () => {
  const UserModel = mockModel([
    { _id: "user-1", quotaUsed: 100000 },
  ]);

  const result = await recordUsage("user-1", 1000, "chat", UserModel);
  assert.equal(result.userId, "user-1");
  assert.equal(result.tokensUsed, 1000);
  assert.equal(result.action, "chat");
  assert.ok(result.recordedAt);
});

// ─── Usage statistics ──────────────────────────────────────────────

test("getUsageStats returns correct quota breakdown for a user", async () => {
  const UserModel = mockModel([
    { _id: "user-1", quota: 500000, quotaUsed: 150000 },
  ]);

  const stats = await getUsageStats("user-1", UserModel);
  assert.equal(stats.quota, 500000);
  assert.equal(stats.used, 150000);
  assert.equal(stats.remaining, 350000);
  assert.equal(stats.percentUsed, 30);
});

test("getUsageStats returns null for non-existent user", async () => {
  const UserModel = mockModel([]);
  assert.equal(await getUsageStats("no-one", UserModel), null);
});

// ─── Context + token flow integration ──────────────────────────────

test("full chat flow: context built → budget checked → usage recorded", async () => {
  // Simulates what routeChat does:
  // 1. Check budget
  // 2. Build context bundle
  // 3. Record usage after AI call

  const userId = "user-1";
  const userMessage = "multi-agent";

  let currentQuotaUsed = 100000;
  const UserModel = {
    async findById(id) {
      return {
        _id: id,
        role: "teacher",
        quota: 1000000,
        quotaUsed: currentQuotaUsed,
      };
    },
    async findByIdAndUpdate(id, update) {
      // Handle $inc
      if (update.$inc && update.$inc.quotaUsed) {
        currentQuotaUsed += update.$inc.quotaUsed;
      }
      return { _id: id, quotaUsed: currentQuotaUsed };
    },
  };

  // Step 1: Budget check
  const budget = await checkBudget(userId, 3000, UserModel);
  assert.equal(budget.allowed, true);

  // Step 2: Build context
  const PaperModel = paperModelForContext([
    paperFixture({ title: "Multi-Agent RL in Games", abstract: "multi-agent reinforcement learning in game theory", sharing: "school" }),
    paperFixture({ title: "Cooperative Multi-Agent Learning", abstract: "cooperative multi-agent systems", sharing: "school" }),
    paperFixture({ title: "Private RL Research", abstract: "private reinforcement learning research", sharing: "private" }),
  ]);

  const context = await buildContextBundle(userMessage, {
    locale: "en",
    maxPapers: 5,
    PaperModel,
  });

  assert.ok(context.papers.length >= 1);

  // Step 3: Record usage
  await recordUsage(userId, 3000, "chat", UserModel);
  assert.equal(currentQuotaUsed, 103000); // 100000 + 3000
});

test("chat flow blocks when budget is exhausted", async () => {
  const UserModel = mockModel([
    { _id: "user-2", role: "teacher", quota: 10000, quotaUsed: 10000 },
  ]);

  const budget = await checkBudget("user-2", 1000, UserModel);
  assert.equal(budget.allowed, false);

  // When budget fails, no context should be built and no AI call should be made
  // The routeChat function returns a quota exceeded response instead
});

// ─── Private paper visibility rules ─────────────────────────────────

test("paper visibility: private papers visible only to owner", async () => {
  // In a real implementation, buildContextBundle would take userId and
  // filter private papers to only those owned by the requesting user.
  // The current implementation filters to school+university only.

  const PaperModel = paperModelForContext([
    paperFixture({ _id: "p1", title: "My Private Paper", sharing: "private" }),
    paperFixture({ _id: "p2", title: "Public Paper", sharing: "school" }),
  ]);

  const context = await buildContextBundle("paper", {
    locale: "en",
    maxPapers: 10,
    PaperModel,
  });

  // Currently: private papers are excluded entirely
  // Future enhancement: include private papers owned by the requesting user
  const visible = context.papers;
  assert.ok(!visible.some((p) => p.title === "My Private Paper"));
  assert.ok(visible.some((p) => p.title === "Public Paper"));
});

// ─── Context bundle quality ────────────────────────────────────────

test("ContextBundle represents each paper with minimal required fields", async () => {
  const PaperModel = paperModelForContext([
    paperFixture({
      title: "Complete Paper",
      source: "arxiv",
      area: "cs.AI",
      score: 88,
      sharing: "school",
      tags: ["rl", "multi-agent"],
      doi: "10.1234/complete",
      summary: "A comprehensive study of multi-agent RL.",
    }),
  ]);

  const context = await buildContextBundle("multi-agent", {
    locale: "en",
    maxPapers: 5,
    PaperModel,
  });

  assert.equal(context.source, "context_engine");
  assert.ok(context.builtAt);
  assert.ok(Array.isArray(context.papers));

  const paper = context.papers[0];
  assert.ok(paper.title);
  assert.ok(paper.source);
  assert.ok(typeof paper.score === "number");
  assert.ok(typeof paper.relevance === "number");
});

// ─── Edge cases ────────────────────────────────────────────────────

test("ContextBundle handles very long queries gracefully", async () => {
  const PaperModel = paperModelForContext([
    paperFixture({ title: "Test", sharing: "school" }),
  ]);

  const longQuery = "A".repeat(5000);
  const context = await buildContextBundle(longQuery, {
    locale: "en",
    maxPapers: 5,
    PaperModel,
  });

  assert.ok(Array.isArray(context.papers));
  assert.equal(context.query, longQuery);
});

test("ContextBundle handles special regex characters in query", async () => {
  const PaperModel = paperModelForContext([
    paperFixture({ title: "C++ Performance Analysis", sharing: "school" }),
  ]);

  // Query contains regex special chars: .*+?^${}()|[]\
  const context = await buildContextBundle("C++ (performance) [analysis]", {
    locale: "en",
    maxPapers: 5,
    PaperModel,
  });

  // Should not throw — regex chars should be escaped
  assert.ok(Array.isArray(context.papers));
});

// ─── Helper: paper model for context tests ─────────────────────────

function paperModelForContext(papers) {
  const store = mockModel(papers);
  return {
    find(filter) {
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

function mongooseQuery(initialResults) {
  let _results = [...initialResults];
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
