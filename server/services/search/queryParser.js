import { chat } from "../deepseek.js";
import { getCache, setCache } from "../cache.js";

const QUERY_PARSER_SYSTEM_PROMPT = `You are a research paper search query parser. Extract structured search intent from natural language queries.

Output ONLY valid JSON with this exact structure:
{
  "mainTopic": "core research topic",
  "keywords": ["key", "terms"],
  "filters": {
    "yearFrom": 2020,
    "yearTo": 2024,
    "authors": ["Author Name"],
    "studyType": "rct|cohort|case_study|meta_analysis|review|survey|experimental|theoretical",
    "population": "mice|humans|in-silico|cell-culture|other",
    "hasCode": true,
    "hasData": true,
    "venue": "journal or conference name",
    "language": "en|zh|es|de|fr|ja",
    "minCitations": 10
  },
  "searchQuery": "optimized search string for APIs",
  "sortBy": "relevance|citations|date",
  "maxResults": 20
}

Rules:
- Only include filters that are explicitly mentioned or strongly implied
- mainTopic should be concise (2-5 words)
- keywords should be 3-7 most important terms
- searchQuery should be optimized for academic search APIs
- studyType values: rct, cohort, case_study, meta_analysis, review, survey, experimental, theoretical
- population values: mice, humans, in-silico, cell-culture, other
- sortBy: relevance (default), citations (if "highly cited" mentioned), date (if "recent" mentioned)

Examples:

Input: "find papers showing X causes Y in mice"
Output: {"mainTopic":"X causes Y","keywords":["X","Y","causation","mice"],"filters":{"population":"mice"},"searchQuery":"X causes Y mice","sortBy":"relevance","maxResults":20}

Input: "RCTs on drug X since 2020"
Output: {"mainTopic":"drug X RCT","keywords":["drug X","randomized controlled trial","RCT"],"filters":{"studyType":"rct","yearFrom":2020},"searchQuery":"drug X randomized controlled trial","sortBy":"relevance","maxResults":20}

Input: "papers with code on transformers"
Output: {"mainTopic":"transformers","keywords":["transformers","neural networks","code"],"filters":{"hasCode":true},"searchQuery":"transformers neural networks implementation","sortBy":"relevance","maxResults":20}

Input: "highly cited meta-analyses on climate change"
Output: {"mainTopic":"climate change meta-analysis","keywords":["climate change","meta-analysis","systematic review"],"filters":{"studyType":"meta_analysis","minCitations":50},"searchQuery":"climate change meta-analysis","sortBy":"citations","maxResults":20}

Input: "recent papers on CRISPR in humans"
Output: {"mainTopic":"CRISPR humans","keywords":["CRISPR","gene editing","humans","clinical"],"filters":{"population":"humans","yearFrom":2023},"searchQuery":"CRISPR gene editing humans clinical","sortBy":"date","maxResults":20}`;

/**
 * Parse natural language query into structured search intent
 * @param {string} naturalLanguageQuery - User's natural language query
 * @param {Object} options - Parsing options
 * @param {string} options.locale - User locale (zh/en)
 * @param {string} options.model - LLM model to use
 * @returns {Promise<Object>} Structured search intent
 */
export async function parseQuery(naturalLanguageQuery, options = {}) {
  if (!naturalLanguageQuery || typeof naturalLanguageQuery !== "string") {
    throw new Error("Query must be a non-empty string");
  }

  const query = naturalLanguageQuery.trim();
  if (query.length === 0) {
    throw new Error("Query cannot be empty");
  }

  // Check cache first (1 hour TTL)
  const cacheKey = `query_parse:${query}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log("Query parser: Cache hit");
    return cached;
  }

  try {
    console.log("Query parser: Parsing query with LLM:", query);
    
    const response = await chat(
      [{ role: "user", content: query }],
      options.locale || "en",
      {
        model: options.model || "deepseek-v4-pro",
        temperature: 0.1, // Low temperature for consistent parsing
        maxTokens: 500,
        timeoutMs: 10000,
      }
    );

    // Extract JSON from response
    const content = response.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.warn("Query parser: No JSON found in LLM response, using fallback");
      return fallbackQueryParse(query);
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.warn("Query parser: Invalid JSON from LLM, using fallback");
      return fallbackQueryParse(query);
    }

    // Validate and normalize
    const intent = normalizeIntent(parsed, query);

    // Cache for 1 hour
    await setCache(cacheKey, intent, 3600);
    
    console.log("Query parser: Successfully parsed query");
    return intent;
  } catch (error) {
    console.error("Query parser error:", error.message);
    
    // Fallback to simple extraction
    console.log("Query parser: Using fallback parser");
    return fallbackQueryParse(query);
  }
}

/**
 * Normalize and validate parsed intent
 * @param {Object} parsed - Raw parsed object from LLM
 * @param {string} originalQuery - Original query for fallback
 * @returns {Object} Normalized intent
 */
function normalizeIntent(parsed, originalQuery) {
  const intent = {
    mainTopic: parsed.mainTopic || originalQuery,
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    filters: {},
    searchQuery: parsed.searchQuery || originalQuery,
    sortBy: parsed.sortBy || "relevance",
    maxResults: parsed.maxResults || 20,
  };

  // Validate and normalize filters
  if (parsed.filters && typeof parsed.filters === "object") {
    const filters = parsed.filters;

    // Year filters
    if (filters.yearFrom && typeof filters.yearFrom === "number") {
      intent.filters.yearFrom = Math.max(1900, Math.min(filters.yearFrom, new Date().getFullYear()));
    }
    if (filters.yearTo && typeof filters.yearTo === "number") {
      intent.filters.yearTo = Math.max(1900, Math.min(filters.yearTo, new Date().getFullYear()));
    }

    // Study type
    const validStudyTypes = ["rct", "cohort", "case_study", "meta_analysis", "review", "survey", "experimental", "theoretical"];
    if (filters.studyType && validStudyTypes.includes(filters.studyType)) {
      intent.filters.studyType = filters.studyType;
    }

    // Population
    const validPopulations = ["mice", "humans", "in-silico", "cell-culture", "other"];
    if (filters.population && validPopulations.includes(filters.population)) {
      intent.filters.population = filters.population;
    }

    // Boolean filters
    if (filters.hasCode === true) intent.filters.hasCode = true;
    if (filters.hasData === true) intent.filters.hasData = true;

    // Authors (array of strings)
    if (Array.isArray(filters.authors) && filters.authors.length > 0) {
      intent.filters.authors = filters.authors.filter(a => typeof a === "string" && a.length > 0);
    }

    // Venue
    if (filters.venue && typeof filters.venue === "string") {
      intent.filters.venue = filters.venue;
    }

    // Language
    const validLanguages = ["en", "zh", "es", "de", "fr", "ja"];
    if (filters.language && validLanguages.includes(filters.language)) {
      intent.filters.language = filters.language;
    }

    // Min citations
    if (filters.minCitations && typeof filters.minCitations === "number") {
      intent.filters.minCitations = Math.max(0, filters.minCitations);
    }
  }

  // Validate sortBy
  const validSortBy = ["relevance", "citations", "date"];
  if (!validSortBy.includes(intent.sortBy)) {
    intent.sortBy = "relevance";
  }

  // Validate maxResults
  intent.maxResults = Math.max(1, Math.min(intent.maxResults, 100));

  return intent;
}

/**
 * Fallback query parser using regex patterns
 * @param {string} query - Natural language query
 * @returns {Object} Basic search intent
 */
function fallbackQueryParse(query) {
  const intent = {
    mainTopic: query,
    keywords: extractKeywords(query),
    filters: {},
    searchQuery: query,
    sortBy: "relevance",
    maxResults: 20,
  };

  // Extract year range
  const yearMatch = query.match(/since\s+(\d{4})|after\s+(\d{4})|from\s+(\d{4})|in\s+(\d{4})/i);
  if (yearMatch) {
    const year = parseInt(yearMatch[1] || yearMatch[2] || yearMatch[3] || yearMatch[4]);
    intent.filters.yearFrom = year;
  }

  const yearRangeMatch = query.match(/(\d{4})\s*[-–—]\s*(\d{4})/);
  if (yearRangeMatch) {
    intent.filters.yearFrom = parseInt(yearRangeMatch[1]);
    intent.filters.yearTo = parseInt(yearRangeMatch[2]);
  }

  // Detect study type
  if (/\b(rct|randomized)\b/i.test(query)) {
    intent.filters.studyType = "rct";
  } else if (/\bcohort\b/i.test(query)) {
    intent.filters.studyType = "cohort";
  } else if (/\bmeta[-\s]?analysis\b/i.test(query)) {
    intent.filters.studyType = "meta_analysis";
  } else if (/\breview\b/i.test(query)) {
    intent.filters.studyType = "review";
  } else if (/\bsurvey\b/i.test(query)) {
    intent.filters.studyType = "survey";
  }

  // Detect population
  if (/\bmice\b|\bmouse\b/i.test(query)) {
    intent.filters.population = "mice";
  } else if (/\bhuman[s]?\b|\bpatient[s]?\b/i.test(query)) {
    intent.filters.population = "humans";
  } else if (/\bin[-\s]?silico\b|\bcomputational\b/i.test(query)) {
    intent.filters.population = "in-silico";
  }

  // Detect code/data requirements
  if (/\bcode\b|\bgithub\b|\bimplementation\b/i.test(query)) {
    intent.filters.hasCode = true;
  }
  if (/\bdata\b|\bdataset\b/i.test(query)) {
    intent.filters.hasData = true;
  }

  // Detect sort preference
  if (/\bhighly cited\b|\bmost cited\b|\bcitation[s]?\b/i.test(query)) {
    intent.sortBy = "citations";
    intent.filters.minCitations = 50;
  } else if (/\brecent\b|\blatest\b|\bnew\b/i.test(query)) {
    intent.sortBy = "date";
    const currentYear = new Date().getFullYear();
    intent.filters.yearFrom = currentYear - 2; // Last 2 years
  }

  return intent;
}

/**
 * Extract keywords from query text
 * @param {string} query - Query text
 * @returns {string[]} Array of keywords
 */
function extractKeywords(query) {
  // Remove common stop words
  const stopWords = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
    "to", "was", "will", "with", "find", "search", "papers", "paper",
    "research", "study", "studies"
  ]);

  const words = query
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Return unique keywords, max 7
  return [...new Set(words)].slice(0, 7);
}

/**
 * Parse multiple queries in batch
 * @param {string[]} queries - Array of queries
 * @param {Object} options - Parsing options
 * @returns {Promise<Object[]>} Array of parsed intents
 */
export async function parseQueriesBatch(queries, options = {}) {
  if (!Array.isArray(queries)) {
    throw new Error("Queries must be an array");
  }

  return Promise.all(
    queries.map(query => parseQuery(query, options).catch(error => {
      console.error(`Failed to parse query "${query}":`, error);
      return fallbackQueryParse(query);
    }))
  );
}

export default { parseQuery, parseQueriesBatch };

// Made with Bob
