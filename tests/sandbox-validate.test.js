import test from "node:test";
import assert from "node:assert/strict";
import { validateCrawlerOutput } from "../server/services/sandbox.js";

// ---------------------------------------------------------------------------
// validateCrawlerOutput — validates crawler output schema
// Spec ref: STANDARD_CRAWLER_ARCHITECTURE.md, BUILD_PLAN.md Phase 6
// ---------------------------------------------------------------------------

test("validateCrawlerOutput returns invalid for null output", () => {
  const result = validateCrawlerOutput(null, { requiredFields: ["title"] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test("validateCrawlerOutput returns invalid for undefined output", () => {
  const result = validateCrawlerOutput(undefined, { requiredFields: ["title"] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("No output"));
});

test("validateCrawlerOutput returns invalid for false output", () => {
  const result = validateCrawlerOutput(false, { requiredFields: ["title"] });
  assert.equal(result.valid, false);
});

test("validateCrawlerOutput returns valid when all required fields present", () => {
  const output = { title: "Paper Title", abstract: "Abstract text", doi: "10.1234/test" };
  const result = validateCrawlerOutput(output, {
    requiredFields: ["title", "abstract"],
  });
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("validateCrawlerOutput rejects output missing one required field", () => {
  const output = { title: "Paper Title" };
  const result = validateCrawlerOutput(output, {
    requiredFields: ["title", "abstract"],
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.ok(result.errors[0].includes("abstract"));
});

test("validateCrawlerOutput reports multiple missing fields", () => {
  const output = { title: "Paper Title" };
  const result = validateCrawlerOutput(output, {
    requiredFields: ["title", "abstract", "doi", "year"],
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 3);
});

test("validateCrawlerOutput returns valid when no schema provided", () => {
  const result = validateCrawlerOutput({ title: "Test" }, null);
  assert.equal(result.valid, true);
});

test("validateCrawlerOutput returns valid when schema has no requiredFields", () => {
  const result = validateCrawlerOutput({ title: "Test" }, {});
  assert.equal(result.valid, true);
});

test("validateCrawlerOutput returns valid for empty requiredFields array", () => {
  const result = validateCrawlerOutput({ title: "Test" }, { requiredFields: [] });
  assert.equal(result.valid, true);
});

test("validateCrawlerOutput returns valid for output with extra fields", () => {
  const output = { title: "T", abstract: "A", doi: "D", extraField: "extra" };
  const result = validateCrawlerOutput(output, {
    requiredFields: ["title", "abstract"],
  });
  assert.equal(result.valid, true);
});

test("validateCrawlerOutput correctly identifies falsy field as present", () => {
  const output = { title: "", abstract: "Content" };
  const result = validateCrawlerOutput(output, {
    requiredFields: ["title", "abstract"],
  });
  // title EXISTS as a key even though its value is empty string
  assert.equal(result.valid, true);
});
