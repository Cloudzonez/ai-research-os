import test from "node:test";
import assert from "node:assert/strict";
import { handleParsePdf, handleSummarizePaper } from "../server/workers/runner.js";

// ---------------------------------------------------------------------------
// Worker runner — validates PDF parsing and paper summarization job handlers
// Spec ref: BUILD_PLAN.md Phase 2 "Queue workers for PDF parsing, summaries"
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// handleParsePdf
// ---------------------------------------------------------------------------

test("handleParsePdf reads PDF and extracts text, updates paper status to parsed", async () => {
  const paper = {
    _id: "paper-1",
    pdfPath: "/fake/path/paper.pdf",
    text: "",
    status: "parsing",
    async save() {
      this._saved = true;
    },
  };
  const PaperModel = {
    async findById(id) {
      assert.equal(id, "paper-1");
      return paper;
    },
  };

  const result = await handleParsePdf(
    { paperId: "paper-1" },
    {
      PaperModel,
      pdfParse: async (buf) => ({ text: "Extracted text from PDF", numpages: 10 }),
      readFileSync: () => Buffer.from("fake pdf content"),
    }
  );

  assert.deepEqual(result, { textLength: 23, pageCount: 10 });
  assert.equal(paper.text, "Extracted text from PDF");
  assert.equal(paper.status, "parsed");
  assert.equal(paper._saved, true);
});

test("handleParsePdf throws when paper is not found", async () => {
  const PaperModel = {
    async findById(id) {
      return null;
    },
  };

  await assert.rejects(
    () => handleParsePdf({ paperId: "nonexistent" }, { PaperModel }),
    /Paper not found or no PDF path/
  );
});

test("handleParsePdf throws when paper has no pdfPath", async () => {
  const paper = {
    _id: "paper-2",
    pdfPath: "",
    text: "",
  };
  const PaperModel = {
    async findById(id) {
      return paper;
    },
  };

  await assert.rejects(
    () => handleParsePdf({ paperId: "paper-2" }, { PaperModel }),
    /Paper not found or no PDF path/
  );
});

test("handleParsePdf truncates text to 50000 characters", async () => {
  const longText = "x".repeat(60000);
  const paper = {
    _id: "paper-3",
    pdfPath: "/fake/path/long.pdf",
    text: "",
    status: "parsing",
    async save() {},
  };
  const PaperModel = {
    async findById(id) {
      return paper;
    },
  };

  await handleParsePdf(
    { paperId: "paper-3" },
    {
      PaperModel,
      pdfParse: async (buf) => ({ text: longText, numpages: 1 }),
      readFileSync: () => Buffer.from("fake"),
    }
  );

  assert.equal(paper.text.length, 50000);
  assert.equal(paper.status, "parsed");
});

test("handleParsePdf reports correct numpages from parsed PDF", async () => {
  const paper = {
    _id: "paper-4",
    pdfPath: "/fake/path/multipage.pdf",
    text: "",
    status: "parsing",
    async save() {},
  };
  const PaperModel = {
    async findById(id) {
      return paper;
    },
  };

  const result = await handleParsePdf(
    { paperId: "paper-4" },
    {
      PaperModel,
      pdfParse: async (buf) => ({ text: "Content", numpages: 42 }),
      readFileSync: () => Buffer.from("fake"),
    }
  );

  assert.equal(result.pageCount, 42);
});

// ---------------------------------------------------------------------------
// handleSummarizePaper
// ---------------------------------------------------------------------------

test("handleSummarizePaper calls AI, parses JSON, and updates paper fields", async () => {
  const paper = {
    _id: "paper-5",
    text: "This is a research paper about multi-agent reinforcement learning in educational settings.",
    summary: "",
    contributions: "",
    methods: "",
    limitations: "",
    status: "parsed",
    async save() {
      this._saved = true;
    },
  };
  const PaperModel = {
    async findById(id) {
      return paper;
    },
  };

  const chatFn = async (messages, locale) => ({
    content: JSON.stringify({
      summary: "This paper presents a novel approach to MARL in classrooms.",
      contributions: ["New algorithm for multi-agent coordination", "Empirical validation in classroom settings"],
      methods: "Experimental comparison with baseline methods across 3 classroom scenarios.",
      limitations: "Limited to simulated classroom environments with 30 or fewer agents.",
    }),
    tokensUsed: 150,
    model: "mock",
  });

  const result = await handleSummarizePaper(
    { paperId: "paper-5" },
    { PaperModel, chat: chatFn }
  );

  assert.deepEqual(result, { paperId: "paper-5", status: "summarized" });
  assert.ok(paper.summary.includes("novel approach"));
  assert.ok(paper.contributions.includes("New algorithm"));
  assert.ok(paper.contributions.includes("Empirical validation"));
  assert.equal(paper.methods, "Experimental comparison with baseline methods across 3 classroom scenarios.");
  assert.ok(paper.limitations.length > 0);
  assert.equal(paper.status, "summarized");
  assert.equal(paper._saved, true);
});

test("handleSummarizePaper throws when paper is not found", async () => {
  const PaperModel = {
    async findById(id) {
      return null;
    },
  };

  await assert.rejects(
    () => handleSummarizePaper({ paperId: "nonexistent" }, { PaperModel }),
    /Paper not found or no text extracted/
  );
});

test("handleSummarizePaper throws when paper has no text", async () => {
  const paper = {
    _id: "paper-6",
    text: "",
    status: "parsed",
  };
  const PaperModel = {
    async findById(id) {
      return paper;
    },
  };

  await assert.rejects(
    () => handleSummarizePaper({ paperId: "paper-6" }, { PaperModel }),
    /Paper not found or no text extracted/
  );
});

test("handleSummarizePaper throws on non-JSON AI response", async () => {
  const paper = {
    _id: "paper-7",
    text: "Some research paper text here.",
    async save() {},
  };
  const PaperModel = {
    async findById(id) {
      return paper;
    },
  };

  const chatFn = async () => ({
    content: "This is not JSON, just a plain text response.",
    tokensUsed: 50,
    model: "mock",
  });

  await assert.rejects(
    () => handleSummarizePaper({ paperId: "paper-7" }, { PaperModel, chat: chatFn }),
    /No JSON found in response/
  );
});

test("handleSummarizePaper handles contributions as string (not array)", async () => {
  const paper = {
    _id: "paper-8",
    text: "Paper text.",
    summary: "",
    contributions: "",
    methods: "",
    limitations: "",
    status: "parsed",
    async save() {},
  };
  const PaperModel = {
    async findById(id) {
      return paper;
    },
  };

  const chatFn = async () => ({
    content: JSON.stringify({
      summary: "Summary.",
      contributions: "Single contribution as string.",
      methods: "Methods.",
      limitations: "Limitations.",
    }),
    tokensUsed: 50,
    model: "mock",
  });

  await handleSummarizePaper(
    { paperId: "paper-8" },
    { PaperModel, chat: chatFn }
  );

  assert.ok(paper.contributions.includes("Single contribution"));
  assert.equal(paper.status, "summarized");
});

test("handleSummarizePaper truncates paper text to 8000 chars for AI prompt", async () => {
  const longText = "y".repeat(10000);
  let promptText = "";
  const paper = {
    _id: "paper-9",
    text: longText,
    summary: "",
    contributions: "",
    methods: "",
    limitations: "",
    status: "parsed",
    async save() {},
  };
  const PaperModel = {
    async findById(id) {
      return paper;
    },
  };

  const chatFn = async (messages) => {
    promptText = messages[0].content;
    return {
      content: JSON.stringify({ summary: "S", contributions: [], methods: "M", limitations: "L" }),
      tokensUsed: 50,
      model: "mock",
    };
  };

  await handleSummarizePaper(
    { paperId: "paper-9" },
    { PaperModel, chat: chatFn }
  );

  // The prompt should contain at most 8000 chars of the paper text
  // (plus a few 'y's from template words like "summary", "Analyze", "key", "only")
  const yCount = (promptText.match(/y/g) || []).length;
  assert.ok(yCount <= 8010, `expected <= 8010 'y' chars in prompt, got ${yCount}`);
  assert.ok(yCount >= 8000, `expected >= 8000 'y' chars from paper text, got ${yCount}`);
});
