/**
 * trackers.js — Tracker generation prompt (REST API).
 *
 * Used by: server/routes/trackers.js (POST /generate)
 *
 * Generates a research paper tracker from a topic string.
 * Returns JSON: {name, keywords, sources, signals}.
 *
 * IMPORTANT: This prompt must include source-language compatibility rules.
 * See SOURCE_LANGUAGE_GUIDE in capabilities.js.
 *
 * Related capability: See CAPABILITIES.md §2 "Tracker Configuration", §1 "Data Sources"
 */

import { SOURCE_LANGUAGE_GUIDE } from "./capabilities.js";

export function buildTrackerGenPrompt(topic) {
  return `Generate a research paper and code tracker for this topic: "${topic}". Return only JSON: {"name":"...","keywords":[...],"sources":["openalex","crossref","semantic_scholar"],"signals":["..."]}.

${SOURCE_LANGUAGE_GUIDE}

Include "semantic_scholar" for citation/abstract-rich academic tracking. Include "github" only when repository/code tracking is useful.`;
}
