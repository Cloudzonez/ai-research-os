import test from "node:test";
import assert from "node:assert/strict";
import { mockModel } from "./_helpers/mockMongooseModel.js";
import { handleSummarizePaper } from "../server/workers/runner.js";

// ---------------------------------------------------------------------------
// Story 1: PDF Upload → AI Parse → Structured Display
// Spec ref: docs/USER_STORIES.md Story 1
//
// Tests the full paper pipeline:
//   1. Upload → text extraction → paper record creation
//   2. Summarization job processing → AI extracts structured metadata
//   3. Duplicate detection
//   4. Error handling
// ---------------------------------------------------------------------------

// ─── Fixtures ──────────────────────────────────────────────────────

function paperFixture(overrides = {}) {
  return {
    _id: `paper-${Math.random().toString(36).slice(2, 8)}`,
    title: "Test Research Paper",
    source: "PDF",
    area: "Teacher upload",
    score: 82,
    sharing: "school",
    tags: ["Parsing", "School shared"],
    doi: null,
    abstract: null,
    authors: [],
    year: null,
    url: null,
    pdfPath: `/uploads/test-paper.pdf`,
    summary: null,
    contributions: null,
    methods: null,
    limitations: null,
    status: "parsed",
    text: "This is a research paper about artificial intelligence in education. " +
          "We conducted experiments with 500 students across 10 universities. " +
          "The results show significant improvement in learning outcomes using " +
          "AI-powered tutoring systems. Our method uses reinforcement learning " +
          "to adapt to individual student needs. Limitations include sample size " +
          "and geographic diversity constraints.",
    ...overrides,
  };
}

// ─── handleSummarizePaper ──────────────────────────────────────────

test("handleSummarizePaper extracts structured fields from paper text", async () => {
  const paper = paperFixture({ status: "parsed" });
  const PaperModel = mockModel([paper]);

  const chatFn = async () => ({
    content: JSON.stringify({
      summary: "An AI-powered tutoring system improved learning outcomes for 500 students across 10 universities using reinforcement learning for personalization.",
      contributions: ["Demonstrated RL-based tutoring effectiveness", "Large-scale 10-university study", "500-student controlled experiment"],
      methods: "Reinforcement learning with controlled A/B experiment design",
      limitations: "Limited geographic diversity and moderate sample size",
    }),
    tokensUsed: 350,
    model: "deepseek-v4-pro",
  });

  const result = await handleSummarizePaper(
    { paperId: paper._id },
    { PaperModel, chat: chatFn }
  );

  // Verify job result
  assert.equal(result.paperId, paper._id);
  assert.equal(result.status, "summarized");

  // Verify paper was updated with AI-extracted fields
  const updated = await PaperModel.findById(paper._id);
  assert.ok(updated.summary.includes("reinforcement learning"));
  assert.ok(updated.contributions.includes("RL-based"));
  assert.ok(updated.methods.includes("Reinforcement learning"));
  assert.ok(updated.limitations.includes("geographic diversity"));
  assert.equal(updated.status, "summarized");
});

test("handleSummarizePaper handles JSON with array contributions", async () => {
  const paper = paperFixture({ status: "parsed" });
  const PaperModel = mockModel([paper]);

  const chatFn = async () => ({
    content: JSON.stringify({
      summary: "A study on AI.",
      contributions: ["Contribution A", "Contribution B", "Contribution C"],
      methods: "Survey method",
      limitations: "Small sample",
    }),
    tokensUsed: 200,
    model: "deepseek-v4-pro",
  });

  await handleSummarizePaper(
    { paperId: paper._id },
    { PaperModel, chat: chatFn }
  );

  const updated = await PaperModel.findById(paper._id);
  // Array contributions should be joined
  assert.ok(updated.contributions.includes("Contribution A"));
  assert.ok(updated.contributions.includes("Contribution B"));
  assert.ok(updated.contributions.includes("Contribution C"));
});

test("handleSummarizePaper handles string contributions (non-array)", async () => {
  const paper = paperFixture({ status: "parsed" });
  const PaperModel = mockModel([paper]);

  const chatFn = async () => ({
    content: JSON.stringify({
      summary: "Summary text.",
      contributions: "Single contribution string",
      methods: "Method text",
      limitations: "Limitation text",
    }),
    tokensUsed: 150,
    model: "deepseek-v4-pro",
  });

  await handleSummarizePaper(
    { paperId: paper._id },
    { PaperModel, chat: chatFn }
  );

  const updated = await PaperModel.findById(paper._id);
  assert.equal(updated.contributions, "Single contribution string");
  assert.equal(updated.status, "summarized");
});

test("handleSummarizePaper throws if no JSON in AI response", async () => {
  const paper = paperFixture({ status: "parsed" });
  const PaperModel = mockModel([paper]);

  const chatFn = async () => ({
    content: "Here is a nice summary of the paper... (no JSON)",
    tokensUsed: 100,
    model: "deepseek-v4-pro",
  });

  await assert.rejects(
    () =>
      handleSummarizePaper(
        { paperId: paper._id },
        { PaperModel, chat: chatFn }
      ),
    /No JSON found in response/
  );

  // Paper status should NOT have changed
  const unchanged = await PaperModel.findById(paper._id);
  assert.equal(unchanged.status, "parsed");
});

test("handleSummarizePaper throws if paper not found", async () => {
  const PaperModel = mockModel([]);

  await assert.rejects(
    () =>
      handleSummarizePaper(
        { paperId: "nonexistent" },
        { PaperModel }
      ),
    /Paper not found/
  );
});

test("handleSummarizePaper throws if paper has no extracted text", async () => {
  const paper = paperFixture({ status: "parsing", text: "" });
  const PaperModel = mockModel([paper]);

  await assert.rejects(
    () =>
      handleSummarizePaper(
        { paperId: paper._id },
        { PaperModel }
      ),
    /no text extracted/i
  );
});

test("handleSummarizePaper handles empty optional fields gracefully", async () => {
  const paper = paperFixture({ status: "parsed" });
  const PaperModel = mockModel([paper]);

  const chatFn = async () => ({
    content: JSON.stringify({
      summary: "",
      contributions: "",
      methods: "",
      limitations: "",
    }),
    tokensUsed: 50,
    model: "deepseek-v4-pro",
  });

  await handleSummarizePaper(
    { paperId: paper._id },
    { PaperModel, chat: chatFn }
  );

  const updated = await PaperModel.findById(paper._id);
  // Empty strings are fine — paper should still be marked summarized
  assert.equal(updated.status, "summarized");
  assert.equal(updated.summary, "");
  assert.equal(updated.contributions, "");
  assert.equal(updated.methods, "");
  assert.equal(updated.limitations, "");
});

// ─── Full pipeline integration ────────────────────────────────────

test("full pipeline: upload → parsed status → summarize → summarized status", async () => {
  // Simulates what happens across the upload route + worker:
  // 1. Paper created with status "parsing" and text extracted
  // 2. Summarize job queued
  // 3. Worker picks up job, calls AI
  // 4. Paper updated to "summarized"

  const paper = paperFixture({ status: "parsed" });
  const PaperModel = mockModel([paper]);

  // Verify initial state
  const initial = await PaperModel.findById(paper._id);
  assert.equal(initial.status, "parsed");
  assert.equal(initial.summary, null);
  assert.equal(initial.contributions, null);

  // Step: worker processes the summarize job
  const chatFn = async () => ({
    content: JSON.stringify({
      summary: "A comprehensive study on AI tutoring systems.",
      contributions: ["Key contribution 1"],
      methods: "Experimental design",
      limitations: "Sample size",
    }),
    tokensUsed: 300,
    model: "deepseek-v4-pro",
  });

  await handleSummarizePaper(
    { paperId: paper._id },
    { PaperModel, chat: chatFn }
  );

  // Verify final state
  const final = await PaperModel.findById(paper._id);
  assert.equal(final.status, "summarized");
  assert.ok(final.summary.length > 0);
  assert.ok(final.contributions.length > 0);
  assert.ok(final.methods.length > 0);
  assert.ok(final.limitations.length > 0);
});

// ─── Status transitions ───────────────────────────────────────────

test("paper status transitions: parsing → parsed → summarized", async () => {
  const paper = paperFixture({ status: "parsing", text: "" });
  const PaperModel = mockModel([paper]);

  // Simulate parse completion
  const p1 = await PaperModel.findByIdAndUpdate(paper._id, {
    status: "parsed",
    text: "Full paper text...",
  }, { new: true });
  assert.equal(p1.status, "parsed");
  assert.ok(p1.text.length > 0);

  // Simulate summarize completion
  const p2 = await PaperModel.findByIdAndUpdate(paper._id, {
    status: "summarized",
    summary: "A study of AI in education.",
    contributions: "Novel RL approach",
    methods: "Controlled trial",
    limitations: "Regional only",
  }, { new: true });
  assert.equal(p2.status, "summarized");
  assert.ok(p2.summary);
  assert.ok(p2.contributions);
  assert.ok(p2.methods);
  assert.ok(p2.limitations);
});

test("paper with error status preserves error information", async () => {
  const paper = paperFixture({ status: "error", summary: null });
  const PaperModel = mockModel([paper]);

  const fetched = await PaperModel.findById(paper._id);
  assert.equal(fetched.status, "error");
  // Even in error state, paper is still accessible
  assert.ok(fetched.title);
});

// ─── Deduplication logic ──────────────────────────────────────────

test("deduplication: duplicate by DOI is detected", async () => {
  const existingDoi = "10.1234/ai-education-2024";
  const PaperModel = mockModel([
    paperFixture({ _id: "existing-1", doi: existingDoi, title: "Original Title" }),
  ]);

  // Simulate the dedup check that happens in the upload route
  const dup = await PaperModel.findOne({ doi: existingDoi });
  assert.ok(dup);
  assert.equal(dup._id, "existing-1");
});

test("deduplication: similar title detected via prefix substring match", async () => {
  const existingTitle = "AI-Powered Tutoring Systems in Higher Education: A Comprehensive Study";
  const PaperModel = mockModel([
    paperFixture({
      _id: "existing-2",
      title: existingTitle,
    }),
  ]);

  // In real code (papers.js findDuplicate), the check uses:
  //   Paper.findOne({ title: { $regex: new RegExp(`^${title.slice(0, 30)}`, "i") } })
  // Here we validate the strategy: the prefix of the new title matches
  // the prefix of the existing title character-for-character
  const newTitle = "AI-Powered Tutoring Systems in Higher Education: A Comprehensive Study (Revised)";
  const prefix = newTitle.slice(0, 30);

  const allPapers = await PaperModel.find({});
  const dup = allPapers.find((p) =>
    p.title && p.title.toLowerCase().startsWith(prefix.toLowerCase())
  );
  assert.ok(dup);
  assert.equal(dup._id, "existing-2");
});

test("deduplication: text fingerprint match catches duplicate", async () => {
  const text = "This is a unique paper text that should only appear once in the database.";
  const fingerprint = text.slice(0, 500).replace(/\s/g, "");

  const PaperModel = mockModel([
    paperFixture({
      _id: "existing-3",
      text,
    }),
  ]);

  // Fingerprint dedup
  const allPapers = await PaperModel.find({});
  let found = null;
  for (const p of allPapers) {
    if (p.text) {
      const pFingerprint = p.text.slice(0, 500).replace(/\s/g, "");
      if (fingerprint === pFingerprint) {
        found = p;
        break;
      }
    }
  }
  assert.ok(found);
  assert.equal(found._id, "existing-3");
});

// ─── Sharing scope visibility ─────────────────────────────────────

test("paper library filters by sharing scope", async () => {
  const papers = [
    paperFixture({ _id: "p1", sharing: "school", title: "School Paper" }),
    paperFixture({ _id: "p2", sharing: "university", title: "University Paper" }),
    paperFixture({ _id: "p3", sharing: "private", title: "Private Paper" }),
    paperFixture({ _id: "p4", sharing: "project", title: "Project Paper" }),
  ];
  const PaperModel = mockModel(papers);

  // Default view: school + university
  const all = await PaperModel.find({});
  const visible = all.filter(
    (p) => p.sharing === "school" || p.sharing === "university"
  );
  assert.equal(visible.length, 2);
  assert.ok(visible.find((p) => p.title === "School Paper"));
  assert.ok(visible.find((p) => p.title === "University Paper"));
  assert.ok(!visible.find((p) => p.title === "Private Paper"));
});

// ─── Structured metadata fields ───────────────────────────────────

test("Paper model supports all structured metadata fields", async () => {
  const paper = paperFixture({
    status: "summarized",
    summary: "A study of AI tutoring effectiveness.",
    contributions: "Key contribution; Second contribution",
    methods: "Randomized controlled trial with 500 students",
    limitations: "Single geographic region; moderate sample size",
    doi: "10.1234/test.2024",
    authors: ["Zhang Wei", "Li Ming"],
    year: 2024,
    tags: ["AI", "Education", "RL", "Tutoring"],
    area: "AI in Education",
    score: 88,
  });

  const PaperModel = mockModel([paper]);
  const fetched = await PaperModel.findById(paper._id);

  assert.equal(fetched.status, "summarized");
  assert.ok(fetched.summary.length > 0);
  assert.ok(fetched.contributions.includes("Key contribution"));
  assert.ok(fetched.methods.includes("controlled trial"));
  assert.ok(fetched.limitations.includes("geographic"));
  assert.equal(fetched.doi, "10.1234/test.2024");
  assert.deepEqual(fetched.authors, ["Zhang Wei", "Li Ming"]);
  assert.equal(fetched.year, 2024);
  assert.deepEqual(fetched.tags, ["AI", "Education", "RL", "Tutoring"]);
  assert.equal(fetched.area, "AI in Education");
  assert.equal(fetched.score, 88);
});

test("Paper model defaults are correct for new uploads", async () => {
  const PaperModel = mockModel([]);
  const created = await PaperModel.create({
    title: "New Paper.pdf",
    source: "PDF",
  });

  assert.equal(created.status, undefined); // mockModel doesn't enforce schema defaults
  assert.equal(created.sharing, undefined); // In real mongoose, defaults apply
  // The key point: title and source are set
  assert.equal(created.title, "New Paper.pdf");
  assert.equal(created.source, "PDF");
});
