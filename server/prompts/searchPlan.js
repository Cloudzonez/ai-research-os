/**
 * searchPlan.js — Natural language → structured search parameters prompt.
 *
 * Used by: server/services/paperSearch/searchPlanToParams.js (searchPlanToParams)
 *
 * Converts free-form research queries into structured JSON with:
 * query keywords, providers, year/type filters, maxResults.
 * Uses temperature 0.1 for determinism.
 *
 * Related capability: See CAPABILITIES.md §1 "Data Sources", SOURCE_LANGUAGE_GUIDE
 */

import { SOURCE_LANGUAGE_GUIDE } from "./capabilities.js";

export function buildSearchPlanPrompt(naturalLanguageQuery, providerList) {
  return `Convert this research query into structured search parameters: "${naturalLanguageQuery}"

Available providers: ${providerList}

Return ONLY valid JSON (no markdown, no explanation):
{
  "query": "optimized search keywords",
  "providers": ["best matching provider names from the available list"],
  "filters": { "yearMin": 2020, "yearMax": 2026, "type": "journal-article or null", "oaOnly": false },
  "maxResults": 25
}

${SOURCE_LANGUAGE_GUIDE}

Additional rules:
- Extract the core research topic as query keywords. Remove filler words like "find", "search for", "I want", "give me".
- Detect year ranges from phrases like "recent" (last 2 years), "last 3 years", "2023-2025", "since 2020", "after 2019".
- Detect article type: "preprints", "journal articles", "conference papers", "reviews", "survey".
- Default to 25 results. Only change if a specific number is mentioned.
- Detect if user wants open access only ("free", "open access", "OA").`;
}
