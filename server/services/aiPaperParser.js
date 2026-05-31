import { chat } from "./deepseek.js";
import { buildPaperParserPrompt } from "../prompts/paperParser.js";

const MIN_ABSTRACT_LENGTH = 30;

/**
 * Parse raw crawl results through AI to generate proper abstracts, summaries,
 * contributions, methods, and limitations. Produces output conforming to the
 * standard Paper model format.
 */
export async function parseCrawlResultsWithAI(rawItems, options = {}) {
  const { locale = "en", source, batchSize = 5 } = options;

  if (!rawItems || rawItems.length === 0) return [];

  const results = [];

  // Process in batches to keep individual AI calls reasonably sized
  for (let i = 0; i < rawItems.length; i += batchSize) {
    const batch = rawItems.slice(i, i + batchSize);
    const aiResults = await analyzeBatch(batch, { locale, source });
    results.push(...aiResults);
  }

  // Normalize each item to standard format
  const normalized = results.map(({ raw, analysis }, idx) => {
    const itemSource = raw.source || source || "unknown";
    const itemType = raw.itemType || (itemSource === "github" ? "repository" : "paper");
    return normalizeToStandardFormat(
      { ...raw, source: itemSource, itemType },
      analysis,
      { source: itemSource, spec: options.spec || {} }
    );
  });

  return normalized;
}

/**
 * Normalize a single raw crawl item + AI analysis into the standard Paper format.
 */
export function normalizeToStandardFormat(rawItem, aiAnalysis, context = {}) {
  const { source = "unknown", spec = {} } = context;
  const itemType = rawItem.itemType || (source === "github" ? "repository" : "paper");

  const title = cleanText(rawItem.title);
  const authors = Array.isArray(rawItem.authors)
    ? rawItem.authors.filter(Boolean)
    : [];

  const abstract = cleanText(
    aiAnalysis.abstract || rawItem.abstract || rawItem.summary || ""
  );

  const url = cleanText(rawItem.url);
  const doi = cleanDoi(rawItem.doi);
  const year = Number(rawItem.year) || new Date().getFullYear();

  const tags = [
    sourceLabel(source),
    itemType === "repository" ? "repository" : "paper",
    "ai-parsed",
  ];

  if (Array.isArray(spec.keywords)) {
    for (const kw of spec.keywords.slice(0, 3)) {
      tags.push(String(kw).toLowerCase());
    }
  }

  const score = computeScore(rawItem, source);

  return {
    title,
    authors,
    abstract,
    doi,
    year,
    source,
    url,
    pdfUrl: cleanText(rawItem.pdfUrl),
    score,
    sharing: rawItem.sharing || "school",
    tags,
    summary: cleanText(aiAnalysis.summary || ""),
    contributions: cleanText(aiAnalysis.contributions || ""),
    methods: cleanText(aiAnalysis.methods || ""),
    limitations: cleanText(aiAnalysis.limitations || ""),
    status: "summarized",
  };
}

// ---------------------------------------------------------------------------
// Internal: AI batch analysis
// ---------------------------------------------------------------------------

async function analyzeBatch(batch, options) {
  const { locale = "en" } = options;

  const itemsDescription = batch
    .map((item, idx) => {
      const itemType = item.itemType || (item.source === "github" ? "repository" : "paper");
      const title = cleanText(item.title);
      const existingAbstract = cleanText(item.abstract || item.summary || "");
      const url = cleanText(item.url || "");
      const doi = cleanText(item.doi || "");
      const year = item.year || "";
      const stars = item.stars !== undefined ? `Stars: ${item.stars}` : "";
      const language = item.language ? `Language: ${item.language}` : "";
      const authors = Array.isArray(item.authors)
        ? item.authors.filter(Boolean).slice(0, 5).join(", ")
        : "";

      if (itemType === "repository") {
        return `[${idx}] REPOSITORY: ${title}
  Description: ${existingAbstract}
  URL: ${url}
  ${stars} ${language}`;
      }

      return `[${idx}] PAPER: ${title}
  Authors: ${authors}
  Existing abstract: ${existingAbstract || "(missing)"}
  URL: ${url}
  DOI: ${doi}
  Year: ${year}`;
    })
    .join("\n\n");

  const prompt = buildPaperParserPrompt(itemsDescription);

  try {
    const result = await chat(
      [{ role: "user", content: prompt }],
      locale,
      { temperature: 0.3, maxTokens: Math.max(4096, batch.length * 1200) }
    );

    const parsed = parseAIResponse(result.content, batch);
    return parsed;
  } catch (err) {
    // If AI fails, return items with whatever abstracts they already have
    console.error("AI paper parser batch failed:", err.message);
    return batch.map((raw) => ({
      raw,
      analysis: {
        abstract: cleanText(raw.abstract || raw.summary || raw.title || ""),
        summary: "",
        contributions: "",
        methods: "",
        limitations: "",
      },
    }));
  }
}

function parseAIResponse(content, batch) {
  const text = String(content);

  // Handle markdown code blocks: ```json ... ``` or ``` ... ```
  let jsonText = text;
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    jsonText = codeBlock[1];
  }

  // Try to find JSON object or array in the response
  const jsonMatch = jsonText.match(/\[[\s\S]*\]/) || jsonText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("AI parser: no JSON array/object found in response, using fallback");
    console.error("Response preview:", text.slice(0, 300));
    return fallbackBatch(batch);
  }

  try {
    let parsed = JSON.parse(jsonMatch[0]);
    // Normalize: if a single object was returned, wrap it in an array
    if (!Array.isArray(parsed)) {
      parsed = [parsed];
    }

    const analysisMap = new Map();
    for (const entry of parsed) {
      if (entry && typeof entry.idx === "number") {
        analysisMap.set(entry.idx, {
          abstract: entry.abstract || "",
          summary: entry.summary || "",
          contributions: entry.contributions || "",
          methods: entry.methods || "",
          limitations: entry.limitations || "",
        });
      }
    }

    return batch.map((raw, idx) => {
      let analysis = analysisMap.get(idx);
      if (!analysis || !analysis.abstract) {
        analysis = emptyAnalysis(raw);
      }
      analysis = fillEmptyFields(analysis, raw);
      return { raw, analysis };
    });
  } catch (err) {
    console.error("AI parser: JSON parse error:", err.message);
    return fallbackBatch(batch);
  }
}

function fallbackBatch(batch) {
  return batch.map((raw) => ({
    raw,
    analysis: fillEmptyFields(emptyAnalysis(raw), raw),
  }));
}

function emptyAnalysis(raw) {
  const existingAbstract = cleanText(raw.abstract || raw.summary || raw.description || "");
  const title = cleanText(raw.title || "Unknown item");
  const fallback = existingAbstract || `Research related to: ${title}`;
  return {
    abstract: fallback,
    summary: fallback.length > 200 ? fallback.slice(0, 200) : fallback,
    contributions: "",
    methods: "",
    limitations: "",
  };
}

function fillEmptyFields(analysis, raw) {
  const abstract = analysis.abstract || "";
  const title = cleanText(raw.title || "Unknown item");
  const itemType = raw.itemType || (raw.source === "github" ? "repository" : "paper");
  const isRepo = itemType === "repository";

  const defaultSummary = isRepo
    ? `Repository: ${title}. ${abstract.slice(0, 180)}`.trim()
    : abstract.length > 200 ? abstract.slice(0, 200) : abstract;

  const defaultContributions = isRepo
    ? `Provides tools and code for ${title}.`
    : `Presents research contributions in the field related to ${title}.`;

  const defaultMethods = isRepo
    ? `Software implementation, available as a Git repository.`
    : `Academic research methods as described in the paper.`;

  const defaultLimitations = isRepo
    ? `May require specific dependencies or environment setup. Limited to the scope defined by the maintainers.`
    : `As with all research, findings may be limited by the scope and methodology of the study.`;

  return {
    abstract: abstract || `Research related to: ${title}`,
    summary: analysis.summary || defaultSummary,
    contributions: analysis.contributions || defaultContributions,
    methods: analysis.methods || defaultMethods,
    limitations: analysis.limitations || defaultLimitations,
  };
}

// ---------------------------------------------------------------------------
// Internal: scoring
// ---------------------------------------------------------------------------

function computeScore(raw, source) {
  if (source === "github") {
    const stars = Number(raw.stars) || 0;
    if (stars > 5000) return 95;
    if (stars > 1000) return 90;
    if (stars > 100) return 82;
    if (stars > 10) return 75;
    return 70;
  }

  const citations = Number(raw.citedByCount) || 0;
  if (citations > 500) return 95;
  if (citations > 100) return 90;
  if (citations > 10) return 82;
  return 75;
}

// ---------------------------------------------------------------------------
// Internal: text utilities
// ---------------------------------------------------------------------------

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanDoi(value) {
  return String(value || "")
    .replace(/^https?:\/\/doi\.org\//i, "")
    .trim();
}

function sourceLabel(source) {
  return {
    arxiv: "arXiv",
    openalex: "OpenAlex",
    semantic_scholar: "Semantic Scholar",
    github: "GitHub",
  }[source] || source;
}

export default { parseCrawlResultsWithAI, normalizeToStandardFormat };
