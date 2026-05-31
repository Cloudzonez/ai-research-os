import { SearchProvider } from "../search/SearchProvider.js";

/**
 * CORE (COnnecting REpositories) API integration
 * Docs: https://core.ac.uk/services/api
 * Rate limit: Free tier 10,000 requests/month
 */
export class COREProvider extends SearchProvider {
  constructor(config = {}) {
    super(config);
    this.name = "core";
    this.apiKey = config.apiKey || process.env.CORE_API_KEY;
    this.baseUrl = "https://api.core.ac.uk/v3";
    this.rateLimit = 100; // 100ms between requests to stay under monthly limit
    this.lastRequestTime = 0;
  }

  async search(query) {
    if (!this.apiKey) {
      throw new Error("CORE API key required. Get one at https://core.ac.uk/services/api");
    }

    await this.waitForRateLimit();

    const maxResults = Math.min(query.maxResults || 20, 100); // CORE max is 100
    
    const requestBody = {
      q: query.searchQuery,
      limit: maxResults,
      offset: 0,
    };

    // Add filters if present
    if (query.filters) {
      if (query.filters.yearFrom || query.filters.yearTo) {
        const yearFrom = query.filters.yearFrom || 1900;
        const yearTo = query.filters.yearTo || new Date().getFullYear();
        requestBody.yearPublished = `${yearFrom}-${yearTo}`;
      }
    }

    const url = `${this.baseUrl}/search/works`;
    
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("CORE API key invalid or expired");
        }
        if (response.status === 429) {
          throw new Error("CORE API rate limit exceeded");
        }
        throw new Error(`CORE API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.results || !Array.isArray(data.results)) {
        return [];
      }

      return data.results.map((paper, index) => this.normalize(paper, index));
    } catch (error) {
      console.error("CORE search error:", error);
      throw error;
    }
  }

  async getPaper(id) {
    if (!this.apiKey) {
      throw new Error("CORE API key required");
    }

    await this.waitForRateLimit();

    // Extract CORE ID from various formats
    const coreId = this.extractCoreId(id);
    
    const url = `${this.baseUrl}/works/${coreId}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Paper not found");
        }
        throw new Error(`CORE API error: ${response.status}`);
      }

      const data = await response.json();
      return this.normalize(data, 0);
    } catch (error) {
      console.error("CORE fetch error:", error);
      throw error;
    }
  }

  normalize(coreWork, sourceRank = 0) {
    // Parse authors
    const authors = [];
    if (coreWork.authors) {
      for (const author of coreWork.authors) {
        if (author.name) {
          authors.push(author.name);
        }
      }
    }

    // Parse year
    let year = new Date().getFullYear();
    if (coreWork.yearPublished) {
      year = parseInt(coreWork.yearPublished);
    } else if (coreWork.publishedDate) {
      year = new Date(coreWork.publishedDate).getFullYear();
    }

    // Extract DOI
    let doi = "";
    if (coreWork.doi) {
      doi = coreWork.doi.replace(/^https?:\/\/doi\.org\//i, "");
    }

    // Determine if open access
    const isOpenAccess = coreWork.downloadUrl || coreWork.fullText;

    // Extract repository info
    const repositories = [];
    if (coreWork.repositories) {
      for (const repo of coreWork.repositories) {
        repositories.push({
          name: repo.name,
          url: repo.url,
        });
      }
    }

    // Determine venue type
    let venueType = "journal";
    if (coreWork.documentType) {
      const docType = coreWork.documentType.toLowerCase();
      if (docType.includes("thesis") || docType.includes("dissertation")) {
        venueType = "thesis";
      } else if (docType.includes("conference") || docType.includes("proceeding")) {
        venueType = "conference";
      } else if (docType.includes("book")) {
        venueType = "book";
      } else if (docType.includes("preprint") || docType.includes("working paper")) {
        venueType = "preprint";
      }
    }

    return {
      title: coreWork.title || "",
      authors,
      abstract: coreWork.abstract || coreWork.description || "",
      year,
      doi,
      source: "core",
      
      externalIds: {
        core: coreWork.id,
        doi: doi || undefined,
        oai: coreWork.oai,
      },
      
      venue: coreWork.publisher || coreWork.journals?.[0] || "",
      venueType,
      
      url: coreWork.links?.[0]?.url || `https://core.ac.uk/works/${coreWork.id}`,
      pdfUrl: coreWork.downloadUrl || "",
      
      // CORE-specific metadata
      documentType: coreWork.documentType,
      language: coreWork.language,
      repositories,
      isOpenAccess,
      
      citedByCount: coreWork.citationCount || 0,
      
      codeAvailable: false,
      codeUrls: [],
      dataAvailable: isOpenAccess,
      dataUrls: coreWork.downloadUrl ? [coreWork.downloadUrl] : [],
      
      sourceRank,
      searchRelevanceScore: null,
    };
  }

  extractCoreId(id) {
    if (typeof id === "number") {
      return id.toString();
    }
    
    if (typeof id === "string") {
      // Extract from URL: https://core.ac.uk/works/12345678
      const urlMatch = id.match(/core\.ac\.uk\/works\/(\d+)/);
      if (urlMatch) {
        return urlMatch[1];
      }
      
      // Assume it's the ID itself
      if (/^\d+$/.test(id)) {
        return id;
      }
    }
    
    throw new Error(`Invalid CORE ID format: ${id}`);
  }

  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimit) {
      const waitTime = this.rateLimit - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  getMetadata() {
    return {
      name: "core",
      displayName: "CORE",
      description: "World's largest collection of open access research papers",
      supportsCitations: true,
      supportsFullText: true,
      rateLimit: "10,000 requests/month (free tier)",
      requiresAuth: true,
      coverage: "200M+ open access papers from 10,000+ repositories",
    };
  }
}

// Export singleton instance
export const coreProvider = new COREProvider();

export default { COREProvider, coreProvider };

// Made with Bob
