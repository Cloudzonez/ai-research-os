import { chat } from "../deepseek.js";

const METADATA_EXTRACTION_PROMPT = `Extract research metadata from this paper abstract. Return ONLY valid JSON:

{
  "studyType": "rct|cohort|case_study|meta_analysis|review|survey|experimental|theoretical|unknown",
  "sampleSize": number or null,
  "population": "mice|humans|in-silico|cell-culture|other",
  "datasets": [{"name": "dataset name", "description": "brief desc"}],
  "methodology": "brief description of methods",
  "hasCode": boolean,
  "hasData": boolean
}

Rules:
- studyType: identify the research design
- sampleSize: extract if mentioned (e.g., "n=100")
- population: identify study subjects
- datasets: list any mentioned datasets
- hasCode: true if code/implementation mentioned
- hasData: true if data availability mentioned`;

/**
 * Extract metadata from paper abstract using LLM
 * @param {Object} paper - Paper object with title and abstract
 * @returns {Promise<Object>} Extracted metadata
 */
export async function extractMetadata(paper) {
  if (!paper.abstract || paper.abstract.length < 50) {
    return null;
  }

  try {
    const response = await chat(
      [
        { role: "system", content: METADATA_EXTRACTION_PROMPT },
        { role: "user", content: `Title: ${paper.title}\n\nAbstract: ${paper.abstract}` }
      ],
      "en",
      {
        model: "deepseek-v4-pro",
        temperature: 0.1,
        maxTokens: 500,
        timeoutMs: 10000,
      }
    );

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const metadata = JSON.parse(jsonMatch[0]);
    return metadata;
  } catch (error) {
    console.error("Metadata extraction error:", error);
    return null;
  }
}

/**
 * Enrich paper with extracted metadata
 * @param {string} paperId - Paper ID
 * @returns {Promise<Object>} Updated paper
 */
export async function enrichPaperMetadata(paperId) {
  const Paper = (await import("../../models/Paper.js")).default;
  const paper = await Paper.findById(paperId);
  
  if (!paper) throw new Error("Paper not found");

  const metadata = await extractMetadata(paper);
  if (!metadata) return paper;

  // Update paper with extracted metadata
  paper.studyType = metadata.studyType;
  paper.sampleSize = metadata.sampleSize;
  paper.population = metadata.population;
  paper.datasets = metadata.datasets || [];
  paper.codeAvailable = metadata.hasCode || false;
  paper.dataAvailable = metadata.hasData || false;

  await paper.save();
  return paper;
}

export default {
  extractMetadata,
  enrichPaperMetadata,
};

// Made with Bob
