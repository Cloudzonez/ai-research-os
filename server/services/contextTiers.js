// ─── Context pyramid tier configuration ───────────────────────────
// Each tier defines which paper fields are included and the estimated
// tokens per paper. Higher tiers build on lower tiers.

export const TIERS = {
  0: {
    label: "metadata",
    fields: ["title", "authors", "year", "source", "score", "doi"],
    tokensPerPaper: 50,
    description: "title, authors, year, source, score, doi",
  },
  1: {
    label: "abstract",
    fields: ["title", "authors", "year", "source", "score", "doi", "abstract"],
    tokensPerPaper: 200,
    description: "T0 + abstract (~200 tokens)",
  },
  2: {
    label: "structured_summary",
    fields: [
      "title", "authors", "year", "source", "score", "doi",
      "abstract", "summary", "contributions", "methods", "limitations",
    ],
    tokensPerPaper: 500,
    description: "T1 + summary + contributions + methods + limitations (~500 tokens)",
  },
  3: {
    label: "evidence_cards",
    fields: [
      "title", "authors", "year", "source", "score", "doi",
      "abstract", "summary", "contributions", "methods", "limitations",
      "evidenceCards",
    ],
    tokensPerPaper: 1000,
    description: "T2 + extracted claims with source sections (~1000 tokens)",
  },
  4: {
    label: "chunked_full_text",
    fields: [
      "title", "authors", "year", "source", "score", "doi",
      "abstract", "summary", "contributions", "methods", "limitations",
      "textChunks",
    ],
    tokensPerPaper: 3000,
    description: "T2 + relevant full-text chunks (~3000+ tokens)",
    maxChunks: 3,
    chunkSize: 2000,
  },
};

export const DEFAULT_TIER = 1;
export const MAX_CONTEXT_TOKENS = 8000;

// ─── Query classification for auto-tier selection ─────────────────

/**
 * Select the appropriate context tier for a given user query.
 * Pure function — no side effects, easy to test.
 *
 * @param {string} query - The user's natural language query
 * @param {string} [locale="zh"] - Language hint for keyword matching
 * @returns {number} Tier 0-4
 */
export function selectTierForQuery(query, locale = "zh") {
  if (!query || query.trim().length < 5) return DEFAULT_TIER;

  const normalized = query.trim().toLowerCase();

  // Tier 0: simple lookup, existence check, count
  if (isTier(0, normalized)) return 0;

  // Tier 4: deep analysis (check first — these queries are distinctive)
  if (isTier(4, normalized)) return 4;

  // Tier 3: evidence and claims
  if (isTier(3, normalized)) return 3;

  // Tier 2: comparison, methodology, analysis
  if (isTier(2, normalized)) return 2;

  // Tier 1: factual questions / what-is
  if (isTier(1, normalized)) return 1;

  // Long or multi-sentence queries default to Tier 2
  if (query.split(/[.。！!？?\n]/).length > 2) return 2;
  if (query.split(/\s+/).length > 10 || query.length > 60) return 2;

  return DEFAULT_TIER;
}

// ─── Tier detection heuristics ────────────────────────────────────

const PATTERNS = {
  0: [
    /\b(find|search|list|show|count|how many|get|crawl)/i,
    /(查找|列出|搜索|计数|多少|有哪些|抓取|爬取)/,
  ],
  1: [
    /\b(abstract|what is|overview|introduction|summarize|describe|tell me about)/i,
    /(摘要|概述|介绍|背景|是什么|总结|描述)/,
  ],
  2: [
    /\b(compare|contrast|method|approach|contribution|limitation|analyze|evaluate|critique)/i,
    /(对比|比较|方法|贡献|局限|分析|评价|优缺点|综述)/,
  ],
  3: [
    /\b(evidence|claim|proof|support|verify|validate|cite|citation)/i,
    /(证据|声称|证明|验证|引用|出处|支撑)/,
  ],
  4: [
    /\b(related work|literature review|detailed review|deep dive|thorough|in depth|comprehensive|exhaustive)/i,
    /(相关工作|文献综述|深入|详细|全面|仔细|透彻)/,
  ],
};

function isTier(tier, normalized) {
  return PATTERNS[tier].some((pattern) => pattern.test(normalized));
}

export default { TIERS, DEFAULT_TIER, MAX_CONTEXT_TOKENS, selectTierForQuery };
