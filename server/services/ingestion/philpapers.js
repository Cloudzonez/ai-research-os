import { SearchProvider } from "../search/SearchProvider.js";

/**
 * PhilPapers API integration
 * Docs: https://philpapers.org/help/api.html
 * Rate limit: No official limit, be respectful
 */
export class PhilPapersProvider extends SearchProvider {
  constructor(config = {}) {
    super(config);
    this.name = "philpapers";
    this.baseUrl = "https://philpapers.org/api";
    this.rateLimit = 1000; // 1 second between requests to be respectful
    this.lastRequestTime = 0;
  }

  async search(query) {
    await this.waitForRateLimit();

    const maxResults = query.maxResults || 20;
    
    const params = new URLSearchParams({
      format: "json",
      limit: maxResults,
    });

    // Build search query
    let searchQuery = query.searchQuery;
    
    // Add filters if present
    if (query.filters) {
      if (query.filters.yearFrom) {
        searchQuery += ` year:${query.filters.yearFrom}-`;
      }
      if (query.filters.yearTo) {
        searchQuery += query.filters.yearTo || new Date().getFullYear();
      }
      if (query.filters.authors && query.filters.authors.length > 0) {
        searchQuery += ` author:"${query.filters.authors[0]}"`;
      }
    }

    params.append("q", searchQuery);

    const url = `${this.baseUrl}/search?${params.toString()}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "AI-Research-OS/1.0 (Educational Research Tool)",
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`PhilPapers API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.results || !Array.isArray(data.results)) {
        return [];
      }

      return data.results.map((paper, index) => this.normalize(paper, index));
    } catch (error) {
      console.error("PhilPapers search error:", error);
      throw error;
    }
  }

  async getPaper(id) {
    await this.waitForRateLimit();

    // Extract PhilPapers ID from various formats
    const philPapersId = this.extractPhilPapersId(id);
    
    const url = `${this.baseUrl}/record/${philPapersId}?format=json`;
    
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "AI-Research-OS/1.0 (Educational Research Tool)",
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`PhilPapers API error: ${response.status}`);
      }

      const data = await response.json();
      return this.normalize(data, 0);
    } catch (error) {
      console.error("PhilPapers fetch error:", error);
      throw error;
    }
  }

  normalize(philPaper, sourceRank = 0) {
    // Parse authors
    const authors = [];
    if (philPaper.authors) {
      if (Array.isArray(philPaper.authors)) {
        authors.push(...philPaper.authors.map(a => a.name || a));
      } else if (typeof philPaper.authors === "string") {
        authors.push(philPaper.authors);
      }
    }

    // Parse year
    let year = new Date().getFullYear();
    if (philPaper.year) {
      year = parseInt(philPaper.year);
    } else if (philPaper.pubInfo) {
      const yearMatch = philPaper.pubInfo.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        year = parseInt(yearMatch[0]);
      }
    }

    // Extract DOI
    let doi = "";
    if (philPaper.doi) {
      doi = philPaper.doi;
    } else if (philPaper.url && philPaper.url.includes("doi.org")) {
      const doiMatch = philPaper.url.match(/doi\.org\/(.+)$/);
      if (doiMatch) {
        doi = doiMatch[1];
      }
    }

    // Parse categories (PhilPapers taxonomy)
    const categories = [];
    if (philPaper.categories) {
      if (Array.isArray(philPaper.categories)) {
        categories.push(...philPaper.categories);
      } else if (typeof philPaper.categories === "string") {
        categories.push(philPaper.categories);
      }
    }

    // Determine venue type
    let venueType = "journal";
    if (philPaper.pubInfo) {
      const pubInfo = philPaper.pubInfo.toLowerCase();
      if (pubInfo.includes("book") || pubInfo.includes("anthology")) {
        venueType = "book";
      } else if (pubInfo.includes("conference") || pubInfo.includes("proceedings")) {
        venueType = "conference";
      } else if (pubInfo.includes("dissertation") || pubInfo.includes("thesis")) {
        venueType = "thesis";
      } else if (pubInfo.includes("preprint") || pubInfo.includes("draft")) {
        venueType = "preprint";
      }
    }

    return {
      title: philPaper.title || "",
      authors,
      abstract: philPaper.abstract || "",
      year,
      doi,
      source: "philpapers",
      
      externalIds: {
        philpapers: philPaper.id || philPaper.entryId,
        doi: doi || undefined,
      },
      
      venue: philPaper.venue || this.extractVenue(philPaper.pubInfo),
      venueType,
      
      url: philPaper.url || `https://philpapers.org/rec/${philPaper.id || philPaper.entryId}`,
      pdfUrl: philPaper.pdfUrl || "",
      
      // PhilPapers-specific metadata
      categories,
      pubInfo: philPaper.pubInfo,
      
      citedByCount: philPaper.citations || 0,
      
      codeAvailable: false,
      codeUrls: [],
      dataAvailable: !!philPaper.pdfUrl,
      dataUrls: philPaper.pdfUrl ? [philPaper.pdfUrl] : [],
      
      sourceRank,
      searchRelevanceScore: null,
    };
  }

  extractVenue(pubInfo) {
    if (!pubInfo) return "";
    
    // Try to extract journal/book name from publication info
    // Format examples:
    // "Journal of Philosophy 115 (1):1-25 (2018)"
    // "In John Doe (ed.), Book Title. Publisher (2020)"
    
    // Match journal pattern
    const journalMatch = pubInfo.match(/^([^0-9(]+?)(?:\s+\d+|\s+\()/);
    if (journalMatch) {
      return journalMatch[1].trim();
    }
    
    // Match book pattern
    const bookMatch = pubInfo.match(/In .+?\(ed\.\),\s+(.+?)\./);
    if (bookMatch) {
      return bookMatch[1].trim();
    }
    
    return pubInfo.split(/[.(]/)[0].trim();
  }

  extractPhilPapersId(id) {
    if (typeof id === "string") {
      // Extract from URL: https://philpapers.org/rec/AUTHOR-TITLE
      const urlMatch = id.match(/philpapers\.org\/rec\/([A-Z0-9-]+)/i);
      if (urlMatch) {
        return urlMatch[1];
      }
      
      // Assume it's the ID itself
      return id;
    }
    
    throw new Error(`Invalid PhilPapers ID format: ${id}`);
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
      name: "philpapers",
      displayName: "PhilPapers",
      description: "Comprehensive index of philosophy research",
      supportsCitations: true,
      supportsFullText: true,
      rateLimit: "~1 request/second (recommended)",
      requiresAuth: false,
      coverage: "2.9M+ philosophy papers",
    };
  }
}

// Export singleton instance
export const philpapersProvider = new PhilPapersProvider();

export default { PhilPapersProvider, philpapersProvider };

// Made with Bob
