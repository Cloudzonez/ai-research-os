import { chat as defaultChat } from "./deepseek.js";
import {
  extractMetadata as buildExtractMetaPrompt,
  summarizePaper as buildSummarizePromptText,
  extractClaims as buildExtractClaimsPrompt,
  buildDedupPrompt,
} from "../prompts/paperAnalyzer.js";

export async function extractMetadata(text, locale = "en", chatFn = defaultChat) {
  const prompt = buildExtractMetaPrompt(text, locale);

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
  const prompt = buildSummarizePromptText(text, locale);

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
  const prompt = buildExtractClaimsPrompt(text, locale);

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
  const prompt = buildDedupPrompt(newTitle, existingPapers);

  const result = await chatFn([{ role: "user", content: prompt }], "en");
  const jsonMatch = result.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { isDuplicate: false, matchedTitle: "" };

  return JSON.parse(jsonMatch[0]);
}
