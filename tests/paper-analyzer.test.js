import test from "node:test";
import assert from "node:assert/strict";
import { extractMetadata, summarizePaper, extractClaims, deduplicateByTitle } from "../server/services/paperAnalyzer.js";

// ---------------------------------------------------------------------------
// paperAnalyzer — validates AI-powered paper metadata extraction and analysis
// Spec ref: BUILD_PLAN.md Phase 3 "Store paper summaries, structured contributions,
//   methods, limitations"
// ---------------------------------------------------------------------------

function mockChat(response) {
  return async () => response;
}

const validMetadataResponse = mockChat({
  content: JSON.stringify({
    title: "Multi-Agent Reinforcement Learning",
    authors: ["Alice Chen", "Bob Zhang"],
    year: 2025,
    doi: "10.1234/marl.2025",
    abstract: "This paper studies multi-agent RL in classroom settings.",
  }),
  tokensUsed: 80,
  model: "mock",
});

const validSummaryResponse = mockChat({
  content: JSON.stringify({
    summary: "This paper presents a novel multi-agent approach.",
    contributions: "1. New algorithm. 2. Empirical validation.",
    methods: "Experimental comparison on standard benchmarks.",
    limitations: "Limited to 2D environments.",
  }),
  tokensUsed: 120,
  model: "mock",
});

const validClaimsResponse = mockChat({
  content: JSON.stringify({
    claims: [
      { claim: "Claim 1", evidence: "Evidence 1" },
      { claim: "Claim 2", evidence: "Evidence 2" },
    ],
  }),
  tokensUsed: 60,
  model: "mock",
});

const validDedupResponse = mockChat({
  content: JSON.stringify({
    isDuplicate: true,
    matchedTitle: "Multi-Agent RL",
  }),
  tokensUsed: 30,
  model: "mock",
});

const nonJsonResponse = mockChat({
  content: "This is not JSON at all.",
  tokensUsed: 50,
  model: "mock",
});

// ---------------------------------------------------------------------------
// extractMetadata
// ---------------------------------------------------------------------------

test("extractMetadata parses valid JSON from AI response", async () => {
  const result = await extractMetadata("paper text...", "en", validMetadataResponse);
  assert.equal(result.title, "Multi-Agent Reinforcement Learning");
  assert.deepEqual(result.authors, ["Alice Chen", "Bob Zhang"]);
  assert.equal(result.year, 2025);
  assert.equal(result.doi, "10.1234/marl.2025");
  assert.ok(result.abstract.length > 0);
  assert.equal(result.tokensUsed, 80);
});

test("extractMetadata handles missing fields with defaults", async () => {
  const chatFn = mockChat({
    content: JSON.stringify({ title: "Only Title" }),
    tokensUsed: 30,
    model: "mock",
  });
  const result = await extractMetadata("text", "en", chatFn);
  assert.equal(result.title, "Only Title");
  assert.deepEqual(result.authors, []);
  assert.equal(result.doi, "");
});

test("extractMetadata throws on non-JSON AI response", async () => {
  await assert.rejects(
    () => extractMetadata("text", "en", nonJsonResponse),
    /No JSON found in metadata response/
  );
});

test("extractMetadata truncates input text to 6000 chars", async () => {
  let receivedText = "";
  const chatFn = async (messages) => {
    receivedText = messages[0].content;
    return { content: JSON.stringify({ title: "T", authors: [], year: 2024, doi: "", abstract: "" }), tokensUsed: 10, model: "mock" };
  };
  const longText = "x".repeat(10000);
  await extractMetadata(longText, "en", chatFn);
  assert.ok(receivedText.length <= 6200); // prompt + text, text itself should be truncated
  assert.ok(receivedText.includes("x".repeat(6000)));
});

test("extractMetadata uses Chinese prompt for zh locale", async () => {
  let receivedLocale = "";
  const chatFn = async (messages, locale) => {
    receivedLocale = locale;
    return { content: JSON.stringify({ title: "标题", authors: [], year: 2024, doi: "", abstract: "" }), tokensUsed: 10, model: "mock" };
  };
  await extractMetadata("中文文本", "zh", chatFn);
  assert.equal(receivedLocale, "zh");
});

// ---------------------------------------------------------------------------
// summarizePaper
// ---------------------------------------------------------------------------

test("summarizePaper returns summary, contributions, methods, limitations", async () => {
  const result = await summarizePaper("paper text...", "en", validSummaryResponse);
  assert.ok(result.summary.length > 0);
  assert.ok(result.contributions.length > 0);
  assert.ok(result.methods.length > 0);
  assert.ok(result.limitations.length > 0);
  assert.equal(result.tokensUsed, 120);
});

test("summarizePaper handles missing fields with empty defaults", async () => {
  const chatFn = mockChat({
    content: JSON.stringify({ summary: "Just a summary" }),
    tokensUsed: 50,
    model: "mock",
  });
  const result = await summarizePaper("text", "en", chatFn);
  assert.equal(result.summary, "Just a summary");
  assert.equal(result.contributions, "");
  assert.equal(result.methods, "");
});

test("summarizePaper throws on non-JSON response", async () => {
  await assert.rejects(
    () => summarizePaper("text", "en", nonJsonResponse),
    /No JSON found in summary response/
  );
});

test("summarizePaper uses Chinese prompt for zh locale", async () => {
  let receivedLocale = "";
  const chatFn = async (messages, locale) => {
    receivedLocale = locale;
    return { content: JSON.stringify({ summary: "摘要", contributions: "", methods: "", limitations: "" }), tokensUsed: 10, model: "mock" };
  };
  await summarizePaper("中文论文", "zh", chatFn);
  assert.equal(receivedLocale, "zh");
});

// ---------------------------------------------------------------------------
// extractClaims
// ---------------------------------------------------------------------------

test("extractClaims returns array of claims with evidence", async () => {
  const result = await extractClaims("paper text...", "en", validClaimsResponse);
  assert.equal(result.claims.length, 2);
  assert.equal(result.claims[0].claim, "Claim 1");
  assert.equal(result.claims[0].evidence, "Evidence 1");
  assert.equal(result.tokensUsed, 60);
});

test("extractClaims returns empty claims array on non-JSON response", async () => {
  const result = await extractClaims("text", "en", nonJsonResponse);
  assert.deepEqual(result.claims, []);
});

test("extractClaims returns empty claims when JSON has no claims key", async () => {
  const chatFn = mockChat({
    content: JSON.stringify({ other: "data" }),
    tokensUsed: 20,
    model: "mock",
  });
  const result = await extractClaims("text", "en", chatFn);
  assert.deepEqual(result.claims, []);
});

// ---------------------------------------------------------------------------
// deduplicateByTitle
// ---------------------------------------------------------------------------

test("deduplicateByTitle parses AI response for duplicate check", async () => {
  const result = await deduplicateByTitle(
    "Multi-Agent RL",
    [{ title: "Multi-Agent RL" }, { title: "Other Paper" }],
    validDedupResponse
  );
  assert.equal(result.isDuplicate, true);
  assert.ok(result.matchedTitle);
});

test("deduplicateByTitle returns safe defaults on non-JSON response", async () => {
  const result = await deduplicateByTitle("Test", [{ title: "Other" }], nonJsonResponse);
  assert.equal(result.isDuplicate, false);
  assert.equal(result.matchedTitle, "");
});
