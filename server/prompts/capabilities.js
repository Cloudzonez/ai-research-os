/**
 * System capabilities - extracted from CAPABILITIES.md.
 *
 * Import this module into prompt files that need to generate system-compatible
 * configurations (tracker sources, search params, etc.).
 *
 * The SOURCE_CAPABILITIES object tells the LLM exactly which sources to use
 * based on the query language and content domain.
 */

/**
 * Source-language compatibility rules for prompt injection.
 * Injects into tracker generation prompts so the AI picks compatible sources.
 */
export const SOURCE_LANGUAGE_GUIDE = `
Source selection rules:
- Chinese (中文) query → use openalex and crossref (they support Chinese). DO NOT use arxiv or semantic_scholar alone.
- English CS/AI/ML query → arxiv is best, pair with openalex + semantic_scholar.
- Biomedical query → add pubmed.
- Repository/code → add github.
- Always include openalex as a fallback source (broadest coverage, citations, OA PDFs).
- Default safe set: ["openalex", "crossref", "semantic_scholar"]
- For English CS topics: ["arxiv", "openalex", "semantic_scholar"]
`;

/**
 * Compact source list for injecting into prompts that ask to pick sources.
 */
export const SOURCE_LIST = [
  { name: "arxiv", supports: "English only", goodFor: "CS/AI/math/physics", hasCitations: false },
  { name: "openalex", supports: "All languages including Chinese", goodFor: "All fields, fallback", hasCitations: true },
  { name: "semantic_scholar", supports: "English only", goodFor: "All fields, citation graph", hasCitations: true },
  { name: "crossref", supports: "All languages including Chinese", goodFor: "All fields, publisher metadata", hasCitations: true },
  { name: "pubmed", supports: "Biomedical, some Chinese", goodFor: "Biomedical/life sciences", hasCitations: false },
  { name: "github", supports: "All languages (keyword match)", goodFor: "Code repositories (NOT papers)", hasCitations: false },
];

/**
 * Returns a compact source capability summary string for LLM prompt injection.
 */
export function getSourceCapabilitySummary() {
  return SOURCE_LIST.map(s =>
    `- ${s.name}: ${s.supports}, best for ${s.goodFor}, citations: ${s.hasCitations}`
  ).join("\n");
}
