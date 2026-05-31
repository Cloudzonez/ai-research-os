import Paper from "../../models/Paper.js";
import { semanticScholarProvider } from "../ingestion/semanticScholar.js";
import { getCache, setCache } from "../cache.js";

/**
 * Detect seminal/foundational papers using multiple signals:
 * 1. Citation velocity (citations per year since publication)
 * 2. Citation age distribution (cited by recent papers)
 * 3. Citation network centrality (PageRank)
 * 4. Cross-field citations (cited across multiple domains)
 */

/**
 * Calculate citation velocity score
 * Papers with high citations relative to age are more influential
 * @param {Object} paper - Paper object
 * @returns {number} Citation velocity score (0-1)
 */
export function calculateCitationVelocity(paper) {
  const currentYear = new Date().getFullYear();
  const age = Math.max(currentYear - paper.year, 1);
  const citationsPerYear = paper.citedByCount / age;
  
  // Normalize to 0-1 scale (100+ citations/year = 1.0)
  const normalizedScore = Math.min(citationsPerYear / 100, 1.0);
  
  return normalizedScore;
}

/**
 * Calculate citation age score
 * Papers cited by recent work are more relevant/foundational
 * @param {Object} paper - Paper object
 * @param {Array} citingPapers - Papers that cite this paper
 * @returns {number} Citation age score (0-1)
 */
export function calculateCitationAgeScore(paper, citingPapers) {
  if (!citingPapers || citingPapers.length === 0) {
    return 0;
  }

  const currentYear = new Date().getFullYear();
  const recentThreshold = 3; // Papers from last 3 years
  
  // Count citations from recent papers
  const recentCitations = citingPapers.filter(
    p => currentYear - p.year <= recentThreshold
  ).length;
  
  // Score based on percentage of recent citations
  const recentRatio = recentCitations / citingPapers.length;
  
  // Boost score if paper is old but still cited recently (foundational)
  const paperAge = currentYear - paper.year;
  const ageBoost = paperAge > 10 ? 1.2 : 1.0;
  
  return Math.min(recentRatio * ageBoost, 1.0);
}

/**
 * Calculate PageRank score for citation network
 * Higher PageRank = more central/influential in citation graph
 * @param {Array} papers - Array of papers with citation relationships
 * @param {Object} options - PageRank options
 * @returns {Map} Map of paperId -> PageRank score
 */
export function calculatePageRank(papers, options = {}) {
  const {
    dampingFactor = 0.85,
    maxIterations = 100,
    convergenceThreshold = 0.0001,
  } = options;

  // Build adjacency list (citation graph)
  const graph = new Map();
  const paperIds = new Set();
  
  for (const paper of papers) {
    paperIds.add(paper._id.toString());
    graph.set(paper._id.toString(), {
      outLinks: [],
      inLinks: [],
    });
  }

  // Build citation links
  for (const paper of papers) {
    const paperId = paper._id.toString();
    
    // Add references (outgoing links)
    if (paper.references) {
      for (const refId of paper.references) {
        const refIdStr = refId.toString();
        if (paperIds.has(refIdStr)) {
          graph.get(paperId).outLinks.push(refIdStr);
          graph.get(refIdStr).inLinks.push(paperId);
        }
      }
    }
  }

  // Initialize PageRank scores
  const scores = new Map();
  const initialScore = 1.0 / paperIds.size;
  
  for (const paperId of paperIds) {
    scores.set(paperId, initialScore);
  }

  // Iterative PageRank calculation
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const newScores = new Map();
    let maxDiff = 0;

    for (const paperId of paperIds) {
      const node = graph.get(paperId);
      
      // Calculate PageRank contribution from incoming links
      let sum = 0;
      for (const inLinkId of node.inLinks) {
        const inLinkNode = graph.get(inLinkId);
        const outDegree = inLinkNode.outLinks.length;
        if (outDegree > 0) {
          sum += scores.get(inLinkId) / outDegree;
        }
      }

      // PageRank formula: (1-d)/N + d * sum
      const newScore = (1 - dampingFactor) / paperIds.size + dampingFactor * sum;
      newScores.set(paperId, newScore);

      // Track convergence
      const diff = Math.abs(newScore - scores.get(paperId));
      maxDiff = Math.max(maxDiff, diff);
    }

    // Update scores
    for (const [paperId, score] of newScores) {
      scores.set(paperId, score);
    }

    // Check convergence
    if (maxDiff < convergenceThreshold) {
      console.log(`PageRank converged after ${iteration + 1} iterations`);
      break;
    }
  }

  // Normalize scores to 0-1 range
  const maxScore = Math.max(...scores.values());
  const normalizedScores = new Map();
  
  for (const [paperId, score] of scores) {
    normalizedScores.set(paperId, score / maxScore);
  }

  return normalizedScores;
}

/**
 * Calculate cross-field citation score
 * Papers cited across multiple fields are more foundational
 * @param {Object} paper - Paper object
 * @param {Array} citingPapers - Papers that cite this paper
 * @returns {number} Cross-field score (0-1)
 */
export function calculateCrossFieldScore(paper, citingPapers) {
  if (!citingPapers || citingPapers.length === 0) {
    return 0;
  }

  // Extract unique fields/categories from citing papers
  const fields = new Set();
  
  for (const citingPaper of citingPapers) {
    // Use venue, tags, or categories to determine field
    if (citingPaper.venue) {
      fields.add(citingPaper.venue);
    }
    if (citingPaper.tags) {
      for (const tag of citingPaper.tags) {
        fields.add(tag);
      }
    }
    if (citingPaper.categories) {
      for (const category of citingPaper.categories) {
        fields.add(category);
      }
    }
  }

  // Normalize: 5+ fields = 1.0
  const normalizedScore = Math.min(fields.size / 5, 1.0);
  
  return normalizedScore;
}

/**
 * Calculate combined seminal score
 * @param {Object} paper - Paper object
 * @param {Object} scores - Individual score components
 * @returns {number} Combined seminal score (0-1)
 */
export function calculateSeminalScore(paper, scores) {
  const {
    citationVelocity = 0,
    citationAge = 0,
    pageRank = 0,
    crossField = 0,
  } = scores;

  // Weighted combination
  const weights = {
    citationVelocity: 0.30,
    citationAge: 0.25,
    pageRank: 0.25,
    crossField: 0.20,
  };

  const seminalScore = 
    weights.citationVelocity * citationVelocity +
    weights.citationAge * citationAge +
    weights.pageRank * pageRank +
    weights.crossField * crossField;

  return seminalScore;
}

/**
 * Detect seminal papers in a topic area
 * @param {string} topic - Research topic
 * @param {Object} options - Detection options
 * @returns {Promise<Array>} Array of seminal papers with scores
 */
export async function detectSeminalPapers(topic, options = {}) {
  const {
    minScore = 0.7,
    maxResults = 20,
    minCitations = 50,
    skipCache = false,
  } = options;

  // Check cache
  const cacheKey = `seminal:${topic}:${minScore}`;
  if (!skipCache) {
    const cached = getCache(cacheKey);
    if (cached) {
      console.log("Seminal papers: Cache hit");
      return cached;
    }
  }

  console.log(`Detecting seminal papers for topic: "${topic}"`);

  // Step 1: Get papers on topic with high citations
  const papers = await Paper.find({
    $text: { $search: topic },
    citedByCount: { $gte: minCitations },
  })
    .sort({ citedByCount: -1 })
    .limit(100)
    .lean();

  if (papers.length === 0) {
    console.log("No papers found for topic");
    return [];
  }

  console.log(`Found ${papers.length} highly-cited papers`);

  // Step 2: Get citation data from Semantic Scholar
  const papersWithCitations = await enrichWithCitationData(papers);

  // Step 3: Calculate PageRank
  console.log("Calculating PageRank scores...");
  const pageRankScores = calculatePageRank(papersWithCitations);

  // Step 4: Calculate all scores for each paper
  const scoredPapers = [];

  for (const paper of papersWithCitations) {
    const paperId = paper._id.toString();
    
    // Get citing papers
    const citingPapers = paper.citingPapers || [];

    // Calculate individual scores
    const scores = {
      citationVelocity: calculateCitationVelocity(paper),
      citationAge: calculateCitationAgeScore(paper, citingPapers),
      pageRank: pageRankScores.get(paperId) || 0,
      crossField: calculateCrossFieldScore(paper, citingPapers),
    };

    // Calculate combined seminal score
    const seminalScore = calculateSeminalScore(paper, scores);

    // Only include papers above threshold
    if (seminalScore >= minScore) {
      scoredPapers.push({
        ...paper,
        seminalScore,
        seminalScoreBreakdown: scores,
        isSeminal: true,
      });
    }
  }

  // Sort by seminal score
  scoredPapers.sort((a, b) => b.seminalScore - a.seminalScore);

  // Limit results
  const results = scoredPapers.slice(0, maxResults);

  console.log(`Identified ${results.length} seminal papers`);

  // Cache results
  setCache(cacheKey, results, 3600000); // 1 hour TTL

  return results;
}

/**
 * Enrich papers with citation data from Semantic Scholar
 * @param {Array} papers - Array of papers
 * @returns {Promise<Array>} Papers with citation data
 */
async function enrichWithCitationData(papers) {
  const enrichedPapers = [];

  for (const paper of papers) {
    try {
      // Get citation data if paper has Semantic Scholar ID
      if (paper.externalIds?.semanticScholar) {
        const citationData = await semanticScholarProvider.getCitations(
          paper.externalIds.semanticScholar,
          { direction: "forward", limit: 100 }
        );

        enrichedPapers.push({
          ...paper,
          citingPapers: citationData.citations || [],
        });
      } else {
        enrichedPapers.push({
          ...paper,
          citingPapers: [],
        });
      }
    } catch (error) {
      console.error(`Error enriching paper ${paper._id}:`, error.message);
      enrichedPapers.push({
        ...paper,
        citingPapers: [],
      });
    }
  }

  return enrichedPapers;
}

/**
 * Update seminal scores for all papers in database
 * Background job to periodically recalculate scores
 * @param {Object} options - Update options
 * @returns {Promise<Object>} Update statistics
 */
export async function updateSeminalScores(options = {}) {
  const {
    batchSize = 100,
    minCitations = 50,
  } = options;

  console.log("Starting seminal score update...");

  const stats = {
    processed: 0,
    updated: 0,
    errors: 0,
  };

  // Process papers in batches
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const papers = await Paper.find({
      citedByCount: { $gte: minCitations },
    })
      .skip(skip)
      .limit(batchSize)
      .lean();

    if (papers.length === 0) {
      hasMore = false;
      break;
    }

    // Enrich with citation data
    const enrichedPapers = await enrichWithCitationData(papers);

    // Calculate PageRank for batch
    const pageRankScores = calculatePageRank(enrichedPapers);

    // Update each paper
    for (const paper of enrichedPapers) {
      try {
        const paperId = paper._id.toString();
        const citingPapers = paper.citingPapers || [];

        const scores = {
          citationVelocity: calculateCitationVelocity(paper),
          citationAge: calculateCitationAgeScore(paper, citingPapers),
          pageRank: pageRankScores.get(paperId) || 0,
          crossField: calculateCrossFieldScore(paper, citingPapers),
        };

        const seminalScore = calculateSeminalScore(paper, scores);

        // Update paper in database
        await Paper.findByIdAndUpdate(paper._id, {
          citationVelocity: scores.citationVelocity,
          citationAgeScore: scores.citationAge,
          pageRankScore: scores.pageRank,
          crossFieldScore: scores.crossField,
          seminalScore,
          isSeminal: seminalScore >= 0.7,
        });

        stats.updated++;
      } catch (error) {
        console.error(`Error updating paper ${paper._id}:`, error);
        stats.errors++;
      }

      stats.processed++;
    }

    skip += batchSize;
    console.log(`Processed ${stats.processed} papers...`);
  }

  console.log("Seminal score update complete:", stats);
  return stats;
}

export default {
  detectSeminalPapers,
  calculateCitationVelocity,
  calculateCitationAgeScore,
  calculatePageRank,
  calculateCrossFieldScore,
  calculateSeminalScore,
  updateSeminalScores,
};

// Made with Bob
