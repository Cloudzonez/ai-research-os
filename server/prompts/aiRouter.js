/**
 * aiRouter.js — Context injection and tracker generation prompts.
 *
 * Used by: server/services/aiRouter.js (routeChat, routeChatStream)
 *
 * buildSystemPrompt: Injects paper context at tier levels 0-4 into the system prompt.
 * buildContextSummary: Compact version for streaming chat system prompt.
 * buildTrackerGenPrompt: Generates tracker config JSON from user message.
 *
 * IMPORTANT: Tracker generation prompts should reference SOURCE_LANGUAGE_GUIDE
 * from capabilities.js to avoid picking incompatible sources (e.g., arxiv for Chinese).
 *
 * Related capability: See CAPABILITIES.md §2 "Tracker Configuration", §1 "Data Sources"
 */

import { SOURCE_LANGUAGE_GUIDE } from "./capabilities.js";

export function buildSystemPrompt(contextBundle) {
  const { papers, tier } = contextBundle;
  const header = `Available context papers (${papers.length} papers, tier ${tier}, ~${contextBundle.tokens} tokens):`;

  const entries = papers.map((p) => {
    let entry = `${p.title} (${p.source}, score: ${p.score})`;

    if (tier >= 1 && p.abstract) {
      entry += `\n--- Abstract ---\n${p.abstract}`;
    }
    if (tier >= 2) {
      if (p.summary) entry += `\n--- Summary ---\n${p.summary}`;
      if (p.contributions) entry += `\n--- Contributions ---\n${p.contributions}`;
      if (p.methods) entry += `\n--- Methods ---\n${p.methods}`;
      if (p.limitations) entry += `\n--- Limitations ---\n${p.limitations}`;
    }
    if (tier >= 3 && p.evidenceCards && p.evidenceCards.length > 0) {
      entry += `\n--- Evidence Cards ---\n${p.evidenceCards
        .map((ec) => `- Claim: ${ec.claim}\n  Evidence: ${ec.evidence}`)
        .join("\n")}`;
    }
    if (tier >= 4 && p.textChunks && p.textChunks.length > 0) {
      entry += `\n--- Relevant Full Text Excerpts ---\n${p.textChunks
        .map((tc) => `[Chunk ${tc.index}] ${tc.text}`)
        .join("\n\n")}`;
    }

    return entry;
  });

  return `${header}\n\n${entries.join("\n\n")}`;
}

export function buildContextSummary(contextBundle) {
  return contextBundle.papers
    .map((p) => {
      let entry = `${p.title} (${p.source}, score: ${p.score})`;
      if (p.abstract) entry += `\n--- Abstract ---\n${p.abstract}`;
      if (p.summary && contextBundle.tier >= 2) entry += `\n--- Summary ---\n${p.summary}`;
      if (p.contributions && contextBundle.tier >= 2) entry += `\n--- Contributions ---\n${p.contributions}`;
      if (p.methods && contextBundle.tier >= 2) entry += `\n--- Methods ---\n${p.methods}`;
      if (p.limitations && contextBundle.tier >= 2) entry += `\n--- Limitations ---\n${p.limitations}`;
      return entry;
    })
    .join("\n\n");
}

export function buildStreamSystemPrompt(contextBundle, contextSummary) {
  return `Available context papers (${contextBundle.papers.length} papers): ${contextSummary}`;
}

export const TRACKER_GEN_PROMPT = `Generate a research paper tracker for this topic: "{topic}". Return ONLY JSON: {"name":"Tracker name (max 60 chars)","keywords":["keyword1","keyword2",...],"sources":["openalex","crossref","semantic_scholar"],"signals":["signal1","signal2",...]}

${SOURCE_LANGUAGE_GUIDE}`;

export const TRACKER_GEN_PROMPT_STREAM = `Generate a research paper tracker for: "{topic}". Return ONLY JSON: {"name":"Tracker name","keywords":["kw1"],"sources":["openalex"],"signals":["s1"]}

${SOURCE_LANGUAGE_GUIDE}`;

export function buildTrackerGenPrompt(topic) {
  return TRACKER_GEN_PROMPT.replace("{topic}", topic);
}

export function buildTrackerGenStreamPrompt(topic) {
  return TRACKER_GEN_PROMPT_STREAM.replace("{topic}", topic);
}
