import test from "node:test";
import assert from "node:assert/strict";
import { routeModelCall, getAvailableTiers } from "../server/services/modelMesh.js";

// ---------------------------------------------------------------------------
// modelMesh — validates tier-based model routing
// Spec ref: ARCHITECTURE.md "TokenFlow Engine", BUILD_PLAN.md Phase 4
// ---------------------------------------------------------------------------

test("routeModelCall returns small tier for classification tasks", () => {
  const result = routeModelCall("classification");
  assert.equal(result.tier, "small");
  assert.equal(result.maxTokens, 2048);
  assert.ok(result.model);
});

test("routeModelCall returns small tier for extraction", () => {
  const result = routeModelCall("extraction");
  assert.equal(result.tier, "small");
});

test("routeModelCall returns small tier for tagging", () => {
  const result = routeModelCall("tagging");
  assert.equal(result.tier, "small");
});

test("routeModelCall returns small tier for routing", () => {
  const result = routeModelCall("routing");
  assert.equal(result.tier, "small");
});

test("routeModelCall returns small tier for simple_summary", () => {
  const result = routeModelCall("simple_summary");
  assert.equal(result.tier, "small");
});

test("routeModelCall returns reasoning tier for complex_review", () => {
  const result = routeModelCall("complex_review");
  assert.equal(result.tier, "reasoning");
  assert.equal(result.maxTokens, 4096);
});

test("routeModelCall returns reasoning tier for method_comparison", () => {
  const result = routeModelCall("method_comparison");
  assert.equal(result.tier, "reasoning");
});

test("routeModelCall returns reasoning tier for experiment_design", () => {
  const result = routeModelCall("experiment_design");
  assert.equal(result.tier, "reasoning");
});

test("routeModelCall returns reasoning tier for grant_writing", () => {
  const result = routeModelCall("grant_writing");
  assert.equal(result.tier, "reasoning");
});

test("routeModelCall returns long_context tier for full_paper", () => {
  const result = routeModelCall("full_paper");
  assert.equal(result.tier, "long_context");
  assert.equal(result.maxTokens, 8192);
});

test("routeModelCall returns long_context tier for long_proposal", () => {
  const result = routeModelCall("long_proposal");
  assert.equal(result.tier, "long_context");
});

test("routeModelCall returns long_context tier for multi_round_review", () => {
  const result = routeModelCall("multi_round_review");
  assert.equal(result.tier, "long_context");
});

test("routeModelCall returns code tier for script_generation", () => {
  const result = routeModelCall("script_generation");
  assert.equal(result.tier, "code");
  assert.equal(result.maxTokens, 4096);
});

test("routeModelCall returns code tier for data_analysis", () => {
  const result = routeModelCall("data_analysis");
  assert.equal(result.tier, "code");
});

test("routeModelCall returns code tier for test_repair", () => {
  const result = routeModelCall("test_repair");
  assert.equal(result.tier, "code");
});

test("routeModelCall returns code tier for crawler_code", () => {
  const result = routeModelCall("crawler_code");
  assert.equal(result.tier, "code");
});

test("routeModelCall falls back to small for unknown task types", () => {
  const result = routeModelCall("nonexistent_task_type");
  assert.equal(result.tier, "small");
  assert.equal(result.maxTokens, 2048);
});

test("routeModelCall respects preferredTier when budget allows", () => {
  const result = routeModelCall("tagging", {
    preferredTier: "reasoning",
    budget: 1.0,
  });
  assert.equal(result.tier, "reasoning");
});

test("routeModelCall ignores preferredTier when budget insufficient", () => {
  // reasoning tier cost = 0.0005 * (4096/1000) = 0.002048
  // So budget of 0.001 should be insufficient
  const result = routeModelCall("tagging", {
    preferredTier: "reasoning",
    budget: 0.001,
  });
  // Should fall back to small tier which was found for "tagging"
  assert.equal(result.tier, "small");
});

test("routeModelCall returns correct estimatedCost", () => {
  const result = routeModelCall("classification");
  const expectedCost = 0.0001 * (2048 / 1000);
  assert.ok(Math.abs(result.estimatedCost - expectedCost) < 0.00001);
  assert.equal(result.costPer1K, 0.0001);
});

test("routeModelCall returns model and cost fields", () => {
  const result = routeModelCall("classification");
  assert.ok(typeof result.model === "string");
  assert.ok(typeof result.tier === "string");
  assert.ok(typeof result.maxTokens === "number");
  assert.ok(typeof result.estimatedCost === "number");
  assert.ok(typeof result.costPer1K === "number");
});

test("getAvailableTiers returns all 4 tiers", () => {
  const tiers = getAvailableTiers();
  assert.equal(tiers.length, 4);
  const names = tiers.map((t) => t.name).sort();
  assert.deepEqual(names, ["code", "long_context", "reasoning", "small"]);
});

test("getAvailableTiers each tier has required fields", () => {
  const tiers = getAvailableTiers();
  for (const tier of tiers) {
    assert.ok(tier.name, "tier must have a name");
    assert.ok(Array.isArray(tier.models), "tier must have models array");
    assert.ok(tier.models.length > 0, "tier must have at least one model");
    assert.ok(typeof tier.maxTokens === "number", "tier must have maxTokens");
    assert.ok(typeof tier.costPer1K === "number", "tier must have costPer1K");
    assert.ok(Array.isArray(tier.suitableFor), "tier must have suitableFor");
  }
});

test("getAvailableTiers small tier is suitable for classification and extraction", () => {
  const tiers = getAvailableTiers();
  const small = tiers.find((t) => t.name === "small");
  assert.ok(small.suitableFor.includes("classification"));
  assert.ok(small.suitableFor.includes("extraction"));
});
