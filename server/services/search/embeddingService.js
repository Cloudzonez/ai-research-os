import { config } from "../../config.js";
import { getCache, setCache } from "../cache.js";

/**
 * Generate embedding for text using OpenAI API
 * @param {string} text - Text to embed
 * @param {Object} options - Options
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateEmbedding(text, options = {}) {
  if (!text || text.trim().length === 0) {
    throw new Error("Text is required for embedding generation");
  }

  if (!config.openaiApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  // Check cache (embeddings are expensive, cache permanently)
  const cacheKey = `embedding:${config.embeddingModel}:${text.slice(0, 100)}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: options.model || config.embeddingModel || "text-embedding-3-large",
        input: text.slice(0, 8000), // Limit to ~8K chars
        encoding_format: "float",
      }),
      signal: AbortSignal.timeout(options.timeout || 15000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const embedding = data.data[0].embedding;

    // Cache permanently (30 days)
    await setCache(cacheKey, embedding, 86400 * 30);

    return embedding;
  } catch (error) {
    console.error("Embedding generation error:", error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param {string[]} texts - Array of texts
 * @param {Object} options - Options
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
export async function batchGenerateEmbeddings(texts, options = {}) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error("Texts array is required");
  }

  const batchSize = options.batchSize || 100;
  const batches = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    batches.push(texts.slice(i, i + batchSize));
  }

  const results = [];
  
  for (const batch of batches) {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: options.model || config.embeddingModel || "text-embedding-3-large",
          input: batch.map(t => t.slice(0, 8000)),
          encoding_format: "float",
        }),
        signal: AbortSignal.timeout(options.timeout || 30000),
      });

      if (!response.ok) {
        throw new Error(`Batch embedding failed: ${response.status}`);
      }

      const data = await response.json();
      results.push(...data.data.map(d => d.embedding));
    } catch (error) {
      console.error("Batch embedding error:", error);
      // Fill with nulls for failed batch
      results.push(...Array(batch.length).fill(null));
    }
  }

  return results;
}

/**
 * Calculate cosine similarity between two embeddings
 * @param {number[]} a - First embedding
 * @param {number[]} b - Second embedding
 * @returns {number} Similarity score (0-1)
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    throw new Error("Invalid embeddings for similarity calculation");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export default {
  generateEmbedding,
  batchGenerateEmbeddings,
  cosineSimilarity,
};

// Made with Bob
