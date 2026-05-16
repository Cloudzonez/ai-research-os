import test from "node:test";
import assert from "node:assert/strict";
import { checkBudget, recordUsage, getUsageStats, getAllUsageStats } from "../server/services/tokenFlow.js";
import { mockModel } from "./_helpers/mockMongooseModel.js";

// ---------------------------------------------------------------------------
// tokenFlow — validates token budget and quota management
// Spec ref: BUILD_PLAN.md Phase 4, ARCHITECTURE.md "TokenFlow Engine"
// ---------------------------------------------------------------------------

function userFixture(overrides = {}) {
  return {
    _id: "user-1",
    email: "teacher@university.edu",
    role: "teacher",
    quota: 1000000,
    quotaUsed: 100000,
    active: true,
    ...overrides,
  };
}

test("checkBudget returns allowed for user with sufficient quota", async () => {
  const UserModel = mockModel([userFixture()]);
  const result = await checkBudget("user-1", 5000, UserModel);
  assert.equal(result.allowed, true);
  assert.ok(result.remaining > 0);
  assert.equal(result.requiresApproval, false);
});

test("checkBudget returns disallowed when quota exceeded", async () => {
  const UserModel = mockModel([userFixture({ quotaUsed: 990000 })]);
  const result = await checkBudget("user-1", 50000, UserModel);
  assert.equal(result.allowed, false);
});

test("checkBudget returns allowed when remaining exactly equals estimate", async () => {
  const UserModel = mockModel([userFixture({ quotaUsed: 950000, quota: 1000000 })]);
  const result = await checkBudget("user-1", 50000, UserModel);
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 50000);
});

test("checkBudget returns requiresApproval for large token estimates", async () => {
  const UserModel = mockModel([userFixture()]);
  const result = await checkBudget("user-1", 60000, UserModel);
  assert.equal(result.requiresApproval, true);
});

test("checkBudget returns requiresApproval when remaining < estimate", async () => {
  const UserModel = mockModel([userFixture({ quotaUsed: 980000 })]);
  const result = await checkBudget("user-1", 50000, UserModel);
  assert.equal(result.requiresApproval, true);
});

test("checkBudget allows admin users regardless of quota", async () => {
  const UserModel = mockModel([userFixture({ role: "admin", quotaUsed: 1990000, quota: 2000000 })]);
  const result = await checkBudget("user-1", 50000, UserModel);
  assert.equal(result.allowed, true);
});

test("checkBudget handles null/undefined userId", async () => {
  const UserModel = mockModel([]);
  const result = await checkBudget(null, 5000, UserModel);
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, Infinity);
  assert.equal(result.requiresApproval, false);
});

test("checkBudget returns error for non-existent user", async () => {
  const UserModel = mockModel([]);
  const result = await checkBudget("nonexistent", 5000, UserModel);
  assert.equal(result.allowed, false);
  assert.ok(result.error);
});

test("checkBudget returns quota, used, remaining, estimatedTokens fields", async () => {
  const UserModel = mockModel([userFixture()]);
  const result = await checkBudget("user-1", 3000, UserModel);
  assert.ok(typeof result.quota === "number");
  assert.ok(typeof result.used === "number");
  assert.ok(typeof result.remaining === "number");
  assert.equal(result.estimatedTokens, 3000);
});

test("checkBudget applies DEFAULT_QUOTA when user has no quota set", async () => {
  const UserModel = mockModel([userFixture({ quota: undefined })]);
  const result = await checkBudget("user-1", 1000, UserModel);
  assert.equal(result.allowed, true);
  assert.ok(result.quota > 0);
});

test("recordUsage calls findByIdAndUpdate with $inc on quotaUsed", async () => {
  const calls = [];
  const UserModel = {
    async findByIdAndUpdate(id, update) {
      calls.push({ id, update });
      return { _id: id, quotaUsed: 100500 };
    },
  };
  await recordUsage("user-1", 500, "summarize_paper", UserModel);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, "user-1");
  assert.deepEqual(calls[0].update.$inc, { quotaUsed: 500 });
});

test("recordUsage skips when userId is null", async () => {
  const UserModel = mockModel([]);
  const result = await recordUsage(null, 500, "test", UserModel);
  assert.equal(result, undefined);
});

test("recordUsage skips when tokensUsed is 0", async () => {
  const UserModel = mockModel([userFixture()]);
  const result = await recordUsage("user-1", 0, "test", UserModel);
  assert.equal(result, undefined);
});

test("recordUsage returns action record", async () => {
  const UserModel = mockModel([userFixture()]);
  const result = await recordUsage("user-1", 1000, "summarize_paper", UserModel);
  assert.ok(result);
  assert.equal(result.userId, "user-1");
  assert.equal(result.tokensUsed, 1000);
  assert.equal(result.action, "summarize_paper");
  assert.ok(result.recordedAt);
});

test("getUsageStats returns quota stats for a user", async () => {
  const UserModel = mockModel([userFixture({ quota: 500000, quotaUsed: 200000 })]);
  const stats = await getUsageStats("user-1", UserModel);
  assert.equal(stats.quota, 500000);
  assert.equal(stats.used, 200000);
  assert.equal(stats.remaining, 300000);
  assert.equal(stats.percentUsed, 40);
});

test("getUsageStats returns 0 percentUsed when no usage", async () => {
  const UserModel = mockModel([userFixture({ quota: 1000000, quotaUsed: 0 })]);
  const stats = await getUsageStats("user-1", UserModel);
  assert.equal(stats.percentUsed, 0);
});

test("getUsageStats returns null for missing user", async () => {
  const UserModel = mockModel([]);
  const stats = await getUsageStats("nonexistent", UserModel);
  assert.equal(stats, null);
});

test("getAllUsageStats aggregates across all users", async () => {
  const UserModel = mockModel([
    userFixture({ _id: "u1", quota: 1000000, quotaUsed: 300000 }),
    userFixture({ _id: "u2", quota: 2000000, quotaUsed: 500000 }),
  ]);
  const stats = await getAllUsageStats(UserModel);
  assert.equal(stats.totalQuota, 3000000);
  assert.equal(stats.totalUsed, 800000);
  assert.equal(stats.remaining, 2200000);
  assert.equal(stats.userCount, 2);
});

test("getAllUsageStats returns 0 percentUsed when no users", async () => {
  const UserModel = mockModel([]);
  const stats = await getAllUsageStats(UserModel);
  assert.equal(stats.percentUsed, 0);
  assert.equal(stats.userCount, 0);
});
