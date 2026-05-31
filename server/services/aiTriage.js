import { chat as defaultChat } from "./deepseek.js";
import { buildTriagePrompt as buildPrompt } from "../prompts/aiTriage.js";
import { getActiveDebugLog } from "./trackerDebugLog.js";

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
  const debugLog = getActiveDebugLog();
  const {
    PaperModel,
    chatFn = defaultChat,
    batchSize = BATCH_SIZE,
    minRelevance = DEFAULT_MIN_RELEVANCE,
  } = options;

  if (!paperIds || paperIds.length === 0) {
    if (debugLog) debugLog.warn("AI triage: no paper IDs provided, skipping");
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

  if (debugLog) debugLog.begin(`AI triage — ${paperIds.length} papers, tracker="${trackerSpec.name}"`);

  // Fetch all papers
  const allPapers = [];
  let skippedNotPending = 0;
  let skippedNotFound = 0;
  for (const id of paperIds) {
    const paper = await PaperModel.findById(id);
    if (!paper) {
      skippedNotFound++;
      if (debugLog) debugLog.detail(`AI triage: paper not found in DB`, { paperId: id });
      continue;
    }
    if (paper.status !== "triage_pending") {
      skippedNotPending++;
      if (debugLog) debugLog.detail(`AI triage: paper already has status "${paper.status}", skipping`, { paperId: id, title: paper.title?.slice(0, 60) });
      continue;
    }
    allPapers.push(paper);
  }

  if (debugLog) debugLog.info("AI triage: papers loaded", {
    requested: paperIds.length,
    pending: allPapers.length,
    skippedNotFound,
    skippedAlreadyTriaged: skippedNotPending,
  });

  if (allPapers.length === 0) {
    if (debugLog) debugLog.end("AI triage: no pending papers to triage", { totalRequested: paperIds.length, skipped: skippedNotPending + skippedNotFound });
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

  let batchNum = 0;
  for (const batch of batches) {
    batchNum++;
    if (debugLog) debugLog.begin(`AI triage: batch ${batchNum}/${batches.length} — ${batch.length} papers`);

    const prompt = buildPrompt(trackerSpec, batch);
    let assessments;

    try {
      const t0 = Date.now();
      const result = await chatFn(
        [{ role: "user", content: prompt }],
        "en",
        { temperature: 0.2, maxTokens: 4000 }
      );
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      if (debugLog) debugLog.detail(`AI triage: DeepSeek response received`, { elapsedSec: elapsed, promptLen: prompt.length, responseLen: result.content?.length || 0 });
      assessments = parseTriageResponse(result.content, batch.length);
    } catch (err) {
      if (debugLog) debugLog.error(`AI triage: DeepSeek call FAILED`, { error: err.message, batchSize: batch.length });
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
    let batchRelevant = 0;
    for (const assessment of assessments) {
      const paperIndex = assessment.index - 1;
      if (paperIndex < 0 || paperIndex >= batch.length) continue;

      const paper = batch[paperIndex];
      const relevance = clampScore(assessment.relevance);
      const category = normalizeCategory(assessment.category);
      const novelty = normalizeNovelty(assessment.novelty);
      const reasoning = String(assessment.reasoning || "").slice(0, 300);

      if (debugLog) debugLog.detail(`AI triage: paper scored`, {
        title: paper.title?.slice(0, 60),
        relevance,
        category,
        novelty,
        reasoning: reasoning.slice(0, 80),
      });

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
      if (relevance >= minRelevance) { totalRelevant++; batchRelevant++; }
      if (novelty === "breakthrough") totalBreakthroughs++;
      byCategory[category] = (byCategory[category] || 0) + 1;
    }

    if (debugLog) debugLog.end(`AI triage: batch ${batchNum} done`, { papers: batch.length, relevant: batchRelevant, irrelevant: batch.length - batchRelevant });
  }

  if (debugLog) debugLog.end("AI triage complete", {
    triaged: allPapers.length,
    relevant: totalRelevant,
    breakthroughs: totalBreakthroughs,
    byCategory,
  });

  return {
    totalCrawled: paperIds.length,
    triaged: allPapers.length,
    relevant: totalRelevant,
    breakthroughs: totalBreakthroughs,
    byCategory,
  };
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
