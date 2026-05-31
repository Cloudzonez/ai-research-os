/**
 * worker.js — Full-text paper analysis prompt (queue worker).
 *
 * Used by: server/workers/runner.js (processAnalyzePaperJob)
 *
 * Analyzes paper full text (up to 8000 chars) → structured JSON:
 * summary (2-3 sentences), contributions (string array), methods, limitations.
 *
 * Related capability: See CAPABILITIES.md §4 "Via Queue Worker"
 */

export function buildPaperAnalysisPrompt(paperText) {
  return `Analyze this research paper text and return a JSON object with: summary (2-3 sentence academic summary), contributions (key contributions as array of strings), methods (research methods used), limitations (stated or apparent limitations).

Paper text: ${paperText.slice(0, 8000)}

Return ONLY valid JSON: {"summary":"...","contributions":["..."],"methods":"...","limitations":"..."}`;
}
