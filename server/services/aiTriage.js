import { chat as defaultChat } from "./deepseek.js";

const BATCH_SIZE = 25;
const DEFAULT_MIN_RELEVANCE = 5;

/**
 * Run AI triage on a batch of newly crawled papers for a tracker.
 * Sends papers to DeepSeek in batches of BATCH_SIZE, parses the
 * assessments, and updates each Paper document with triage fields.
 *
 * @param {object} trackerSpec — { name, keywords, signals }
 * @param {string[]} paperIds — array of Paper _id strings
 * @param {object} options
 * @param {object} options.PaperModel — Paper model (DI for testing)
 * @param {Function} options.chatFn — DeepSeek chat function (DI for testing)
 * @param {number} options.batchSize — override batch size (default 25)
 * @param {number} options.minRelevance — threshold for "relevant" (default 5)
 * @returns {Promise<TriageSummary>}
 */
export async function runAITriage(trackerSpec, paperIds, options = {}) {
  const {
    PaperModel,
    chatFn = defaultChat,
    batchSize = BATCH_SIZE,
    minRelevance = DEFAULT_MIN_RELEVANCE,
  } = options;

  if (!paperIds || paperIds.length === 0) {
    return {
      totalCrawled: 0,
      triaged: 0,
      relevant: 0,
      breakthroughs: 0,
      byCategory: {},
    };
  }

  if (!PaperModel) {
    throw new Error("PaperModel is required for runAITriage");
  }

  // Fetch all papers
  const allPapers = [];
  for (const id of paperIds) {
    const paper = await PaperModel.findById(id);
    if (paper && paper.status === "triage_pending") {
      allPapers.push(paper);
    }
  }

  if (allPapers.length === 0) {
    return {
      totalCrawled: paperIds.length,
      triaged: 0,
      relevant: 0,
      breakthroughs: 0,
      byCategory: {},
    };
  }

  // Process in batches
  const batches = [];
  for (let i = 0; i < allPapers.length; i += batchSize) {
    batches.push(allPapers.slice(i, i + batchSize));
  }

  let totalRelevant = 0;
  let totalBreakthroughs = 0;
  const byCategory = {};

  for (const batch of batches) {
    const prompt = buildTriagePrompt(trackerSpec, batch);
    let assessments;

    try {
      const result = await chatFn(
        [{ role: "user", content: prompt }],
        "en",
        { temperature: 0.2, maxTokens: 4000 }
      );
      assessments = parseTriageResponse(result.content, batch.length);
    } catch (err) {
      console.error("AI triage call failed:", err.message);
      // Mark remaining papers as triaged with default values on AI failure
      assessments = batch.map((_, i) => ({
        index: i + 1,
        relevance: 0,
        category: "unrelated",
        novelty: "unknown",
        reasoning: `AI triage failed: ${err.message}`,
      }));
    }

    // Update each paper with its assessment
    for (const assessment of assessments) {
      const paperIndex = assessment.index - 1;
      if (paperIndex < 0 || paperIndex >= batch.length) continue;

      const paper = batch[paperIndex];
      const relevance = clampScore(assessment.relevance);
      const category = normalizeCategory(assessment.category);
      const novelty = normalizeNovelty(assessment.novelty);
      const reasoning = String(assessment.reasoning || "").slice(0, 300);

      // Update paper in DB
      if (paper.save) {
        paper.triageRelevance = relevance;
        paper.triageCategory = category;
        paper.triageNovelty = novelty;
        paper.triageReasoning = reasoning;
        paper.triagedAt = new Date();
        paper.status = "triaged";
        await paper.save();
      }

      // Tally stats
      if (relevance >= minRelevance) totalRelevant++;
      if (novelty === "breakthrough") totalBreakthroughs++;
      byCategory[category] = (byCategory[category] || 0) + 1;
    }
  }

  return {
    totalCrawled: paperIds.length,
    triaged: allPapers.length,
    relevant: totalRelevant,
    breakthroughs: totalBreakthroughs,
    byCategory,
  };
}

// ─── Prompt builder ────────────────────────────────────────────────

function buildTriagePrompt(spec, papers) {
  const topic = spec.name || spec.keywords?.join(", ") || "research";
  const keywords = (spec.keywords || []).join(", ");

  const paperEntries = papers
    .map((p, i) => {
      const title = p.title || "Untitled";
      const abs = (p.abstract || p.summary || "").slice(0, 500);
      return `[${i + 1}] Title: ${title}\n    Abstract: ${abs}`;
    })
    .join("\n\n");

  return `You are triaging research papers for a tracker on: "${topic}".
Keywords: ${keywords || "none"}

For each paper below, assess its relevance to the topic. Return a JSON object:

{
  "assessments": [
    {
      "index": 1,
      "relevance": 8,
      "category": "method",
      "novelty": "interesting",
      "reasoning": "Directly applies multi-agent RL to classroom settings with empirical results."
    }
  ]
}

Scoring guide:
- relevance: 0-10 (0=completely unrelated, 5=somewhat relevant, 8=directly relevant, 10=exact match to research question)
- category: "method" (new technique/algorithm), "application" (applied to a domain), "theory" (theoretical analysis), "survey" (literature review), "dataset" (new dataset/benchmark), "tool" (software/library), "unrelated"
- novelty: "breakthrough" (potentially field-changing), "interesting" (notable contribution), "incremental" (small improvement), "unknown" (cannot determine)
- reasoning: 1 sentence explaining the assessment

Papers:
${paperEntries}

Return ONLY the JSON object. No other text.`;
}

// ─── Response parser ───────────────────────────────────────────────

function parseTriageResponse(content, expectedCount) {
  const jsonMatch = String(content).match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in triage response");
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`Failed to parse triage JSON: ${e.message}`);
  }

  if (!parsed.assessments || !Array.isArray(parsed.assessments)) {
    throw new Error("Triage response missing 'assessments' array");
  }

  return parsed.assessments;
}

// ─── Normalizers ───────────────────────────────────────────────────

function clampScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(10, Math.round(num)));
}

function normalizeCategory(value) {
  const valid = new Set([
    "method", "application", "theory", "survey", "dataset", "tool", "unrelated",
  ]);
  const normalized = String(value || "").toLowerCase().trim();
  return valid.has(normalized) ? normalized : "unrelated";
}

function normalizeNovelty(value) {
  const valid = new Set(["breakthrough", "interesting", "incremental", "unknown"]);
  const normalized = String(value || "").toLowerCase().trim();
  return valid.has(normalized) ? normalized : "unknown";
}

export default { runAITriage };
