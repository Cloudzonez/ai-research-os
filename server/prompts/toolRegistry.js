/**
 * toolRegistry.js — Draft section tool prompt.
 *
 * Used by: server/services/toolRegistry.js (draft_paper_section tool handler)
 *
 * Generates a draft section (e.g., related work) for a research topic.
 * Called when an agent or chat invokes the draft_paper_section tool.
 *
 * Related capability: See CAPABILITIES.md §4 "AI Actions"
 */

export function buildDraftSectionPrompt(section, topic) {
  return `Write a draft ${section || "related work"} section for: "${topic}". Academic style.`;
}
