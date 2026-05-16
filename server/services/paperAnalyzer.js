import { chat as defaultChat } from "./deepseek.js";

export async function extractMetadata(text, locale = "en", chatFn = defaultChat) {
  const prompt = locale === "zh"
    ? `从以下论文文本中提取元数据。返回JSON：{"title":"论文标题","authors":["作者1","作者2"],"year":2024,"doi":"10.xxx/xxx","abstract":"摘要内容"}。只返回JSON。\n\n论文文本：${text.slice(0, 6000)}`
    : `Extract metadata from this paper text. Return JSON: {"title":"Paper title","authors":["Author 1","Author 2"],"year":2024,"doi":"10.xxx/xxx","abstract":"Abstract text"}. Return ONLY JSON.\n\nPaper text: ${text.slice(0, 6000)}`;

  const result = await chatFn([{ role: "user", content: prompt }], locale);
  const jsonMatch = result.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in metadata response");

  const metadata = JSON.parse(jsonMatch[0]);
  return {
    title: metadata.title || "",
    authors: metadata.authors || [],
    year: metadata.year || new Date().getFullYear(),
    doi: metadata.doi || "",
    abstract: metadata.abstract || "",
    tokensUsed: result.tokensUsed,
  };
}

export async function summarizePaper(text, locale = "en", chatFn = defaultChat) {
  const prompt = locale === "zh"
    ? `分析以下论文文本，返回JSON：{"summary":"2-3句学术摘要","contributions":"主要贡献","methods":"研究方法","limitations":"已知局限"}。只返回JSON。\n\n论文文本：${text.slice(0, 8000)}`
    : `Analyze this paper text and return JSON: {"summary":"2-3 sentence academic summary","contributions":"key contributions","methods":"research methods","limitations":"stated limitations"}. Return ONLY JSON.\n\nPaper text: ${text.slice(0, 8000)}`;

  const result = await chatFn([{ role: "user", content: prompt }], locale);
  const jsonMatch = result.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in summary response");

  const analysis = JSON.parse(jsonMatch[0]);
  return {
    summary: analysis.summary || "",
    contributions: analysis.contributions || "",
    methods: analysis.methods || "",
    limitations: analysis.limitations || "",
    tokensUsed: result.tokensUsed,
  };
}

export async function extractClaims(text, locale = "en", chatFn = defaultChat) {
  const prompt = locale === "zh"
    ? `从以下论文提取3-5个关键声明，每个声明包含声明内容和支持证据。返回JSON：{"claims":[{"claim":"声明","evidence":"证据"}]}。只返回JSON。\n\n论文文本：${text.slice(0, 6000)}`
    : `Extract 3-5 key claims from this paper, each with claim text and supporting evidence. Return JSON: {"claims":[{"claim":"claim text","evidence":"evidence text"}]}. Return ONLY JSON.\n\nPaper text: ${text.slice(0, 6000)}`;

  const result = await chatFn([{ role: "user", content: prompt }], locale);
  const jsonMatch = result.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { claims: [] };

  const data = JSON.parse(jsonMatch[0]);
  return {
    claims: data.claims || [],
    tokensUsed: result.tokensUsed,
  };
}

export async function deduplicateByTitle(newTitle, existingPapers, chatFn = defaultChat) {
  const titles = existingPapers.map((p) => p.title);
  const prompt = `Compare this paper title with existing paper titles and determine if it's a duplicate. Return JSON: {"isDuplicate":true/false,"matchedTitle":"exact match or empty"}. Only return JSON.

New title: "${newTitle}"
Existing titles: ${JSON.stringify(titles)}`;

  const result = await chatFn([{ role: "user", content: prompt }], "en");
  const jsonMatch = result.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { isDuplicate: false, matchedTitle: "" };

  return JSON.parse(jsonMatch[0]);
}
