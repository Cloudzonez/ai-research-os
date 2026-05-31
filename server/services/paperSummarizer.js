import { chat } from "./deepseek.js";

// Schema for structured paper analysis.
// Absorbed from Daily-arXiv's ai/structure.py — the same 5 fields
// they extract: tldr, motivation, method, result, conclusion.
// We use JSON-mode prompting rather than function-calling since
// DeepSeek doesn't support tool-use in the same way.

const SUMMARY_PROMPT_ZH = `你是一位专业的论文分析师。请分析以下论文摘要，用 JSON 格式返回分析结果。

要求：
- 每个字段用 2-4 句话，简洁有力
- 使用中文回答
- 只返回 JSON，不要有其他文字

返回格式：
{
  "tldr": "一句话概括这篇论文的核心贡献",
  "motivation": "这篇论文要解决什么问题？为什么重要？",
  "method": "作者使用了什么方法或技术路线？",
  "result": "主要实验结果或发现是什么？",
  "conclusion": "结论是什么？对未来研究有什么意义？"
}`;

const SUMMARY_PROMPT_EN = `You are a professional paper analyst. Analyze the following paper abstract and return your analysis as JSON.

Requirements:
- 2-4 sentences per field, concise and insightful
- Return ONLY JSON, no other text

Return format:
{
  "tldr": "One-sentence summary of the core contribution",
  "motivation": "What problem does this solve? Why is it important?",
  "method": "What methods or technical approach did the authors use?",
  "result": "What are the main experimental results or findings?",
  "conclusion": "What is the conclusion? What are the implications for future research?"
}`;

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

  const systemPrompt = locale === "zh" ? SUMMARY_PROMPT_ZH : SUMMARY_PROMPT_EN;
  const content = `Title: ${paper.title || "N/A"}\n\nAbstract: ${abstract}`;

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
