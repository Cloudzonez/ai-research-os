import Paper from "../../models/Paper.js";
import { semanticScholarProvider } from "../ingestion/semanticScholar.js";
import { cosineSimilarity } from "./embeddingService.js";

/**
 * Build citation relationships for a paper
 * @param {string} paperId - Paper ID
 * @param {Object} options - Options
 * @returns {Promise<Object>} Citation data
 */
export async function buildCitationGraph(paperId, options = {}) {
  const paper = await Paper.findById(paperId);
  if (!paper) throw new Error("Paper not found");

  const { maxDepth = 2, maxPerLevel = 50 } = options;

  // Get citations from Semantic Scholar if available
  if (paper.externalIds?.semanticScholar) {
    try {
      const forward = await semanticScholarProvider.getCitations(
        paper.externalIds.semanticScholar,
        { direction: "forward", limit: maxPerLevel }
      );
      
      const backward = await semanticScholarProvider.getCitations(
        paper.externalIds.semanticScholar,
        { direction: "backward", limit: maxPerLevel }
      );

      return {
        paperId: paper._id,
        citedBy: forward.citations,
        references: backward.citations,
        citedByCount: forward.totalCount,
        referencesCount: backward.totalCount,
      };
    } catch (error) {
      console.error("Citation graph error:", error);
    }
  }

  // Fallback: use stored citation data
  return {
    paperId: paper._id,
    citedBy: paper.citedBy || [],
    references: paper.references || [],
    citedByCount: paper.citedByCount || 0,
    referencesCount: paper.referencesCount || 0,
  };
}

/**
 * Find papers "more like this" using multiple signals
 * @param {string} paperId - Paper ID
 * @param {Object} options - Options
 * @returns {Promise<Array>} Similar papers
 */
export async function findMoreLikeThis(paperId, options = {}) {
  const paper = await Paper.findById(paperId);
  if (!paper) throw new Error("Paper not found");

  const { maxResults = 10 } = options;
  const candidates = new Map();

  // Signal 1: Embedding similarity (60% weight)
  if (paper.embedding) {
    const embeddingSimilar = await Paper.find({
      _id: { $ne: paper._id },
      embedding: { $exists: true }
    }).limit(100).lean();

    for (const candidate of embeddingSimilar) {
      const similarity = cosineSimilarity(paper.embedding, candidate.embedding);
      candidates.set(candidate._id.toString(), {
        paper: candidate,
        score: similarity * 0.6,
        signals: { embedding: similarity }
      });
    }
  }

  // Signal 2: Co-citation analysis (20% weight)
  // Papers that cite the same references
  if (paper.references && paper.references.length > 0) {
    const coCited = await Paper.find({
      _id: { $ne: paper._id },
      references: { $in: paper.references }
    }).limit(50).lean();

    for (const candidate of coCited) {
      const commonRefs = candidate.references?.filter(r => 
        paper.references.includes(r)
      ).length || 0;
      
      const coCitationScore = commonRefs / Math.max(paper.references.length, 1);
      
      const existing = candidates.get(candidate._id.toString());
      if (existing) {
        existing.score += coCitationScore * 0.2;
        existing.signals.coCitation = coCitationScore;
      } else {
        candidates.set(candidate._id.toString(), {
          paper: candidate,
          score: coCitationScore * 0.2,
          signals: { coCitation: coCitationScore }
        });
      }
    }
  }

  // Signal 3: Bibliographic coupling (20% weight)
  // Papers cited by the same papers
  if (paper.citedBy && paper.citedBy.length > 0) {
    const coupled = await Paper.find({
      _id: { $ne: paper._id },
      citedBy: { $in: paper.citedBy }
    }).limit(50).lean();

    for (const candidate of coupled) {
      const commonCiters = candidate.citedBy?.filter(c => 
        paper.citedBy.includes(c)
      ).length || 0;
      
      const couplingScore = commonCiters / Math.max(paper.citedBy.length, 1);
      
      const existing = candidates.get(candidate._id.toString());
      if (existing) {
        existing.score += couplingScore * 0.2;
        existing.signals.coupling = couplingScore;
      } else {
        candidates.set(candidate._id.toString(), {
          paper: candidate,
          score: couplingScore * 0.2,
          signals: { coupling: couplingScore }
        });
      }
    }
  }

  // Sort by combined score and return top results
  const results = Array.from(candidates.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(({ paper, score, signals }) => ({
      ...paper,
      similarityScore: score,
      signals,
    }));

  return results;
}

/**
 * Calculate PageRank-style influence score
 * @param {string} paperId - Paper ID
 * @returns {Promise<number>} Influence score
 */
export async function calculateInfluenceScore(paperId) {
  const paper = await Paper.findById(paperId);
  if (!paper) throw new Error("Paper not found");

  // Simple influence score based on:
  // - Citation count
  // - Citation velocity (citations per year)
  // - Influential citation count (if available)
  
  const age = new Date().getFullYear() - (paper.year || new Date().getFullYear());
  const citationVelocity = age > 0 ? (paper.citedByCount || 0) / age : 0;
  
  const influenceScore = 
    (paper.citedByCount || 0) * 0.5 +
    citationVelocity * 10 * 0.3 +
    (paper.influentialCitationCount || 0) * 0.2;

  return influenceScore;
}

export default {
  buildCitationGraph,
  findMoreLikeThis,
  calculateInfluenceScore,
};

// Made with Bob
