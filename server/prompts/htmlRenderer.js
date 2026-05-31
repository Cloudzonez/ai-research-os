/**
 * htmlRenderer.js — Paper and digest HTML page generation prompts.
 *
 * Used by: server/services/htmlRenderer.js (generatePaperHTML, generateDigestHTML)
 *
 * Generates complete, standalone HTML pages for single papers and daily digests.
 * The LLM acts as an academic publishing specialist. Falls back to template
 * HTML if AI generation fails (fallbacks are in htmlRenderer.js, not here).
 *
 * Related capability: See CAPABILITIES.md §3 "Paper Processing Pipeline"
 */

export const HTML_PROMPT_ZH = `你是一位学术出版专家。请根据以下论文信息，生成一个完整的、美观的 HTML 页面，适合研究人员阅读。

设计要求：
- 完整独立的 HTML 文档（含 <!DOCTYPE html> 和内联 CSS）
- 现代、干净的设计风格，适合学术阅读
- 使用系统字体栈（system-ui, -apple-system, sans-serif）
- 配色方案：深蓝/石板色文字，白色背景，紫色/蓝色作为强调色
- 响应式布局，最大宽度 800px 居中
- 包含以下结构：
  1. 页眉：论文标题（大号加粗）、作者、分类标签
  2. 核心贡献卡片：TL;DR 概要（带渐变背景的突出卡片）
  3. 结构化分析区：动机、方法、实验结果、结论（每个一个区块，带图标标记）
  4. 原始摘要区（折叠式 <details> 组件）
  5. 页脚：链接区（arXiv、PDF、DOI）
- 良好的排版：1.6 行高，充足的段落间距，引用块样式
- 只返回 HTML 代码，不要任何解释文字`;

export const HTML_PROMPT_EN = `You are an academic publishing specialist. Generate a complete, beautiful HTML page based on the following paper information, suitable for researchers to read.

Design requirements:
- Complete standalone HTML document (with <!DOCTYPE html> and inline CSS)
- Modern, clean design suitable for academic reading
- System font stack (system-ui, -apple-system, sans-serif)
- Color scheme: dark blue/slate text, white background, purple/blue as accent
- Responsive layout, max-width 800px centered
- Include the following structure:
  1. Header: paper title (large bold), authors, category tags
  2. Core Contribution card: TL;DR summary (highlighted card with gradient background)
  3. Structured Analysis: Motivation, Method, Results, Conclusion (one section each with icon markers)
  4. Original Abstract (collapsible <details> component)
  5. Footer: links section (arXiv, PDF, DOI)
- Good typography: 1.6 line-height, generous spacing, blockquote styling
- Return ONLY the HTML code, no explanatory text`;

export function getHtmlPrompt(locale) {
  return locale === "zh" ? HTML_PROMPT_ZH : HTML_PROMPT_EN;
}

export function buildPaperInfoContent(paper) {
  const aiSummary = paper.aiSummary || {};
  return [
    `Title: ${paper.title || "N/A"}`,
    `Authors: ${(paper.authors || []).join(", ") || "N/A"}`,
    `Categories: ${(paper.categories || []).join(", ") || (paper.tags || []).join(", ") || "N/A"}`,
    `TL;DR: ${aiSummary.tldr || "N/A"}`,
    `Motivation: ${aiSummary.motivation || "N/A"}`,
    `Method: ${aiSummary.method || "N/A"}`,
    `Results: ${aiSummary.result || "N/A"}`,
    `Conclusion: ${aiSummary.conclusion || "N/A"}`,
    `Abstract: ${paper.abstract || paper.summary || "N/A"}`,
    `arXiv URL: ${paper.url || "N/A"}`,
    `PDF URL: ${paper.pdfUrl || "N/A"}`,
    `DOI: ${paper.doi || "N/A"}`,
  ].join("\n");
}

export function buildPaperHtmlUserPrompt(paperInfo, locale) {
  return locale === "zh"
    ? `请为以下论文生成一个美观的 HTML 页面：\n\n${paperInfo}`
    : `Generate a beautiful HTML page for the following paper:\n\n${paperInfo}`;
}

export const DIGEST_PROMPT_ZH = `你是一位学术出版专家。请根据提供的论文列表，生成一个完整的每日论文摘要 HTML 页面。设计现代、干净，适合学术阅读。包含目录（按类别分组）、每篇论文的 TL;DR 和链接。返回完整 HTML 文档。`;

export const DIGEST_PROMPT_EN = `You are an academic publishing specialist. Generate a complete daily paper digest HTML page from the provided paper list. Modern, clean design for academic reading. Include a table of contents (grouped by category), TL;DR for each paper, and links. Return complete HTML document.`;

export function getDigestPrompt(locale) {
  return locale === "zh" ? DIGEST_PROMPT_ZH : DIGEST_PROMPT_EN;
}

export function buildDigestUserPrompt(papersText, date) {
  return `Date: ${date}\n\n${papersText}`;
}
