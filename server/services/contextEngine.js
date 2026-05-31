import Paper from "../models/Paper.js";
import { chat as defaultChat } from "./deepseek.js";
import { TIERS as defaultTiers, DEFAULT_TIER, MAX_CONTEXT_TOKENS, selectTierForQuery as defaultTierSelector } from "./contextTiers.js";
import { selectRelevantChunks } from "./textChunker.js";
import { buildRelevanceRankingPrompt } from "../prompts/contextEngine.js";

const CHARS_PER_TOKEN = 3; // rough estimate

export async function buildContextBundle(query, options = {}) {
  const {
    userId,
    schoolId,
    locale = "zh",
    maxPapers = 5,
    paperId,
    tier = null,                       // null = auto-select
    PaperModel = Paper,
    chatFn = defaultChat,
    contextTiers = defaultTiers,
    textChunker = { selectRelevantChunks },
    tierSelector = defaultTierSelector,
  } = options;

  // Step 0: Determine effective tier
  const effectiveTier = tier ?? tierSelector(query, locale);
  const tierConfig = contextTiers[effectiveTier] || contextTiers[DEFAULT_TIER];

  // Step 1: Fetch candidate papers
  let papers;

  if (paperId) {
    const paper = await PaperModel.findById(paperId).lean();
    papers = paper ? [paper] : [];
  } else if (isRecentCrawlQuery(query)) {
    papers = await PaperModel.find().sort({ createdAt: -1 }).limit(20).lean();
  } else if (query && query.length > 0) {
    try {
      papers = await PaperModel.find(
        { $text: { $search: query } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(20)
        .lean();
    } catch {
      const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      papers = await PaperModel.find({
        $or: [{ title: regex }, { abstract: regex }, { tags: regex }],
      })
        .limit(20)
        .lean();
    }
  } else {
    papers = await PaperModel.find().sort({ createdAt: -1 }).limit(20).lean();
  }

  // Step 2: Apply sharing scope filter
  papers = papers.filter(
    (p) => p.sharing === "school" || p.sharing === "university"
  );

  // Step 3: Rank by relevance if we have more than maxPapers
  let rankedPapers = papers;
  if (papers.length > maxPapers && query) {
    try {
      const titles = papers.map((p, i) => `[${i}] ${p.title}`).join("\n");
      const prompt = buildRelevanceRankingPrompt(query, titles, maxPapers);

      const result = await chatFn([{ role: "user", content: prompt }], locale);
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const { rankings } = JSON.parse(jsonMatch[0]);
        const ranked = [];
        const seen = new Set();
        for (const idx of rankings.slice(0, maxPapers)) {
          if (papers[idx] && !seen.has(idx)) {
            ranked.push(papers[idx]);
            seen.add(idx);
          }
        }
        rankedPapers = ranked.length > 0 ? ranked : papers.slice(0, maxPapers);
      }
    } catch {
      rankedPapers = papers.slice(0, maxPapers);
    }
  } else {
    rankedPapers = papers.slice(0, maxPapers);
  }

  // Step 4: Build tier-aware paper cards, enforcing MAX_CONTEXT_TOKENS
  const perPaperBudget = Math.floor(MAX_CONTEXT_TOKENS / maxPapers);
  let contextPapers = rankedPapers.map((p) =>
    buildPaperCard(p, effectiveTier, tierConfig, query, textChunker)
  );

  // Enforce MAX_CONTEXT_TOKENS ceiling — trim lowest-relevance papers
  let totalEstimatedTokens = contextPapers.reduce(
    (s, p) => s + (p._estimatedTokens || 0),
    0
  );
  while (
    contextPapers.length > 1 &&
    totalEstimatedTokens > MAX_CONTEXT_TOKENS
  ) {
    const removed = contextPapers.pop();
    totalEstimatedTokens -= removed._estimatedTokens || 0;
  }

  return {
    tokens: totalEstimatedTokens,
    artifacts: contextPapers.length,
    allowedPercent: 100,
    papers: contextPapers,
    query,
    builtAt: new Date().toISOString(),
    source: "context_engine",
    tier: effectiveTier,
    tierLabel: tierConfig.label,
    perPaperBudget,
  };
}

// ─── Paper card builder per tier ───────────────────────────────────

function buildPaperCard(paper, tier, tierConfig, query, textChunker) {
  const card = {
    title: paper.title,
    source: paper.source,
    area: paper.area,
    score: paper.score,
    sharing: paper.sharing,
    tags: paper.tags || [],
    doi: paper.doi || "",
    summary: paper.summary || "",
    id: paper._id?.toString(),
    relevance: 0,
    createdAt: paper.createdAt,
  };

  // Tier 0+: authors, year
  card.authors = paper.authors || [];
  card.year = paper.year || null;

  // Tier 1+: abstract
  if (tier >= 1 && paper.abstract) {
    card.abstract = paper.abstract;
  }

  // Tier 2+: structured summary fields
  if (tier >= 2) {
    card.summary = paper.summary || "";
    card.contributions = paper.contributions || "";
    card.methods = paper.methods || "";
    card.limitations = paper.limitations || "";
  }

  // Tier 3+: evidence cards (from cached field or empty)
  if (tier >= 3) {
    card.evidenceCards = paper.evidenceCards || [];
  }

  // Tier 4+: relevant full-text chunks
  if (tier >= 4 && paper.text) {
    const maxChunks = tierConfig.maxChunks || 3;
    const chunkSize = tierConfig.chunkSize || 2000;
    card.textChunks = textChunker.selectRelevantChunks(
      paper.text,
      query,
      maxChunks,
      chunkSize
    );
    card.textChunkCount = card.textChunks.length;
  }

  // Always store the full text for the system prompt (truncation happens in aiRouter)
  card.text = paper.text || "";

  card._estimatedTokens = estimateTierTokens(card, tier);

  return card;
}

// ─── Token estimation ─────────────────────────────────────────────

function estimateTierTokens(card, tier) {
  let totalChars = 0;

  // Metadata always counted
  totalChars += (card.title || "").length;
  totalChars += (card.doi || "").length;
  if (card.authors) {
    totalChars += card.authors.join(", ").length;
  }
  totalChars += String(card.year || "").length;
  totalChars += (card.source || "").length;

  // Tier 1: abstract
  if (tier >= 1 && card.abstract) {
    totalChars += card.abstract.length;
  }

  // Tier 2: summary + contributions + methods + limitations
  if (tier >= 2) {
    if (card.summary) totalChars += card.summary.length;
    if (card.contributions) totalChars += card.contributions.length;
    if (card.methods) totalChars += card.methods.length;
    if (card.limitations) totalChars += card.limitations.length;
  }

  // Tier 3: evidence cards
  if (tier >= 3 && card.evidenceCards) {
    for (const ec of card.evidenceCards) {
      totalChars += (ec.claim || "").length + (ec.evidence || "").length;
    }
  }

  // Tier 4: text chunks
  if (tier >= 4 && card.textChunks) {
    for (const tc of card.textChunks) {
      totalChars += tc.text.length;
    }
  }

  return Math.ceil(totalChars / CHARS_PER_TOKEN);
}

// ─── Helpers ──────────────────────────────────────────────────────

function isRecentCrawlQuery(query) {
  const text = String(query || "").toLowerCase();
  return /just crawled|recently crawled|newly crawled|latest crawl|crawled papers|papers.*crawled|刚刚.*(爬取|抓取|采集)|最新.*(爬取|抓取|采集)|(爬取|抓取|采集)的/.test(text);
}

export async function getRelevantPapers(userQuery, locale = "zh", options = {}) {
  const context = await buildContextBundle(userQuery, { ...options, locale, maxPapers: 8 });
  return context.papers;
}

export { DEFAULT_TIER, MAX_CONTEXT_TOKENS };

export default { buildContextBundle, getRelevantPapers };
