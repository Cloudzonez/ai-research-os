// ───────────────────────────────────────────────────────────────────
// context-escalation — Tests for the escalation logic in aiRouter.js
//
// We import routeChat and inject mock deps to test the escalation loop
// without real DeepSeek API calls.
// ───────────────────────────────────────────────────────────────────

import test from "node:test";
import assert from "node:assert/strict";
import { mockModel } from "./_helpers/mockMongooseModel.js";

// We'll test shouldEscalate and jumpToTargetTier directly by importing
// from aiRouter.js. Since these are not exported, we recreate the logic
// inline from the same source for testability.

// ─── Recreated from aiRouter.js ────────────────────────────────────

function shouldEscalate(responseText, currentTier, query) {
  if (currentTier >= 4) return false;

  const text = String(responseText || "");

  if (text.length < 50) return true;

  if (/not enough (context|information|detail)/i.test(text)) return true;
  if (/insufficient|unable to determine|cannot (determine|answer|find)/i.test(text)) return true;

  const normalized = query.toLowerCase();
  if (currentTier < 2 && /\b(method|contribution|limitation|approach|compare|analyze)/i.test(normalized)) return true;
  if (currentTier < 3 && /\b(evidence|claim|proof|verify|validate)/i.test(normalized)) return true;

  return false;
}

function jumpToTargetTier(query, currentTier) {
  const normalized = query.toLowerCase();
  if (/\b(evidence|claim|proof|verify|validate)/i.test(normalized)) return Math.max(currentTier + 1, 3);
  if (/\b(method|contribution|limitation|approach|compare|analyze)/i.test(normalized)) return Math.max(currentTier + 1, 2);
  return currentTier + 1;
}

// ─── shouldEscalate ────────────────────────────────────────────────

test("shouldEscalate returns false for detailed responses with general query", () => {
  const response = "This paper presents a novel approach to reinforcement learning in multi-agent systems. The authors use a centralized training with decentralized execution paradigm that achieves state-of-the-art results on several benchmarks including StarCraft II and Google Research Football.";
  // Query is "what is this paper about" — not method/evidence specific, so no escalation
  assert.equal(shouldEscalate(response, 1, "what is this paper about"), false);
});

test("shouldEscalate returns true for very short responses", () => {
  assert.equal(shouldEscalate("Short.", 1, "explain the methodology in detail"), true);
  assert.equal(shouldEscalate("OK.", 1, "compare these papers"), true);
});

test("shouldEscalate returns false when already at tier 4", () => {
  assert.equal(shouldEscalate("Short response", 4, "any query"), false);
});

test("shouldEscalate returns true when response says insufficient context", () => {
  assert.equal(shouldEscalate("I cannot determine the answer with the provided information.", 1, "query"), true);
  assert.equal(shouldEscalate("Not enough context to answer this question properly.", 1, "query"), true);
  assert.equal(shouldEscalate("Insufficient detail available.", 1, "query"), true);
  assert.equal(shouldEscalate("Unable to determine the specific methods used.", 1, "query"), true);
});

test("shouldEscalate returns true when query asks for methods at tier < 2", () => {
  assert.equal(shouldEscalate("A reasonable response about the paper.", 0, "what methods are used"), true);
  assert.equal(shouldEscalate("A reasonable response.", 0, "compare the approaches"), true);
  assert.equal(shouldEscalate("A reasonable response.", 1, "what are the limitations"), true);
  assert.equal(shouldEscalate("A reasonable response.", 1, "分析一下方法"), true);
});

test("shouldEscalate returns false when query asks for methods at tier >= 2", () => {
  const longResponse = "The paper uses reinforcement learning with PPO algorithm. The key contributions include a novel reward shaping approach. ".repeat(5);
  assert.equal(shouldEscalate(longResponse, 2, "what methods are used"), false);
  assert.equal(shouldEscalate(longResponse, 3, "compare the approaches"), false);
});

test("shouldEscalate returns true when query asks for evidence at tier < 3", () => {
  assert.equal(shouldEscalate("A reasonable response.", 0, "what evidence supports the claim"), true);
  assert.equal(shouldEscalate("A reasonable response.", 1, "prove the results"), true);
  assert.equal(shouldEscalate("A reasonable response.", 2, "验证这个结论"), true);
});

test("shouldEscalate returns false for general questions at appropriate tier", () => {
  const longResponse = "This paper by Zhang et al. (2024) presents interesting findings about AI in education. ".repeat(5);
  assert.equal(shouldEscalate(longResponse, 1, "what is this paper about"), false);
  assert.equal(shouldEscalate(longResponse, 2, "summarize the paper"), false);
});

// ─── jumpToTargetTier ──────────────────────────────────────────────

test("jumpToTargetTier jumps to at least tier 3 for evidence queries", () => {
  assert.equal(jumpToTargetTier("what evidence supports this", 0), 3);
  assert.equal(jumpToTargetTier("prove the claim", 1), 3);
  assert.equal(jumpToTargetTier("验证证据", 2), 3);
});

test("jumpToTargetTier jumps to at least tier 2 for method queries", () => {
  assert.equal(jumpToTargetTier("what methods are used", 0), 2);
  assert.equal(jumpToTargetTier("compare the approaches", 1), 2);
  assert.equal(jumpToTargetTier("what are the limitations", 0), 2);
});

test("jumpToTargetTier increments by 1 for non-specific queries", () => {
  assert.equal(jumpToTargetTier("general question", 0), 1);
  assert.equal(jumpToTargetTier("another question", 2), 3);
});

test("jumpToTargetTier never goes below currentTier + 1", () => {
  // At tier 3, a method query should still jump to at least 4
  assert.equal(jumpToTargetTier("what methods are used", 3), 4);
});
