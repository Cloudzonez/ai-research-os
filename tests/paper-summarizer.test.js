import test from "node:test";
import assert from "node:assert/strict";
import { summarizePaper, summarizePapers, DEFAULT_SUMMARY } from "../server/services/paperSummarizer.js";
import { generatePaperHTML, HTML_FALLBACK_ZH, HTML_FALLBACK_EN } from "../server/services/htmlRenderer.js";

// Mock paper for testing
const mockPaper = {
  title: "Benchmark Dataset Generation for Excel Formula Repair with LLMs",
  authors: ["Ananya Singha", "Harshita Sahijwani"],
  abstract: "Excel is a pervasive yet often complex tool for data processing and analysis. This paper introduces a novel method for generating benchmark datasets for Excel formula repair using large language models. We propose a systematic approach that combines synthetic data generation with human validation. Our experiments show that LLMs can effectively repair 78% of broken Excel formulas, significantly outperforming traditional approaches. The generated benchmark contains 618 high-quality samples across diverse formula categories.",
  url: "https://arxiv.org/abs/2508.11715",
  pdfUrl: "https://arxiv.org/pdf/2508.11715",
  doi: "10.1234/arxiv.2508.11715",
  categories: ["cs.SE", "cs.AI"],
  tags: ["arXiv", "Open access"],
};

test("summarizePaper returns DEFAULT_SUMMARY for short abstract", async () => {
  const result = await summarizePaper({ title: "Test", abstract: "Short." }, "zh");
  assert.deepEqual(result, DEFAULT_SUMMARY);
});

test("summarizePaper returns valid structure for a real abstract", async () => {
  // This test calls the real DeepSeek API — it will be skipped if no API key
  const hasApiKey = process.env.DEEPSEEK_API_KEY;
  if (!hasApiKey) {
    console.log("  (skipped — no DEEPSEEK_API_KEY)");
    return;
  }

  const result = await summarizePaper(mockPaper, "zh");

  // Verify all 5 fields exist
  assert.ok(typeof result.tldr === "string", "tldr should be a string");
  assert.ok(typeof result.motivation === "string", "motivation should be a string");
  assert.ok(typeof result.method === "string", "method should be a string");
  assert.ok(typeof result.result === "string", "result should be a string");
  assert.ok(typeof result.conclusion === "string", "conclusion should be a string");

  // With a real API call, at least tldr should have content
  if (result.tldr) {
    assert.ok(result.tldr.length > 10, "TL;DR should have meaningful content");
  }
});

test("summarizePaper returns valid structure even when AI call succeeds", async () => {
  const hasApiKey = process.env.DEEPSEEK_API_KEY;
  if (!hasApiKey) {
    console.log("  (skipped — no DEEPSEEK_API_KEY)");
    return;
  }

  const result = await summarizePaper(
    { title: "Test Paper", abstract: "A meaningful abstract about machine learning approaches to natural language processing tasks. ".repeat(8) },
    "zh"
  );

  // Verify all 5 fields exist and are strings
  const fields = ["tldr", "motivation", "method", "result", "conclusion"];
  for (const field of fields) {
    assert.ok(typeof result[field] === "string", `${field} should be a string`);
  }
});

test("summarizePaper returns DEFAULT_SUMMARY when abstract is too short", async () => {
  const result = await summarizePaper({ title: "Tiny", abstract: "Too short." }, "zh");
  assert.deepEqual(result, DEFAULT_SUMMARY);
});

test("summarizePapers processes multiple papers sequentially", async () => {
  const papers = [
    { title: "Paper 1", abstract: "Abstract one. ".repeat(10) },
    { title: "Paper 2", abstract: "Abstract two. ".repeat(10) },
  ];

  const progress = [];
  const results = await summarizePapers(papers, {
    locale: "zh",
    onProgress: (p) => progress.push(p),
  });

  assert.equal(results.length, 2);
  assert.equal(progress.length, 2);
  assert.equal(progress[0].current, 1);
  assert.equal(progress[1].current, 2);
  assert.ok(results[0].aiSummary, "each result should have aiSummary");
  assert.ok(results[1].aiSummary, "each result should have aiSummary");
});

test("generatePaperHTML produces valid HTML fallback when AI unavailable", async () => {
  const html = await generatePaperHTML({
    title: mockPaper.title,
    authors: mockPaper.authors,
    abstract: mockPaper.abstract,
    categories: mockPaper.categories,
    url: mockPaper.url,
    pdfUrl: mockPaper.pdfUrl,
    doi: mockPaper.doi,
    aiSummary: {
      tldr: "A benchmark for Excel formula repair using LLMs.",
      motivation: "Excel users often break formulas.",
      method: "Systematic synthetic data generation with human validation.",
      result: "LLMs repair 78% of formulas, outperforming baselines.",
      conclusion: "The approach is scalable and practical.",
    },
  }, "zh");

  // Verify it's a valid HTML document
  assert.ok(html.includes("<!DOCTYPE html>"), "should include DOCTYPE");
  assert.ok(html.includes("</html>"), "should close html tag");
  assert.ok(html.includes(mockPaper.title), "should include paper title");
});

test("generatePaperHTML fallback templates are valid HTML", () => {
  const zhHtml = HTML_FALLBACK_ZH({
    title: "Test Paper",
    authors: ["Author One"],
    abstract: "Test abstract.",
    categories: ["cs.AI"],
    url: "https://arxiv.org/abs/1234.5678",
    pdfUrl: "https://arxiv.org/pdf/1234.5678",
    doi: "10.1234/test",
    aiSummary: {
      tldr: "A test TL;DR.",
      motivation: "Test motivation.",
      method: "Test method.",
      result: "Test result.",
      conclusion: "Test conclusion.",
    },
  });

  assert.ok(zhHtml.includes("<!DOCTYPE html>"));
  assert.ok(zhHtml.includes("Test Paper"));
  assert.ok(zhHtml.includes("TL;DR"));
  assert.ok(zhHtml.includes("Motivation"));

  const enHtml = HTML_FALLBACK_EN({
    title: "Test Paper",
    authors: ["Author One"],
    abstract: "Test abstract.",
    categories: ["cs.AI"],
    url: "https://arxiv.org/abs/1234.5678",
    pdfUrl: "https://arxiv.org/pdf/1234.5678",
    doi: "10.1234/test",
    aiSummary: {
      tldr: "A test TL;DR.",
      motivation: "Test motivation.",
      method: "Test method.",
      result: "Test result.",
      conclusion: "Test conclusion.",
    },
  });

  assert.ok(enHtml.includes("<!DOCTYPE html>"));
  assert.ok(enHtml.includes("Test Paper"));
  assert.ok(enHtml.includes("TL;DR"));
  assert.ok(enHtml.includes("Motivation"));
});

test("generatePaperHTML handles missing aiSummary gracefully", async () => {
  const html = await generatePaperHTML({
    title: "Minimal Paper",
    authors: [],
    abstract: "A minimal abstract for testing. ".repeat(10),
    categories: [],
    url: "",
    pdfUrl: "",
    doi: "",
    aiSummary: {},
  }, "en");

  assert.ok(html.includes("<!DOCTYPE html>"));
  assert.ok(html.includes("Minimal Paper"));
  // Should not have TL;DR/Motivation sections when aiSummary is empty
  assert.ok(!html.includes("TL;DR") || html.includes("TL;DR</h2><p></p>"));
});
