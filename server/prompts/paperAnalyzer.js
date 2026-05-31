/**
 * paperAnalyzer.js — Paper text analysis prompts (metadata, summary, claims, dedup).
 *
 * Used by: server/services/paperAnalyzer.js
 *
 * Four functions: extractMetadata (title, authors, year, doi, abstract),
 * summarizePaper (2-3 sentence academic summary with contributions/methods/limitations),
 * extractClaims (3-5 key claims with evidence), dedup (title-based duplicate detection).
 * All accept up to 6000-8000 chars of paper text.
 *
 * Related capability: See CAPABILITIES.md §3 "Paper Processing Pipeline", Paper Model
 */

export function extractMetadataZh(text) {
  return `从以下论文文本中提取元数据。返回JSON：{"title":"论文标题","authors":["作者1","作者2"],"year":2024,"doi":"10.xxx/xxx","abstract":"摘要内容"}。只返回JSON。\n\n论文文本：${text.slice(0, 6000)}`;
}

export function extractMetadataEn(text) {
  return `Extract metadata from this paper text. Return JSON: {"title":"Paper title","authors":["Author 1","Author 2"],"year":2024,"doi":"10.xxx/xxx","abstract":"Abstract text"}. Return ONLY JSON.\n\nPaper text: ${text.slice(0, 6000)}`;
}

export function extractMetadata(text, locale) {
  return locale === "zh" ? extractMetadataZh(text) : extractMetadataEn(text);
}

export function summarizePaperZh(text) {
  return `分析以下论文文本，返回JSON：{"summary":"2-3句学术摘要","contributions":"主要贡献","methods":"研究方法","limitations":"已知局限"}。只返回JSON。\n\n论文文本：${text.slice(0, 8000)}`;
}

export function summarizePaperEn(text) {
  return `Analyze this paper text and return JSON: {"summary":"2-3 sentence academic summary","contributions":"key contributions","methods":"research methods","limitations":"stated limitations"}. Return ONLY JSON.\n\nPaper text: ${text.slice(0, 8000)}`;
}

export function summarizePaper(text, locale) {
  return locale === "zh" ? summarizePaperZh(text) : summarizePaperEn(text);
}

export function extractClaimsZh(text) {
  return `从以下论文提取3-5个关键声明，每个声明包含声明内容和支持证据。返回JSON：{"claims":[{"claim":"声明","evidence":"证据"}]}。只返回JSON。\n\n论文文本：${text.slice(0, 6000)}`;
}

export function extractClaimsEn(text) {
  return `Extract 3-5 key claims from this paper, each with claim text and supporting evidence. Return JSON: {"claims":[{"claim":"claim text","evidence":"evidence text"}]}. Return ONLY JSON.\n\nPaper text: ${text.slice(0, 6000)}`;
}

export function extractClaims(text, locale) {
  return locale === "zh" ? extractClaimsZh(text) : extractClaimsEn(text);
}

export function buildDedupPrompt(newTitle, existingTitles) {
  const titles = existingTitles.map((p) => p.title);
  return `Compare this paper title with existing paper titles and determine if it's a duplicate. Return JSON: {"isDuplicate":true/false,"matchedTitle":"exact match or empty"}. Only return JSON.

New title: "${newTitle}"
Existing titles: ${JSON.stringify(titles)}`;
}
