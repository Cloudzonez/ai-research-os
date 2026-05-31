/**
 * Base interface for all search providers
 * All adapters (OpenAlex, arXiv, Semantic Scholar, etc.) must implement this interface
 */
export class SearchProvider {
  constructor(config = {}) {
    this.name = "base";
    this.config = config;
    this.timeout = config.timeout || 15000; // 15 seconds default
  }

  /**
   * Search for papers
   * @param {Object} query - Structured query object from queryParser
   * @param {string} query.searchQuery - Search text
   * @param {string} query.mainTopic - Main research topic
   * @param {string[]} query.keywords - Search keywords
   * @param {Object} query.filters - Optional filters
   * @param {number} query.filters.yearFrom - Start year
   * @param {number} query.filters.yearTo - End year
   * @param {string} query.filters.studyType - Study type filter
   * @param {string} query.filters.population - Population filter
   * @param {string[]} query.filters.authors - Author names
   * @param {boolean} query.filters.hasCode - Require code availability
   * @param {boolean} query.filters.hasData - Require data availability
   * @param {number} query.filters.minCitations - Minimum citation count
   * @param {string} query.sortBy - Sort preference (relevance|citations|date)
   * @param {number} query.maxResults - Max results to return
   * @returns {Promise<Array>} Array of normalized paper objects
   */
  async search(query) {
    throw new Error(`search() must be implemented by ${this.name} provider`);
  }

  /**
   * Get a single paper by ID
   * @param {string} id - Paper ID (source-specific format)
   * @returns {Promise<Object>} Normalized paper object
   */
  async getPaper(id) {
    throw new Error(`getPaper() must be implemented by ${this.name} provider`);
  }

  /**
   * Get citations for a paper
   * @param {string} id - Paper ID
   * @param {Object} options - Options
   * @param {string} options.direction - "forward" (cited-by) or "backward" (references)
   * @param {number} options.limit - Max citations to return
   * @param {number} options.offset - Pagination offset
   * @returns {Promise<Object>} { citations: [], totalCount: number }
   */
  async getCitations(id, options = {}) {
    // Optional - not all providers support citations
    return { citations: [], totalCount: 0 };
  }

  /**
   * Normalize source-specific paper to common schema
   * @param {Object} rawPaper - Source-specific paper object
   * @returns {Object} Normalized paper matching Paper model schema
   */
  normalize(rawPaper) {
    throw new Error(`normalize() must be implemented by ${this.name} provider`);
  }

  /**
   * Check if provider is available (health check)
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      // Simple health check - try to search for a common term
      await this.search({
        searchQuery: "test",
        maxResults: 1,
        filters: {},
      });
      return true;
    } catch (error) {
      console.error(`${this.name} provider health check failed:`, error.message);
      return false;
    }
  }

  /**
   * Get provider metadata
   * @returns {Object} Provider information
   */
  getMetadata() {
    return {
      name: this.name,
      supportsCitations: false,
      supportsFullText: false,
      rateLimit: null,
      requiresAuth: false,
    };
  }
}

/**
 * Common paper schema for normalization
 * All providers should normalize to this structure
 */
export const COMMON_PAPER_SCHEMA = {
  // Required fields
  title: String,
  authors: Array, // Array of strings
  abstract: String,
  year: Number,
  source: String, // Provider name (openalex, arxiv, etc.)
  
  // Optional identifiers
  doi: String,
  url: String,
  pdfUrl: String,
  
  // External IDs
  externalIds: {
    openAlex: String,
    arxiv: String,
    semanticScholar: String,
    pubmed: String,
    doi: String,
  },
  
  // Metadata
  venue: String,
  venueType: String, // journal, conference, preprint, etc.
  citedByCount: Number,
  referencesCount: Number,
  
  // Availability
  codeAvailable: Boolean,
  codeUrls: Array,
  dataAvailable: Boolean,
  dataUrls: Array,
  
  // Search metadata
  searchRelevanceScore: Number,
  sourceRank: Number, // Rank in source results
};

export default SearchProvider;

// Made with Bob
