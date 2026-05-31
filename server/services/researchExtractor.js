/**
 * AI-powered research topic extraction from natural language.
 *
 * Uses a lightweight DeepSeek call to parse user messages into structured
 * research intent objects — replacing brittle regex-based detection.
 */

import { chat, parseResponse } from "./deepseek.js";
import cache from "./cache.js";

// ── System prompt for extraction ────────────────────────────────
const EXTRACTION_PROMPT = `You are a research intent parser. Given a user message, determine whether the user wants to find academic papers or research materials.

Return ONLY a valid JSON object (no markdown, no explanation) in this exact format:
{
  "is_research": true or false,
  "main_topic": "primary research subject as a concise phrase",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "filters": {
    "year_from": null or number (e.g. 2023),
    "year_to": null or number,
    "authors": [],
    "field": null or string (e.g. "computer science", "biology", "education"),
    "publication_type": null or string (e.g. "journal", "conference", "preprint")
  },
  "search_query": "optimized Boolean search query string for academic API",
  "sort_by": "relevance" or "date" or "citations",
  "max_results": 10
}

Rules:
- Set is_research=true if the user is asking about academic topics, research, papers, studies, or scholarly work — even if they don't explicitly say "paper" or "find"
- Set is_research=true for any topic that could benefit from academic literature (e.g. "tell me about CRISPR" → true)
- Set is_research=false only for purely casual/non-academic messages (greetings, system questions, etc.)
- keywords should include synonyms, related technical terms, and alternate phrasings (3-6 keywords)
- search_query should use AND/OR operators and quotes for exact phrases (e.g. "deep learning" AND "medical imaging")
- If the user mentions "recent" or "latest" or "new", set sort_by to "date"
- If the user mentions "most cited" or "important" or "top", set sort_by to "citations"
- Extract year filters from phrases like "from 2023", "since 2020", "last 5 years", "2020-2024"
- For Chinese input, extract the same structured data
- max_results defaults to 10 unless the user specifies a number`;

// ── Default fallback result ─────────────────────────────────────
function defaultResult(message) {
  return {
    is_research: false,
    main_topic: "",
    keywords: [],
    filters: {
      year_from: null,
      year_to: null,
      authors: [],
      field: null,
      publication_type: null,
    },
    search_query: message.slice(0, 100),
    sort_by: "relevance",
    max_results: 10,
    _source: "default",
  };
}

// ── Regex fallback (legacy compatibility) ───────────────────────
function regexFallback(message) {
  const m = message.toLowerCase();

  // Check if it looks like a research query
  const researchPatterns = [
    /\b(find|search|look\s*for|discover|get|show|list|recommend|need|want|give)\b.*\b(paper|article|publication|research|study|studies)\b/,
    /\b(paper|article|publication|research)\b.*\b(about|on|related|regarding)\b/,
    /\b(latest|recent|new|top)\b.*\b(paper|article|research|study)\b/,
    /论文|文献|研究|查找.*论文|搜索.*论文|找.*论文|最新.*论文|相关.*论文|推荐.*论文|需要.*论文/,
    /\b(literature|survey|review)\b.*\b(on|about|for)\b/,
    /\bpaper(s)?\b/,
    /\bresearch\b.*\b(paper|article|study)\b/,
  ];

  const isResearch = researchPatterns.some((p) => p.test(m));
  if (!isResearch) return defaultResult(message);

  // Extract keywords by stripping stop words
  const keywords = message
    .replace(/[?？!！。，,.;；:：""''"\-\n]/g, " ")
    .replace(/(find|search|look for|get|show|list|give me|help me|please|i need|i want|can you|可以|帮我|查找|搜索|找|推荐|一些|相关|最新|论文|文献|paper|papers|article|articles|research|about|on|related to|the|a|an|for|of|in|and|or)/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 1);

  // Detect year filter
  let yearFrom = null;
  const yearMatch = message.match(/(?:from|since|after)\s+(\d{4})/i) || message.match(/(\d{4})\s*(?:onwards|以来|以后)/);
  if (yearMatch) yearFrom = parseInt(yearMatch[1], 10);

  // Detect "last N years"
  const lastYearsMatch = message.match(/last\s+(\d+)\s+years?/i) || message.match(/近(\d+)年/);
  if (lastYearsMatch) yearFrom = new Date().getFullYear() - parseInt(lastYearsMatch[1], 10);

  // Detect sort preference
  let sortBy = "relevance";
  if (/recent|latest|new|最新|近期/i.test(message)) sortBy = "date";
  if (/most cited|top cited|important|重要|高引/i.test(message)) sortBy = "citations";

  return {
    is_research: true,
    main_topic: keywords.slice(0, 5).join(" "),
    keywords: keywords.slice(0, 6),
    filters: {
      year_from: yearFrom,
      year_to: null,
      authors: [],
      field: null,
      publication_type: null,
    },
    search_query: keywords.join(" "),
    sort_by: sortBy,
    max_results: 10,
    _source: "regex_fallback",
  };
}

// ── Main extraction function ────────────────────────────────────

/**
 * Extract structured research intent from a natural language message.
 *
 * Uses DeepSeek with a focused prompt (~350 tokens total) to parse
 * the user's intent. Falls back to regex if AI call fails.
 *
 * @param {string} userMessage - The user's chat message
 * @param {string} locale - "zh" or "en"
 * @param {Function} [chatFn] - Optional override for chat function (for testing)
 * @returns {Promise<object>} Structured research intent
 */
export async function extractResearchIntent(userMessage, locale = "zh", chatFn = null) {
  // Check cache first
  const cacheKey = `research_intent:${cache.contextKey(userMessage)}`;
  const cached = cache.get(cacheKey);
  if (cached) return { ...cached, _source: "cache" };

  const callChat = chatFn || chat;

  try {
    const result = await callChat(
      [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: userMessage },
      ],
      locale,
      {
        temperature: 0.1,
        maxTokens: 400,
        timeoutMs: 8000,
      }
    );

    // Parse the AI's response — extract JSON
    const raw = result.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.warn("ResearchExtractor: No JSON found in AI response, using regex fallback");
      return regexFallback(userMessage);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    const intent = {
      is_research: Boolean(parsed.is_research),
      main_topic: String(parsed.main_topic || "").slice(0, 200),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String).slice(0, 10) : [],
      filters: {
        year_from: parsed.filters?.year_from ? Number(parsed.filters.year_from) : null,
        year_to: parsed.filters?.year_to ? Number(parsed.filters.year_to) : null,
        authors: Array.isArray(parsed.filters?.authors) ? parsed.filters.authors : [],
        field: parsed.filters?.field || null,
        publication_type: parsed.filters?.publication_type || null,
      },
      search_query: String(parsed.search_query || parsed.main_topic || userMessage).slice(0, 300),
      sort_by: ["relevance", "date", "citations"].includes(parsed.sort_by) ? parsed.sort_by : "relevance",
      max_results: Math.min(Math.max(parseInt(parsed.max_results) || 10, 1), 50),
      _source: "ai",
    };

    // Cache for 5 minutes
    cache.set(cacheKey, intent, 300000);

    return intent;
  } catch (err) {
    console.error("ResearchExtractor AI call failed, using regex fallback:", err.message);
    return regexFallback(userMessage);
  }
}

/**
 * Map sort_by value to OpenAlex sort parameter
 */
export function mapSortToOpenAlex(sortBy) {
  switch (sortBy) {
    case "date": return "publication_date:desc";
    case "citations": return "cited_by_count:desc";
    case "relevance": return "relevance_score:desc";
    default: return "cited_by_count:desc";
  }
}

export default { extractResearchIntent, mapSortToOpenAlex };
