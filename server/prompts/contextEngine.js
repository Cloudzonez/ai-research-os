/**
 * contextEngine.js — Paper relevance ranking prompt.
 *
 * Used by: server/services/contextEngine.js (buildContextBundle)
 *
 * Zero-shot LLM ranker: given a query and list of paper titles, ranks them
 * by relevance and returns the top-k indices. Used before building the
 * tiered context bundle for chat.
 *
 * Related capability: See CAPABILITIES.md §3 "Paper Model Fields"
 */

export function buildRelevanceRankingPrompt(query, titles, maxPapers) {
  return `Rank these papers by relevance to the query: "${query}". Return JSON: {"rankings":[index numbers by relevance, most relevant first, max ${maxPapers}]}. Only return JSON.\n\n${titles}`;
}
