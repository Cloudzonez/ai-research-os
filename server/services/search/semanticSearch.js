import Paper from "../../models/Paper.js";
import { generateEmbedding } from "./embeddingService.js";
import { getCache, setCache } from "../cache.js";

/**
 * Semantic search using MongoDB Atlas Vector Search
 * @param {string} query - Search query text
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Search results
 */
export async function semanticSearch(query, options = {}) {
  const {
    maxResults = 20,
    filters = {},
    hybridMode = true,
    vectorWeight = 0.7,
  } = options;

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Build filter pipeline
  const filterStage = buildFilterStage(filters);

  if (hybridMode) {
    // Hybrid search: BM25 + Vector
    const results = await Paper.aggregate([
      {
        $search: {
          index: "paper_vector_search",
          compound: {
            should: [
              {
                text: {
                  query,
                  path: ["title", "abstract"],
                  score: { boost: { value: 1 - vectorWeight } }
                }
              },
              {
                knnBeta: {
                  vector: queryEmbedding,
                  path: "embedding",
                  k: maxResults * 2,
                  score: { boost: { value: vectorWeight } }
                }
              }
            ],
            filter: filterStage
          }
        }
      },
      {
        $limit: maxResults
      },
      {
        $project: {
          title: 1,
          authors: 1,
          abstract: 1,
          year: 1,
          doi: 1,
          url: 1,
          citedByCount: 1,
          venue: 1,
          codeAvailable: 1,
          dataAvailable: 1,
          score: { $meta: "searchScore" }
        }
      }
    ]);

    return results;
  } else {
    // Pure vector search
    const results = await Paper.aggregate([
      {
        $search: {
          index: "paper_vector_search",
          knnBeta: {
            vector: queryEmbedding,
            path: "embedding",
            k: maxResults,
            filter: filterStage
          }
        }
      },
      {
        $project: {
          title: 1,
          authors: 1,
          abstract: 1,
          year: 1,
          doi: 1,
          url: 1,
          citedByCount: 1,
          venue: 1,
          score: { $meta: "searchScore" }
        }
      }
    ]);

    return results;
  }
}

/**
 * Find similar papers to a given paper
 * @param {string} paperId - Paper ID
 * @param {Object} options - Options
 * @returns {Promise<Array>} Similar papers
 */
export async function findSimilarPapers(paperId, options = {}) {
  const paper = await Paper.findById(paperId);
  if (!paper) {
    throw new Error("Paper not found");
  }

  // Generate embedding if missing
  if (!paper.embedding) {
    const text = `${paper.title} ${paper.abstract || ""}`.slice(0, 8000);
    paper.embedding = await generateEmbedding(text);
    paper.embeddingModel = "text-embedding-3-large";
    paper.embeddedAt = new Date();
    await paper.save();
  }

  // Find similar papers using vector search
  const results = await Paper.aggregate([
    {
      $search: {
        index: "paper_vector_search",
        knnBeta: {
          vector: paper.embedding,
          path: "embedding",
          k: options.maxResults || 10,
          filter: {
            _id: { $ne: paper._id }
          }
        }
      }
    },
    {
      $project: {
        title: 1,
        authors: 1,
        abstract: 1,
        year: 1,
        doi: 1,
        url: 1,
        citedByCount: 1,
        venue: 1,
        similarity: { $meta: "searchScore" }
      }
    }
  ]);

  return results;
}

/**
 * Build MongoDB filter stage from search filters
 */
function buildFilterStage(filters) {
  const conditions = [];

  if (filters.yearFrom || filters.yearTo) {
    const yearFilter = {};
    if (filters.yearFrom) yearFilter.$gte = filters.yearFrom;
    if (filters.yearTo) yearFilter.$lte = filters.yearTo;
    conditions.push({ year: yearFilter });
  }

  if (filters.studyType) {
    conditions.push({ studyType: filters.studyType });
  }

  if (filters.hasCode) {
    conditions.push({ codeAvailable: true });
  }

  if (filters.hasData) {
    conditions.push({ dataAvailable: true });
  }

  if (filters.minCitations) {
    conditions.push({ citedByCount: { $gte: filters.minCitations } });
  }

  return conditions.length > 0 ? { $and: conditions } : {};
}

export default {
  semanticSearch,
  findSimilarPapers,
};

// Made with Bob
