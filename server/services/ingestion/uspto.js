import { SearchProvider } from "../search/SearchProvider.js";

/**
 * USPTO (United States Patent and Trademark Office) API integration
 * Docs: https://developer.uspto.gov/api-catalog
 * Coverage: US patents and applications
 * Rate limit: No official limit, be respectful
 */
export class USPTOProvider extends SearchProvider {
  constructor(config = {}) {
    super(config);
    this.name = "uspto";
    this.baseUrl = "https://developer.uspto.gov/ibd-api/v1";
    this.rateLimit = 1000; // 1 second between requests
    this.lastRequestTime = 0;
  }

  async search(query) {
    await this.waitForRateLimit();

    const maxResults = Math.min(query.searchQuery || 20, 100);
    
    const params = new URLSearchParams({
      searchText: query.searchQuery,
      start: 0,
      rows: maxResults,
    });

    const url = `${this.baseUrl}/patent/application?${params.toString()}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`USPTO API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.response || !data.response.docs) {
        return [];
      }

      return data.response.docs.map((doc, index) => this.normalize(doc, index));
    } catch (error) {
      console.error("USPTO search error:", error);
      throw error;
    }
  }

  async getPaper(id) {
    await this.waitForRateLimit();

    // Extract patent number from various formats
    const patentNumber = this.extractPatentNumber(id);
    
    const url = `${this.baseUrl}/patent/application/${patentNumber}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Patent not found");
        }
        throw new Error(`USPTO API error: ${response.status}`);
      }

      const data = await response.json();
      return this.normalize(data, 0);
    } catch (error) {
      console.error("USPTO fetch error:", error);
      throw error;
    }
  }

  normalize(usptoPatent, sourceRank = 0) {
    // Parse inventors
    const inventors = [];
    if (usptoPatent.inventors) {
      for (const inventor of usptoPatent.inventors) {
        if (inventor.name) {
          inventors.push(inventor.name);
        }
      }
    }

    // Parse year
    let year = new Date().getFullYear();
    if (usptoPatent.publicationDate) {
      year = new Date(usptoPatent.publicationDate).getFullYear();
    } else if (usptoPatent.applicationDate) {
      year = new Date(usptoPatent.applicationDate).getFullYear();
    }

    // Parse classifications
    const classifications = {
      ipc: [],
      cpc: [],
      uspc: [],
    };

    if (usptoPatent.ipcCodes) {
      classifications.ipc = Array.isArray(usptoPatent.ipcCodes) 
        ? usptoPatent.ipcCodes 
        : [usptoPatent.ipcCodes];
    }

    if (usptoPatent.cpcCodes) {
      classifications.cpc = Array.isArray(usptoPatent.cpcCodes)
        ? usptoPatent.cpcCodes
        : [usptoPatent.cpcCodes];
    }

    if (usptoPatent.uspcCodes) {
      classifications.uspc = Array.isArray(usptoPatent.uspcCodes)
        ? usptoPatent.uspcCodes
        : [usptoPatent.uspcCodes];
    }

    // Determine legal status
    let legalStatus = "pending";
    if (usptoPatent.patentStatus) {
      const status = usptoPatent.patentStatus.toLowerCase();
      if (status.includes("granted")) {
        legalStatus = "granted";
      } else if (status.includes("expired")) {
        legalStatus = "expired";
      } else if (status.includes("abandoned")) {
        legalStatus = "abandoned";
      }
    }

    return {
      title: usptoPatent.title || "",
      abstract: usptoPatent.abstract || "",
      authors: inventors,
      year,
      source: "uspto",
      itemType: "patent",
      
      // Patent-specific fields
      patentNumber: usptoPatent.patentNumber || usptoPatent.applicationNumber,
      patentOffice: "USPTO",
      applicationNumber: usptoPatent.applicationNumber,
      applicationDate: usptoPatent.applicationDate,
      publicationDate: usptoPatent.publicationDate,
      grantDate: usptoPatent.grantDate,
      
      inventors,
      assignee: usptoPatent.assignee || usptoPatent.applicant,
      
      classifications,
      
      claims: usptoPatent.claims || [],
      description: usptoPatent.description || "",
      
      legalStatus,
      
      externalIds: {
        uspto: usptoPatent.patentNumber || usptoPatent.applicationNumber,
      },
      
      url: `https://patents.google.com/patent/${usptoPatent.patentNumber}`,
      pdfUrl: usptoPatent.pdfUrl || "",
      
      citedByCount: usptoPatent.citationCount || 0,
      
      sourceRank,
      searchRelevanceScore: null,
    };
  }

  extractPatentNumber(id) {
    if (typeof id === "string") {
      // Extract from URL: https://patents.google.com/patent/US1234567
      const urlMatch = id.match(/patent\/([A-Z]{2}\d+)/);
      if (urlMatch) {
        return urlMatch[1];
      }
      
      // Assume it's the patent number itself
      return id;
    }
    
    throw new Error(`Invalid patent number format: ${id}`);
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
      name: "uspto",
      displayName: "USPTO",
      description: "United States Patent and Trademark Office",
      supportsCitations: true,
      supportsFullText: true,
      rateLimit: "~1 request/second (recommended)",
      requiresAuth: false,
      coverage: "US patents and applications",
    };
  }
}

// Export singleton instance
export const usptoProvider = new USPTOProvider();

export default { USPTOProvider, usptoProvider };

// Made with Bob
