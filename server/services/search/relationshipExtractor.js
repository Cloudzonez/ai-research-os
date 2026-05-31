import Paper from "../../models/Paper.js";
import PaperRelationship from "../../models/PaperRelationship.js";
import { chat } from "../deepseek.js";
import { getCache, setCache } from "../cache.js";

/**
 * Relationship types between papers
 */
export const RELATIONSHIP_TYPES = {
  CONTRADICTS: "contradicts",
  REPLICATES: "replicates",
  EXTENDS: "extends",
  SUPPORTS: "supports",
  REVIEWS: "reviews",
  APPLIES: "applies",
  CITES: "cites",
  UNKNOWN: "unknown",
};

/**
 * LLM prompt for relationship classification
 */
const RELATIONSHIP_PROMPT = `You are a research paper relationship classifier. Analyze the relationship between two papers and classify it.

Paper A (Target):
Title: {titleA}
Abstract: {abstractA}
Year: {yearA}

Paper B (Source):
Title: {titleB}
Abstract: {abstractB}
Year: {yearB}

Citation Context (if available): {citationContext}

Classify the relationship as ONE of:
- contradicts: Paper B contradicts findings/claims of Paper A
- replicates: Paper B replicates methodology/experiments of Paper A
- extends: Paper B extends/builds upon Paper A's work
- supports: Paper B provides supporting evidence for Paper A
- reviews: Paper B reviews/surveys Paper A
- applies: Paper B applies Paper A's methods to new domain
- cites: Paper B simply cites Paper A without special relationship
- unknown: Relationship cannot be determined

Return ONLY valid JSON:
{
  "relationship": "type",
  "confidence": 0.0-1.0,
  "evidence": "brief explanation (max 200 chars)"
}`;

/**
 * Extract relationship between two papers using LLM
 * @param {Object} paperA - Target paper
 * @param {Object} paperB - Source paper (cites paperA)
 * @param {Object} options - Options
 * @returns {Promise<Object>} Relationship data
 */
export async function extractRelationship(paperA, paperB, options = {}) {
  const { citationContext = "", skipCache = false } = options;

  // Check cache
  const cacheKey = `relationship:${paperB._id}:${paperA._id}`;
  if (!skipCache) {
    const cached = getCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    // Prepare prompt
    const prompt = RELATIONSHIP_PROMPT
      .replace("{titleA}", paperA.title || "")
      .replace("{abstractA}", (paperA.abstract || "").slice(0, 500))
      .replace("{yearA}", paperA.year || "")
      .replace("{titleB}", paperB.title || "")
      .replace("{abstractB}", (paperB.abstract || "").slice(0, 500))
      .replace("{yearB}", paperB.year || "")
      .replace("{citationContext}", citationContext || "Not available");

    // Call LLM
    const response = await chat(
      [{ role: "user", content: prompt }],
      "en",
      {
        model: "deepseek-chat",
        temperature: 0.1,
        maxTokens: 300,
        timeoutMs: 15000,
      }
    );

    // Parse JSON response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid LLM response format");
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validate result
    if (!result.relationship || !Object.values(RELATIONSHIP_TYPES).includes(result.relationship)) {
      result.relationship = RELATIONSHIP_TYPES.UNKNOWN;
    }

    if (typeof result.confidence !== "number" || result.confidence < 0 || result.confidence > 1) {
      result.confidence = 0.5;
    }

    if (!result.evidence) {
      result.evidence = "Relationship determined by LLM analysis";
    }

    // Cache result
    setCache(cacheKey, result, 86400000); // 24 hours

    return result;
  } catch (error) {
    console.error("Relationship extraction error:", error);
    
    // Fallback to simple heuristics
    return {
      relationship: RELATIONSHIP_TYPES.CITES,
      confidence: 0.3,
      evidence: "Fallback: Simple citation detected",
    };
  }
}

/**
 * Compare claims between two papers to detect contradictions
 * @param {Object} paperA - First paper
 * @param {Object} paperB - Second paper
 * @returns {Promise<Object>} Contradiction analysis
 */
export async function compareClaimsForContradiction(paperA, paperB) {
  const claimsA = paperA.evidenceCards?.map(c => c.claim) || [];
  const claimsB = paperB.evidenceCards?.map(c => c.claim) || [];

  if (claimsA.length === 0 || claimsB.length === 0) {
    return {
      hasContradiction: false,
      contradictions: [],
      confidence: 0,
    };
  }

  const contradictions = [];

  // Compare each claim pair
  for (const claimA of claimsA) {
    for (const claimB of claimsB) {
      const result = await detectContradiction(claimA, claimB);
      if (result.isContradiction) {
        contradictions.push({
          claimA,
          claimB,
          confidence: result.confidence,
          explanation: result.explanation,
        });
      }
    }
  }

  return {
    hasContradiction: contradictions.length > 0,
    contradictions,
    confidence: contradictions.length > 0 
      ? contradictions.reduce((sum, c) => sum + c.confidence, 0) / contradictions.length
      : 0,
  };
}

/**
 * Detect if two claims contradict each other
 * @param {string} claimA - First claim
 * @param {string} claimB - Second claim
 * @returns {Promise<Object>} Contradiction result
 */
async function detectContradiction(claimA, claimB) {
  const prompt = `Analyze if these two research claims contradict each other:

Claim 1: ${claimA}
Claim 2: ${claimB}

Return ONLY valid JSON:
{
  "isContradiction": true/false,
  "confidence": 0.0-1.0,
  "explanation": "brief explanation"
}`;

  try {
    const response = await chat(
      [{ role: "user", content: prompt }],
      "en",
      {
        model: "deepseek-chat",
        temperature: 0.1,
        maxTokens: 200,
        timeoutMs: 10000,
      }
    );

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { isContradiction: false, confidence: 0, explanation: "Parse error" };
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Contradiction detection error:", error);
    return { isContradiction: false, confidence: 0, explanation: "Error" };
  }
}

/**
 * Find papers with specific relationship to target paper
 * @param {string} paperId - Target paper ID
 * @param {string} relationshipType - Type of relationship
 * @param {Object} options - Options
 * @returns {Promise<Array>} Related papers
 */
export async function findRelatedPapers(paperId, relationshipType, options = {}) {
  const { minConfidence = 0.5, maxResults = 20 } = options;

  try {
    const relationships = await PaperRelationship.find({
      targetPaperId: paperId,
      relationshipType,
      confidence: { $gte: minConfidence },
    })
      .sort({ confidence: -1 })
      .limit(maxResults)
      .populate("sourcePaperId")
      .lean();

    return relationships.map(rel => ({
      paper: rel.sourcePaperId,
      relationship: rel.relationshipType,
      confidence: rel.confidence,
      evidence: rel.evidence,
      citationContext: rel.citationContext,
      extractedAt: rel.extractedAt,
    }));
  } catch (error) {
    console.error("Find related papers error:", error);
    throw error;
  }
}

/**
 * Extract relationships for a paper and its citations
 * @param {string} paperId - Paper ID
 * @param {Object} options - Options
 * @returns {Promise<Object>} Extraction results
 */
export async function extractRelationshipsForPaper(paperId, options = {}) {
  const { maxCitations = 50, skipExisting = true } = options;

  const paper = await Paper.findById(paperId).lean();
  if (!paper) {
    throw new Error("Paper not found");
  }

  console.log(`Extracting relationships for paper: ${paper.title}`);

  // Get papers that cite this paper
  const citingPapers = await Paper.find({
    references: paperId,
  })
    .limit(maxCitations)
    .lean();

  console.log(`Found ${citingPapers.length} citing papers`);

  const results = {
    processed: 0,
    created: 0,
    skipped: 0,
    errors: 0,
    relationships: [],
  };

  for (const citingPaper of citingPapers) {
    try {
      // Check if relationship already exists
      if (skipExisting) {
        const existing = await PaperRelationship.findOne({
          sourcePaperId: citingPaper._id,
          targetPaperId: paperId,
        });

        if (existing) {
          results.skipped++;
          results.processed++;
          continue;
        }
      }

      // Extract relationship
      const relationship = await extractRelationship(paper, citingPaper);

      // Save to database
      const saved = await PaperRelationship.create({
        sourcePaperId: citingPaper._id,
        targetPaperId: paperId,
        relationshipType: relationship.relationship,
        confidence: relationship.confidence,
        evidence: relationship.evidence,
        extractionMethod: "llm",
      });

      results.relationships.push(saved);
      results.created++;
    } catch (error) {
      console.error(`Error processing citation from ${citingPaper._id}:`, error);
      results.errors++;
    }

    results.processed++;
  }

  console.log("Relationship extraction complete:", results);
  return results;
}

/**
 * Batch extract relationships for multiple papers
 * @param {Array} paperIds - Array of paper IDs
 * @param {Object} options - Options
 * @returns {Promise<Object>} Batch results
 */
export async function batchExtractRelationships(paperIds, options = {}) {
  const { concurrency = 3 } = options;

  const results = {
    total: paperIds.length,
    completed: 0,
    failed: 0,
    relationships: 0,
  };

  // Process in batches
  for (let i = 0; i < paperIds.length; i += concurrency) {
    const batch = paperIds.slice(i, i + concurrency);
    
    const promises = batch.map(async (paperId) => {
      try {
        const result = await extractRelationshipsForPaper(paperId, options);
        results.completed++;
        results.relationships += result.created;
        return result;
      } catch (error) {
        console.error(`Failed to extract relationships for ${paperId}:`, error);
        results.failed++;
        return null;
      }
    });

    await Promise.all(promises);
    
    console.log(`Batch progress: ${results.completed + results.failed}/${results.total}`);
  }

  return results;
}

/**
 * Get relationship statistics for a paper
 * @param {string} paperId - Paper ID
 * @returns {Promise<Object>} Statistics
 */
export async function getRelationshipStats(paperId) {
  const stats = await PaperRelationship.aggregate([
    {
      $match: {
        $or: [
          { sourcePaperId: paperId },
          { targetPaperId: paperId },
        ],
      },
    },
    {
      $group: {
        _id: "$relationshipType",
        count: { $sum: 1 },
        avgConfidence: { $avg: "$confidence" },
      },
    },
  ]);

  const result = {
    total: 0,
    byType: {},
  };

  for (const stat of stats) {
    result.total += stat.count;
    result.byType[stat._id] = {
      count: stat.count,
      avgConfidence: stat.avgConfidence,
    };
  }

  return result;
}

export default {
  extractRelationship,
  compareClaimsForContradiction,
  findRelatedPapers,
  extractRelationshipsForPaper,
  batchExtractRelationships,
  getRelationshipStats,
  RELATIONSHIP_TYPES,
};

// Made with Bob
