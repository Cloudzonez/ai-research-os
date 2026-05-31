import test from "node:test";
import assert from "node:assert/strict";
import { parseResponse } from "../server/services/deepseek.js";

// ---------------------------------------------------------------------------
// parseResponse — validates the AI Command Router prefix classification
// Spec ref: ARCHITECTURE.md "AI Command Router", BUILD_PLAN.md Phase 5
// ---------------------------------------------------------------------------

test("parseResponse extracts TRACKER prefix", () => {
  const result = parseResponse("TRACKER: Create a tracker for multi-agent RL\nSome description here");
  assert.equal(result.kind, "tracker");
  assert.ok(result.text.includes("Some description"));
  assert.ok(!result.text.includes("TRACKER"));
});

test("parseResponse extracts PDF prefix", () => {
  const result = parseResponse("PDF: Uploading your paper now\nProcessing file...");
  assert.equal(result.kind, "pdf");
  assert.ok(result.text.includes("Processing file"));
  assert.ok(!result.text.includes("PDF:"));
});

test("parseResponse extracts WRITE prefix", () => {
  const result = parseResponse("WRITE: Here is your related work section\nDraft content here...");
  assert.equal(result.kind, "write");
  assert.ok(result.text.includes("Draft content"));
  assert.ok(!result.text.includes("WRITE:"));
});

test("parseResponse no longer detects CRAWLER prefix (crawler generation removed)", () => {
  const result = parseResponse("CRAWLER: Creating crawler for arxiv papers\nSpec follows...");
  assert.equal(result.kind, "general");
  assert.ok(result.text.includes("Spec follows"));
});

test("parseResponse extracts GENERAL prefix", () => {
  const result = parseResponse("GENERAL: Hello, how can I help you today?");
  assert.equal(result.kind, "general");
  assert.ok(result.text.includes("how can I help"));
  assert.ok(!result.text.includes("GENERAL:"));
});

test("parseResponse defaults to general when no prefix is present", () => {
  const result = parseResponse("This is just a plain message without any prefix at all.");
  assert.equal(result.kind, "general");
  assert.equal(result.text, "This is just a plain message without any prefix at all.");
});

test("parseResponse handles Chinese prefix 追踪器", () => {
  const result = parseResponse("追踪器：多智能体强化学习\n创建追踪器...");
  assert.equal(result.kind, "tracker");
  assert.ok(result.text.includes("创建追踪器"));
});

test("parseResponse handles Chinese prefix 上传", () => {
  const result = parseResponse("上传：收到你的PDF文件");
  assert.equal(result.kind, "pdf");
});

test("parseResponse handles Chinese prefix 写作", () => {
  const result = parseResponse("写作：这是related work草稿");
  assert.equal(result.kind, "write");
});

test("parseResponse no longer detects Chinese crawler prefix (crawler generation removed)", () => {
  const result = parseResponse("爬虫：生成arXiv爬虫");
  assert.equal(result.kind, "general");
});

test("parseResponse handles Chinese prefix 一般", () => {
  const result = parseResponse("一般：你好，有什么可以帮助你的？");
  assert.equal(result.kind, "general");
});

test("parseResponse handles colon variants (full-width, half-width)", () => {
  // Full-width colon
  const r1 = parseResponse("TRACKER：多智能体");
  assert.equal(r1.kind, "tracker");
  // Half-width colon with space
  const r2 = parseResponse("PDF: upload paper");
  assert.equal(r2.kind, "pdf");
});

test("parseResponse extracts inline context JSON from end of text", () => {
  const result = parseResponse(
    'GENERAL: Here are the papers I found. {"context":{"papers":["Paper A","Paper B"],"tokens":1234,"artifacts":3}}'
  );
  assert.equal(result.kind, "general");
  assert.deepEqual(result.context.papers, ["Paper A", "Paper B"]);
  assert.equal(result.context.tokens, 1234);
  assert.equal(result.context.artifacts, 3);
  // Context JSON should be stripped from text
  assert.ok(!result.text.includes('{"context"'));
});

test("parseResponse handles context JSON with partial fields", () => {
  const result = parseResponse(
    'GENERAL: Results. {"context":{"papers":["Paper X"]}}'
  );
  assert.equal(result.context.papers.length, 1);
  assert.equal(result.context.papers[0], "Paper X");
  assert.equal(result.context.tokens, 0); // default
});

test("parseResponse handles malformed context JSON gracefully", () => {
  const result = parseResponse(
    'GENERAL: Results. {"context":{broken json here}'
  );
  assert.equal(result.kind, "general");
  // Should not throw; context should be defaults
  assert.deepEqual(result.context.papers, []);
  assert.equal(result.context.tokens, 0);
});

test("parseResponse handles empty string input", () => {
  const result = parseResponse("");
  assert.equal(result.kind, "general");
  assert.equal(result.text, "");
  assert.deepEqual(result.context.papers, []);
});

test("parseResponse handles content with only a prefix and no body", () => {
  const result = parseResponse("TRACKER:");
  assert.equal(result.kind, "tracker");
  assert.equal(result.text, "");
});

test("parseResponse detects inline PDF mention without prefix", () => {
  const result = parseResponse("I found several PDF: documents in the library");
  assert.equal(result.kind, "pdf");
});

test("parseResponse no longer classifies inline crawler mention (crawler generation removed)", () => {
  const result = parseResponse("Let me create a 爬虫：for arxiv");
  assert.equal(result.kind, "general");
});

test("parseResponse preserves text content before context JSON", () => {
  const result = parseResponse(
    'GENERAL: Important analysis here. More details. {"context":{"papers":["X"],"tokens":100,"artifacts":1}}'
  );
  assert.ok(result.text.startsWith("Important analysis"));
  assert.ok(!result.text.includes('{"context"'));
});
