import { SearchProvider } from "../search/SearchProvider.js";

/**
 * BASE (Bielefeld Academic Search Engine) API integration
 * Docs: https://www.base-search.net/about/en/about_develop.php
 * Coverage: 240M+ documents including theses, reports, grey literature
 * Rate limit: No official limit, be respectful
 */
export class BASEProvider extends SearchProvider {
  constructor(config = {}) {
    super(config);
    this.name = "base";
    this.baseUrl = "https://api.base-search.net/cgi-bin/BaseHttpSearchInterface.fcgi";
    this.rateLimit = 1000; // 1 second between requests
    this.lastRequestTime = 0;
  }

  async search(query) {
    await this.waitForRateLimit();

    const maxResults = Math.min(query.maxResults || 20, 125); // BASE max is 125
    
    const params = new URLSearchParams({
      func: "PerformSearch",
      query: query.searchQuery,
      format: "json",
      hits: maxResults,
      offset: 0,
    });

    // Add filters if present
    if (query.filters) {
      if (query.filters.yearFrom) {
        params.append("yearfrom", query.filters.yearFrom);
      }
      if (query.filters.yearTo) {
        params.append("yearto", query.filters.yearTo);
      }
      if (query.filters.language) {
        params.append("lang", query.filters.language);
      }
    }

    const url = `${this.baseUrl}?${params.toString()}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "AI-Research-OS/1.0 (Educational Research Tool)",
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`BASE API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.response || !data.response.docs) {
        return [];
      }

      return data.response.docs.map((doc, index) => this.normalize(doc, index));
    } catch (error) {
      console.error("BASE search error:", error);
      throw error;
    }
  }

  async getPaper(id) {
    await this.waitForRateLimit();

    const params = new URLSearchParams({
      func: "GetRecord",
      id: id,
      format: "json",
    });

    const url = `${this.baseUrl}?${params.toString()}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "AI-Research-OS/1.0 (Educational Research Tool)",
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`BASE API error: ${response.status}`);
      }

      const data = await response.json();
      return this.normalize(data, 0);
    } catch (error) {
      console.error("BASE fetch error:", error);
      throw error;
    }
  }

  normalize(baseDoc, sourceRank = 0) {
    // Parse authors
    const authors = [];
    if (baseDoc.dcauthor) {
      if (Array.isArray(baseDoc.dcauthor)) {
        authors.push(...baseDoc.dcauthor);
      } else {
        authors.push(baseDoc.dcauthor);
      }
    }

    // Parse year
    let year = new Date().getFullYear();
    if (baseDoc.dcyear) {
      year = parseInt(baseDoc.dcyear);
    } else if (baseDoc.dcdate) {
      const yearMatch = baseDoc.dcdate.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        year = parseInt(yearMatch[0]);
      }
    }

    // Extract DOI
    let doi = "";
    if (baseDoc.dcdoi) {
      doi = baseDoc.dcdoi;
    }

    // Determine document type
    let venueType = "journal";
    let greyLiteratureType = [];
    
    if (baseDoc.dctypenorm) {
      const typeNorm = baseDoc.dctypenorm.toLowerCase();
      if (typeNorm.includes("thesis") || typeNorm.includes("dissertation")) {
        venueType = "thesis";
        greyLiteratureType.push("thesis");
      } else if (typeNorm.includes("report") || typeNorm.includes("working paper")) {
        venueType = "report";
        greyLiteratureType.push("report");
      } else if (typeNorm.includes("conference")) {
        venueType = "conference";
      } else if (typeNorm.includes("book")) {
        venueType = "book";
      } else if (typeNorm.includes("preprint")) {
        venueType = "preprint";
        greyLiteratureType.push("preprint");
      }
    }

    // Extract URLs
    const urls = [];
    if (baseDoc.dclink) {
      if (Array.isArray(baseDoc.dclink)) {
        urls.push(...baseDoc.dclink);
      } else {
        urls.push(baseDoc.dclink);
      }
    }

    return {
      title: baseDoc.dctitle || "",
      authors,
      abstract: baseDoc.dcabstract || baseDoc.dcdescription || "",
      year,
      doi,
      source: "base",
      
      externalIds: {
        base: baseDoc.dcidentifier,
        doi: doi || undefined,
      },
      
      venue: baseDoc.dcsource || baseDoc.dcpublisher || "",
      venueType,
      
      url: urls[0] || `https://www.base-search.net/Record/${baseDoc.dcidentifier}`,
      pdfUrl: urls.find(u => u.includes(".pdf")) || "",
      
      // BASE-specific metadata
      documentType: baseDoc.dctypenorm,
      language: baseDoc.dclang,
      greyLiteratureType,
      repository: baseDoc.dccollection,
      
      citedByCount: 0, // BASE doesn't provide citation counts
      
      codeAvailable: false,
      codeUrls: [],
      dataAvailable: urls.length > 0,
      dataUrls: urls,
      
      sourceRank,
      searchRelevanceScore: null,
    };
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
      name: "base",
      displayName: "BASE",
      description: "Bielefeld Academic Search Engine - Grey literature and open access",
      supportsCitations: false,
      supportsFullText: true,
      rateLimit: "~1 request/second (recommended)",
      requiresAuth: false,
      coverage: "240M+ documents including theses, reports, grey literature",
    };
  }
}

// Export singleton instance
export const baseProvider = new BASEProvider();

export default { BASEProvider, baseProvider };

// Made with Bob
