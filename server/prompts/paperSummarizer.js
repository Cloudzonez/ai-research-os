/**
 * paperSummarizer.js — Paper abstract → 5-field structured analysis prompts.
 *
 * Used by: server/services/paperSummarizer.js (summarizePaper)
 *
 * Extracts from paper abstract: tldr, motivation, method, result, conclusion.
 * Uses JSON-mode prompting. The DEFAULT_SUMMARY fallback is in paperSummarizer.js.
 *
 * Related capability: See CAPABILITIES.md §3 "Paper Processing Pipeline"
 */

export const SUMMARY_PROMPT_ZH = `你是一位专业的论文分析师。请分析以下论文摘要，用 JSON 格式返回分析结果。

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

export const SUMMARY_PROMPT_EN = `You are a professional paper analyst. Analyze the following paper abstract and return your analysis as JSON.

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

export function getSummaryPrompt(locale) {
  return locale === "zh" ? SUMMARY_PROMPT_ZH : SUMMARY_PROMPT_EN;
}

export function buildSummaryContent(paper) {
  return `Title: ${paper.title || "N/A"}\n\nAbstract: ${paper.abstract || paper.summary || ""}`;
}
