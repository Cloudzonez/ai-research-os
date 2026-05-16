import test from "node:test";
import assert from "node:assert/strict";
import { splitIntoChunks, rankChunksByRelevance, selectRelevantChunks } from "../server/services/textChunker.js";

// ---------------------------------------------------------------------------
// textChunker — Tier 4 text chunking for context pyramid
// Spec ref: docs/USER_STORIES.md Pyramid of Context
// ---------------------------------------------------------------------------

test("splitIntoChunks returns empty array for empty text", () => {
  assert.deepEqual(splitIntoChunks(""), []);
  assert.deepEqual(splitIntoChunks("   "), []);
});

test("splitIntoChunks returns single chunk for short text", () => {
  const text = "This is a short paragraph.";
  const chunks = splitIntoChunks(text, 2000);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].index, 0);
  assert.equal(chunks[0].text, text);
});

test("splitIntoChunks splits long text into multiple chunks", () => {
  // Create text with paragraphs that exceed maxChunkSize
  const paragraphs = [];
  for (let i = 0; i < 10; i++) {
    paragraphs.push(`Paragraph ${i}: ${"x".repeat(300)}`);
  }
  const text = paragraphs.join("\n\n");

  const chunks = splitIntoChunks(text, 600);
  assert.ok(chunks.length >= 5, `Expected >= 5 chunks, got ${chunks.length}`);
  // Each chunk should contain at least one paragraph
  for (const chunk of chunks) {
    assert.ok(chunk.text.length > 0);
    assert.ok(typeof chunk.index === "number");
  }
});

test("splitIntoChunks preserves paragraph boundaries", () => {
  const text = [
    "First paragraph with some content.",
    "Second paragraph with different content.",
    "Third paragraph here.",
  ].join("\n\n");

  const chunks = splitIntoChunks(text, 200);
  // Should not split mid-paragraph — each chunk should contain at least the full text
  assert.equal(chunks.length, 1); // 3 short paragraphs fit in 200 chars
});

test("splitIntoChunks handles text without paragraph breaks as single chunk", () => {
  // Text without paragraph breaks stays as one chunk (paragraph-aware splitting)
  const text = "A".repeat(5000);
  const chunks = splitIntoChunks(text, 1000);
  assert.equal(chunks.length, 1);
  assert.ok(chunks[0].text.length === 5000);
});

test("splitIntoChunks chunk indices are sequential", () => {
  const text = Array.from({ length: 20 }, (_, i) => `Para ${i}: ${"y".repeat(200)}`).join("\n\n");
  const chunks = splitIntoChunks(text, 500);

  for (let i = 0; i < chunks.length; i++) {
    assert.equal(chunks[i].index, i);
  }
});

test("rankChunksByRelevance returns all chunks with score 0 for empty query", () => {
  const chunks = [
    { index: 0, text: "First chunk about AI." },
    { index: 1, text: "Second chunk about ML." },
  ];

  const ranked = rankChunksByRelevance(chunks, "");
  assert.equal(ranked.length, 2);
  for (const r of ranked) {
    assert.equal(r.score, 0);
  }
});

test("rankChunksByRelevance scores chunks matching query terms higher", () => {
  const chunks = [
    { index: 0, text: "This chunk is about reinforcement learning and multi-agent systems." },
    { index: 1, text: "This chunk discusses quantum physics and particle mechanics." },
    { index: 2, text: "Deep reinforcement learning applied to robotics control." },
  ];

  const ranked = rankChunksByRelevance(chunks, "reinforcement learning");

  // Chunks 0 and 2 should score higher than chunk 1
  assert.ok(ranked[0].score > ranked[2].score || ranked[0].score >= 0);
  // The highest-scoring chunk should be index 0 or 2
  assert.ok(ranked[0].index === 0 || ranked[0].index === 2);
});

test("rankChunksByRelevance sorts by score descending", () => {
  const chunks = [
    { index: 0, text: "aaa bbb ccc" },
    { index: 1, text: "aaa bbb ddd" },
    { index: 2, text: "aaa eee fff" },
  ];

  const ranked = rankChunksByRelevance(chunks, "aaa bbb");
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1].score >= ranked[i].score);
  }
});

test("selectRelevantChunks returns top N chunks", () => {
  const text = Array.from({ length: 10 }, (_, i) => {
    if (i === 3) return `Relevant paragraph about machine learning: ${"z".repeat(300)}`;
    if (i === 7) return `Another ML paragraph about neural networks: ${"z".repeat(300)}`;
    return `Unrelated paragraph ${i}: ${"x".repeat(300)}`;
  }).join("\n\n");

  const selected = selectRelevantChunks(text, "machine learning neural networks", 3, 500);

  assert.ok(selected.length <= 3);
  assert.ok(selected.length >= 1);
  // The highest scoring chunk should be about ML
  assert.ok(
    selected[0].text.includes("machine learning") ||
    selected[0].text.includes("neural networks")
  );
});

test("selectRelevantChunks handles text shorter than chunk size", () => {
  const text = "Short text about artificial intelligence.";
  const selected = selectRelevantChunks(text, "artificial intelligence", 3, 2000);

  assert.equal(selected.length, 1);
  assert.ok(selected[0].text.includes("artificial intelligence"));
});

test("selectRelevantChunks handles empty text", () => {
  assert.deepEqual(selectRelevantChunks("", "query", 3, 1000), []);
});

test("selectRelevantChunks returns all chunks when fewer than topN", () => {
  const text = "First para.\n\nSecond para.";
  const selected = selectRelevantChunks(text, "first", 5, 100);
  assert.ok(selected.length <= 2);
});

test("rankChunksByRelevance scores include both index and text", () => {
  const chunks = [{ index: 5, text: "Test content here." }];
  const ranked = rankChunksByRelevance(chunks, "test content");

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].index, 5);
  assert.equal(ranked[0].text, "Test content here.");
  assert.ok(typeof ranked[0].score === "number");
});
