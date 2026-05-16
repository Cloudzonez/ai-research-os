// ─── Text chunking for Tier 4 context ──────────────────────────────
// Paragraph-aware splitting with overlap, TF-based relevance scoring.
// Pure functions — no imports from models, fully testable.

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "in", "on", "to", "for", "with",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "could", "should", "may", "might",
  "can", "shall", "this", "that", "these", "those", "it", "its", "they",
  "them", "their", "we", "us", "our", "he", "she", "his", "her", "from",
  "by", "at", "as", "but", "not", "no", "so", "if", "than", "then", "also",
  "which", "who", "whom", "what", "when", "where", "how", "all", "each",
  "every", "both", "few", "more", "most", "other", "some", "such", "only",
  "own", "same", "into", "over", "under", "up", "out", "about", "after",
  "before", "between", "through", "during", "above", "below", "any",
]);

/**
 * Split text into overlapping chunks by paragraph boundaries.
 * Accumulates paragraphs until maxChunkSize is reached, then starts a new chunk.
 * @param {string} text - Full text to split
 * @param {number} maxChunkSize - Max characters per chunk (default 2000)
 * @param {number} overlap - Characters of overlap between consecutive chunks (default 200)
 * @returns {Array<{index: number, text: string}>}
 */
export function splitIntoChunks(text, maxChunkSize = 2000, overlap = 200) {
  if (!text || text.trim().length === 0) return [];

  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

  // If the entire text is shorter than maxChunkSize, return as single chunk
  if (text.length <= maxChunkSize) {
    return [{ index: 0, text: text.trim() }];
  }

  const chunks = [];
  let currentChunk = [];
  let currentLength = 0;

  for (const para of paragraphs) {
    const paraLen = para.length;

    if (currentLength + paraLen > maxChunkSize && currentChunk.length > 0) {
      // Finish current chunk
      chunks.push({
        index: chunks.length,
        text: currentChunk.join("\n\n").trim(),
      });

      // Start new chunk with overlap: carry forward the last paragraph
      // if it fits within the overlap window
      if (overlap > 0 && currentChunk.length > 0) {
        const lastPara = currentChunk[currentChunk.length - 1];
        if (lastPara.length <= overlap) {
          currentChunk = [lastPara];
          currentLength = lastPara.length;
        } else {
          // Take the tail of the last paragraph as overlap
          const tail = lastPara.slice(-overlap);
          currentChunk = [tail];
          currentLength = tail.length;
        }
      } else {
        currentChunk = [];
        currentLength = 0;
      }
    }

    currentChunk.push(para);
    currentLength += paraLen;
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push({
      index: chunks.length,
      text: currentChunk.join("\n\n").trim(),
    });
  }

  // If only one chunk was produced, return it
  return chunks;
}

/**
 * Tokenize text into lowercase terms, filtering stop words and short tokens.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[\s,.;:!?()\[\]{}"']+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

/**
 * Score chunks by relevance to the query using TF overlap.
 * @param {Array<{index: number, text: string}>} chunks
 * @param {string} query
 * @returns {Array<{index: number, text: string, score: number}>}
 */
export function rankChunksByRelevance(chunks, query) {
  if (!query || query.trim().length === 0) {
    return chunks.map((c) => ({ ...c, score: 0 }));
  }

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    return chunks.map((c) => ({ ...c, score: 0 }));
  }

  return chunks
    .map((chunk) => {
      const chunkTerms = tokenize(chunk.text);
      if (chunkTerms.length === 0) return { ...chunk, score: 0 };

      // Count unique query terms that appear in the chunk
      const chunkTermSet = new Set(chunkTerms);
      let matches = 0;
      for (const qt of queryTerms) {
        if (chunkTermSet.has(qt)) matches++;
      }

      // TF score: fraction of query terms found, normalized by chunk length
      const recall = matches / queryTerms.length;
      const lengthPenalty = Math.min(1, 500 / chunk.text.length); // favor shorter chunks
      const score = recall * 0.7 + lengthPenalty * 0.3;

      return { ...chunk, score: Math.round(score * 1000) / 1000 };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Select top N most relevant chunks from text for a given query.
 * @param {string} text - Full paper text
 * @param {string} query - User query for relevance matching
 * @param {number} topN - Number of chunks to return (default 3)
 * @param {number} maxChunkSize - Characters per chunk (default 2000)
 * @returns {Array<{index: number, text: string, score: number}>}
 */
export function selectRelevantChunks(text, query, topN = 3, maxChunkSize = 2000) {
  const chunks = splitIntoChunks(text, maxChunkSize);
  if (chunks.length === 0) return [];

  // If we only have a few chunks, just rank them and return all
  if (chunks.length <= topN) {
    return rankChunksByRelevance(chunks, query);
  }

  const ranked = rankChunksByRelevance(chunks, query);
  return ranked.slice(0, topN);
}

export default { splitIntoChunks, rankChunksByRelevance, selectRelevantChunks };
