/**
 * aiTriage.js — Tracker paper triage prompts.
 *
 * Used by: server/services/aiTriage.js (runAITriage)
 *
 * Evaluates crawled papers against a tracker's topic. Returns relevance (0-10),
 * category (method/application/theory/survey/dataset/tool/unrelated),
 * novelty (breakthrough/interesting/incremental/unknown), and reasoning.
 * Sent in batches of 25 papers.
 *
 * Related capability: See CAPABILITIES.md §2 "Tracker Configuration"
 */

export function buildTriagePrompt(spec, papers) {
  const topic = spec.name || spec.keywords?.join(", ") || "research";
  const keywords = (spec.keywords || []).join(", ");

  const paperEntries = papers
    .map((p, i) => {
      const title = p.title || "Untitled";
      const abs = (p.abstract || p.summary || "").slice(0, 500);
      return `[${i + 1}] Title: ${title}\n    Abstract: ${abs}`;
    })
    .join("\n\n");

  return `You are triaging research papers for a tracker on: "${topic}".
Keywords: ${keywords || "none"}

For each paper below, assess its relevance to the topic. Return a JSON object:

{
  "assessments": [
    {
      "index": 1,
      "relevance": 8,
      "category": "method",
      "novelty": "interesting",
      "reasoning": "Directly applies multi-agent RL to classroom settings with empirical results."
    }
  ]
}

Scoring guide:
- relevance: 0-10 (0=completely unrelated, 5=somewhat relevant, 8=directly relevant, 10=exact match to research question)
- category: "method" (new technique/algorithm), "application" (applied to a domain), "theory" (theoretical analysis), "survey" (literature review), "dataset" (new dataset/benchmark), "tool" (software/library), "unrelated"
- novelty: "breakthrough" (potentially field-changing), "interesting" (notable contribution), "incremental" (small improvement), "unknown" (cannot determine)
- reasoning: 1 sentence explaining the assessment

Papers:
${paperEntries}

Return ONLY the JSON object. No other text.`;
}
