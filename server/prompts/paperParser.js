/**
 * paperParser.js — Batch crawl result analysis prompt.
 *
 * Used by: server/services/aiPaperParser.js (analyzeBatch)
 *
 * Takes raw crawl items (papers/repositories) and asks the LLM to produce
 * structured analysis: abstract, summary, contributions, methods, limitations.
 * Sent in batches of 5 items.
 *
 * Related capability: See CAPABILITIES.md §3 "Paper Processing Pipeline"
 */

export function buildPaperParserPrompt(itemsDescription) {
  return `You are a research paper analyzer. Analyze each item below thoroughly. ALL fields are required — never leave any field empty.

${itemsDescription}

Return ONLY a JSON array (no markdown, no extra text). One object per item:

{
  "idx": <number>,
  "abstract": "<REQUIRED. For papers: a proper academic abstract of 3-6 sentences. If the existing abstract is substantial, polish it. If missing/short, generate one from the title and context. For repositories: a technical description (3-6 sentences) covering what the repo does, its architecture, and key features.>",
  "summary": "<REQUIRED. 2-3 sentence plain-language summary of what this work/repo accomplishes. Must be non-empty.>",
  "contributions": "<REQUIRED. Key contributions or features as a concise paragraph.>",
  "methods": "<REQUIRED. Methods, technologies, or approaches used. If unclear from available info, make a reasonable inference based on the title and field.>",
  "limitations": "<REQUIRED. Limitations, caveats, or areas for future work. If unclear, note typical limitations for this type of work.>"
}

CRITICAL: Every string field must contain meaningful content — never leave any field as "". Respond with ONLY the JSON array.`;
}
