import { chat, parseResponse } from "../deepseek.js";
import { config } from "../../../config.js";
import { buildSearchPlanPrompt } from "../../prompts/searchPlan.js";

export async function searchPlanToParams(naturalLanguageQuery, options = {}) {
  const {
    locale = "en",
    providers: availableProviders,
  } = options;

  const providerList = (availableProviders || ["arxiv", "openalex", "semantic_scholar", "crossref"]).join(", ");

  const prompt = buildSearchPlanPrompt(naturalLanguageQuery, providerList);

  try {
    const result = await chat(
      [{ role: "user", content: prompt }],
      locale,
      { temperature: 0.1, maxTokens: 500, model: config.crawlerModel }
    );

    const { text } = parseResponse(result.content);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return buildFallback(naturalLanguageQuery, providerList);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      query: parsed.query || extractKeywords(naturalLanguageQuery),
      providers: parsed.providers || ["openalex", "crossref", "semantic_scholar", "arxiv"],
      filters: {
        yearMin: parsed.filters?.yearMin || null,
        yearMax: parsed.filters?.yearMax || null,
        type: parsed.filters?.type || null,
        oaOnly: parsed.filters?.oaOnly || false,
      },
      maxResults: clampNumber(parsed.maxResults, 5, 100),
    };
  } catch {
    return buildFallback(naturalLanguageQuery, providerList);
  }
}

function buildFallback(query, providerList) {
  return {
    query: extractKeywords(query),
    providers: ["openalex", "crossref", "semantic_scholar", "arxiv"],
    filters: { yearMin: null, yearMax: null, type: null, oaOnly: false },
    maxResults: 25,
  };
}

function extractKeywords(text) {
  const stopWords = new Set([
    "find", "search", "for", "me", "i", "want", "need", "get", "give",
    "papers", "paper", "about", "the", "a", "an", "is", "are", "was",
    "were", "be", "been", "being", "have", "has", "had", "do", "does",
    "did", "will", "would", "could", "should", "may", "might", "can",
    "shall", "to", "of", "in", "on", "at", "by", "with", "from", "as",
    "into", "through", "during", "before", "after", "above", "below",
    "between", "and", "or", "not", "no", "nor", "so", "than", "too",
    "very", "just", "please", "thanks", "recent", "latest", "new",
    "帮我", "查找", "搜索", "找", "论文", "的", "最新", "相关",
  ]);

  return String(text || "")
    .replace(/[^\w\s一-鿿-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w.toLowerCase()))
    .join(" ")
    .trim();
}

function clampNumber(value, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, Math.round(num)));
}

export default { searchPlanToParams };
