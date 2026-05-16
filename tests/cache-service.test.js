import test from "node:test";
import assert from "node:assert/strict";
import cache from "../server/services/cache.js";

// ---------------------------------------------------------------------------
// MemoryCache — validates in-memory TTL cache behavior
// Spec ref: BUILD_PLAN.md Phase 4 "Cache stable outputs"
// ---------------------------------------------------------------------------

test("cache stores and retrieves a value within TTL", () => {
  cache.clear();
  cache.set("test-key", { data: "hello" }, 60000);
  const result = cache.get("test-key");
  assert.deepEqual(result, { data: "hello" });
});

test("cache returns undefined for missing keys", () => {
  cache.clear();
  const result = cache.get("nonexistent-key");
  assert.equal(result, undefined);
});

test("cache returns undefined for expired entries", async () => {
  cache.clear();
  cache.set("ephemeral", "value", 1); // 1ms TTL
  await new Promise((resolve) => setTimeout(resolve, 10));
  const result = cache.get("ephemeral");
  assert.equal(result, undefined);
});

test("cache.delete removes an entry", () => {
  cache.clear();
  cache.set("key-to-delete", "value", 60000);
  cache.delete("key-to-delete");
  assert.equal(cache.get("key-to-delete"), undefined);
});

test("cache.delete does not throw for missing key", () => {
  cache.clear();
  // Should not throw
  cache.delete("does-not-exist");
});

test("cache.clear removes all entries and resets stats", () => {
  cache.clear();
  cache.set("a", 1, 60000);
  cache.set("b", 2, 60000);
  cache.get("a"); // hit
  cache.get("c"); // miss

  cache.clear();

  // Check store directly to avoid triggering new misses
  assert.equal(cache.store.size, 0);
  const stats = cache.stats();
  assert.equal(stats.size, 0);
  assert.equal(stats.hits, 0);
  assert.equal(stats.misses, 0);
});

test("cache.stats tracks hits", () => {
  cache.clear();
  cache.set("hit-me", "data", 60000);
  cache.get("hit-me");
  cache.get("hit-me");

  const stats = cache.stats();
  assert.equal(stats.hits, 2);
  assert.equal(stats.misses, 0);
  assert.equal(stats.size, 1);
});

test("cache.stats tracks misses", () => {
  cache.clear();
  cache.get("missing-1");
  cache.get("missing-2");
  cache.get("missing-3");

  const stats = cache.stats();
  assert.equal(stats.hits, 0);
  assert.equal(stats.misses, 3);
});

test("cache.stats computes hit rate as percentage", () => {
  cache.clear();
  cache.set("x", 1, 60000);
  cache.get("x"); // hit
  cache.get("y"); // miss
  cache.get("z"); // miss

  const stats = cache.stats();
  // 1 hit out of 3 total = 33%
  assert.equal(stats.hitRate, 33);
});

test("cache.stats hit rate is 0 when no accesses", () => {
  cache.clear();
  const stats = cache.stats();
  assert.equal(stats.hitRate, 0);
});

test("cache.stats hit rate is 100 when all hits", () => {
  cache.clear();
  cache.set("x", 1, 60000);
  cache.get("x");

  assert.equal(cache.stats().hitRate, 100);
});

test("cache paperSummaryKey produces correct prefix", () => {
  const key = cache.paperSummaryKey("abc123");
  assert.equal(key, "summary:abc123");
});

test("cache paperClaimsKey produces correct prefix", () => {
  const key = cache.paperClaimsKey("def456");
  assert.equal(key, "claims:def456");
});

test("cache contextKey truncates long queries to 100 chars", () => {
  const longQuery = "a".repeat(200);
  const key = cache.contextKey(longQuery);
  assert.equal(key, "context:" + "a".repeat(100));
  assert.ok(key.length <= 108); // "context:" (8) + 100 chars max
});

test("cache contextKey handles short queries without truncation", () => {
  const key = cache.contextKey("short query");
  assert.equal(key, "context:short query");
});

test("cache.set uses default TTL of 1 hour", () => {
  cache.clear();
  cache.set("default-ttl", "value");
  // Should be retrievable immediately
  assert.equal(cache.get("default-ttl"), "value");
});

test("cache overwrites value for same key", () => {
  cache.clear();
  cache.set("key", "old", 60000);
  cache.set("key", "new", 60000);
  assert.equal(cache.get("key"), "new");
});

test("cache handles various data types", () => {
  cache.clear();
  cache.set("number", 42, 60000);
  cache.set("string", "hello", 60000);
  cache.set("object", { nested: { deep: true } }, 60000);
  cache.set("array", [1, 2, 3], 60000);
  cache.set("null", null, 60000);

  assert.equal(cache.get("number"), 42);
  assert.equal(cache.get("string"), "hello");
  assert.deepEqual(cache.get("object"), { nested: { deep: true } });
  assert.deepEqual(cache.get("array"), [1, 2, 3]);
  assert.equal(cache.get("null"), null);
});
