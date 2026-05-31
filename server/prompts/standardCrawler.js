/**
 * standardCrawler.js — Crawler configuration suggestion prompt.
 *
 * Used by: server/services/standardCrawler.js (suggestStandardCrawlerSpec)
 *
 * Auto-generates a crawler spec (name, query, sources, keywords, maxResults)
 * from a natural language description.
 *
 * Related capability: See CAPABILITIES.md §1 "Data Sources", SOURCE_LANGUAGE_GUIDE
 */

import { SOURCE_LANGUAGE_GUIDE } from "./capabilities.js";

export function buildCrawlerSuggestionPrompt(description) {
  return `Suggest a crawler configuration for this request: "${description}".

${SOURCE_LANGUAGE_GUIDE}

Return ONLY JSON: {"name":"short name","query":"search query","sources":["openalex","crossref","semantic_scholar"],"keywords":["..."],"maxResults":10}. Use only supported sources that match the request.`;
}
