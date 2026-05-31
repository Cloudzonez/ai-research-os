import { chat } from "./deepseek.js";
import { getSummaryPrompt, buildSummaryContent } from "../prompts/paperSummarizer.js";

const DEFAULT_SUMMARY = {
  tldr: "",
  motivation: "",
  method: "",
  result: "",
  conclusion: "",
};

function parseSummaryJSON(text) {
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch {
    // Try to extract JSON block from markdown code fences
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1]);
      } catch {
        // continue
      }
    }
    // Try to find a JSON object in the text
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {
        // continue
      }
    }
    console.warn("paperSummarizer: failed to parse JSON from response");
    return null;
  }
}

function validateSummary(parsed) {
  const result = { ...DEFAULT_SUMMARY };
  if (!parsed || typeof parsed !== "object") return result;
  for (const field of Object.keys(DEFAULT_SUMMARY)) {
    if (typeof parsed[field] === "string" && parsed[field].trim()) {
      result[field] = parsed[field].trim();
    }
  }
  return result;
}

const API_DELAY_MS = 2000; // 2s between calls (less strict than arXiv API since this is our own LLM)

let _lastCall = 0;
async function delay() {
  const elapsed = Date.now() - _lastCall;
  if (elapsed < API_DELAY_MS) {
    await new Promise((r) => setTimeout(r, API_DELAY_MS - elapsed));
  }
  _lastCall = Date.now();
}

/**
 * Summarize a single paper abstract into structured analysis.
 * @param {object} paper — { title, abstract, authors }
 * @param {string} locale — "zh" | "en"
 * @returns {object} — { tldr, motivation, method, result, conclusion }
 */
export async function summarizePaper(paper, locale = "zh") {
  const abstract = paper.abstract || paper.summary || "";
  if (!abstract || abstract.length < 100) {
    return { ...DEFAULT_SUMMARY };
  }

  const systemPrompt = getSummaryPrompt(locale);
  const content = buildSummaryContent(paper);

  await delay();

  try {
    const result = await chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      locale,
      { temperature: 0.2, maxTokens: 1000, timeoutMs: 30_000 }
    );

    const parsed = parseSummaryJSON(result.content);
    return validateSummary(parsed);
  } catch (err) {
    console.warn(`paperSummarizer: AI call failed for "${paper.title?.slice(0, 80)}": ${err.message}`);
    return { ...DEFAULT_SUMMARY };
  }
}

/**
 * Batch-summarize multiple papers sequentially with rate limiting.
 * @param {Array<object>} papers
 * @param {object} options — { locale, onProgress }
 * @returns {Array<object>} — papers with aiSummary field added
 */
export async function summarizePapers(papers, options = {}) {
  const { locale = "zh", onProgress } = options;
  const results = [];

  for (let i = 0; i < papers.length; i++) {
    const aiSummary = await summarizePaper(papers[i], locale);
    const enriched = { ...papers[i], aiSummary };
    results.push(enriched);

    if (onProgress) {
      onProgress({ current: i + 1, total: papers.length, paper: enriched });
    }
  }

  return results;
}

export { DEFAULT_SUMMARY };
