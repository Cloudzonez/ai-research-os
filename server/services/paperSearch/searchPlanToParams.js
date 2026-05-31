import { chat, parseResponse } from "../deepseek.js";
import { config } from "../../../config.js";

export async function searchPlanToParams(naturalLanguageQuery, options = {}) {
  const {
    locale = "en",
    providers: availableProviders,
  } = options;

  const providerList = (availableProviders || ["arxiv", "openalex", "semantic_scholar", "crossref"]).join(", ");

  const prompt = `Convert this research query into structured search parameters: "${naturalLanguageQuery}"

Available providers: ${providerList}

Return ONLY valid JSON (no markdown, no explanation):
{
  "query": "optimized search keywords",
  "providers": ["best matching provider names from the available list"],
  "filters": { "yearMin": 2020, "yearMax": 2026, "type": "journal-article or null", "oaOnly": false },
  "maxResults": 25
}

Rules:
- Extract the core research topic as query keywords. Remove filler words like "find", "search for", "I want", "give me".
- Choose providers based on the domain: CS/AI/math/physics/statistics → arxiv, openalex, semantic_scholar. Biomedical/medical/life science → pubmed. General → crossref, openalex.
- Detect year ranges from phrases like "recent" (last 2 years), "last 3 years", "2023-2025", "since 2020", "after 2019".
- Detect article type: "preprints", "journal articles", "conference papers", "reviews", "survey".
- Default to 25 results. Only change if a specific number is mentioned.
- Detect if user wants open access only ("free", "open access", "OA").`;

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
