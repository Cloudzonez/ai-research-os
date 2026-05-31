import { SearchProvider } from "../search/SearchProvider.js";

/**
 * OpenGrey API integration
 * Docs: http://www.opengrey.eu/
 * Coverage: European grey literature (reports, theses, conference papers)
 * Protocol: OAI-PMH
 * Rate limit: No official limit, be respectful
 */
export class OpenGreyProvider extends SearchProvider {
  constructor(config = {}) {
    super(config);
    this.name = "opengrey";
    this.baseUrl = "http://www.opengrey.eu/oai";
    this.rateLimit = 2000; // 2 seconds between requests
    this.lastRequestTime = 0;
  }

  async search(query) {
    await this.waitForRateLimit();

    // OpenGrey uses OAI-PMH protocol
    // We'll use ListRecords with search in metadata
    const params = new URLSearchParams({
      verb: "ListRecords",
      metadataPrefix: "oai_dc",
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
        throw new Error(`OpenGrey API error: ${response.status}`);
      }

      const xmlText = await response.text();
      const records = this.parseOAIPMH(xmlText);
      
      // Filter records by query
      const filtered = records.filter(record => {
        const searchText = `${record.title} ${record.abstract}`.toLowerCase();
        return searchText.includes(query.searchQuery.toLowerCase());
      });

      // Limit results
      const maxResults = query.maxResults || 20;
      return filtered.slice(0, maxResults).map((record, index) => this.normalize(record, index));
    } catch (error) {
      console.error("OpenGrey search error:", error);
      throw error;
    }
  }

  parseOAIPMH(xmlText) {
    const records = [];
    
    // Simple XML parsing using regex (avoids xml2js dependency)
    const recordMatches = xmlText.match(/<record>[\s\S]*?<\/record>/g) || [];
    
    for (const recordXml of recordMatches) {
      const getTag = (tag) => {
        const match = recordXml.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`));
        return match ? match[1].trim() : "";
      };
      
      const getAllTags = (tag) => {
        const matches = recordXml.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`, "g")) || [];
        return matches.map(m => m.replace(new RegExp(`<\/?${tag}>`, "g"), "").trim());
      };

      records.push({
        identifier: getTag("identifier"),
        title: getTag("dc:title"),
        creators: getAllTags("dc:creator"),
        abstract: getTag("dc:description"),
        date: getTag("dc:date"),
        type: getTag("dc:type"),
        publisher: getTag("dc:publisher"),
        language: getTag("dc:language"),
        subjects: getAllTags("dc:subject"),
      });
    }
    
    return records;
  }

  async getPaper(id) {
    await this.waitForRateLimit();

    const params = new URLSearchParams({
      verb: "GetRecord",
      identifier: id,
      metadataPrefix: "oai_dc",
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
        throw new Error(`OpenGrey API error: ${response.status}`);
      }

      const xmlText = await response.text();
      const records = this.parseOAIPMH(xmlText);
      
      if (records.length === 0) {
        throw new Error("Paper not found");
      }

      return this.normalize(records[0], 0);
    } catch (error) {
      console.error("OpenGrey fetch error:", error);
      throw error;
    }
  }

  normalize(opengreyRecord, sourceRank = 0) {
    // Parse year
    let year = new Date().getFullYear();
    if (opengreyRecord.date) {
      const yearMatch = opengreyRecord.date.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        year = parseInt(yearMatch[0]);
      }
    }

    // Determine document type
    let venueType = "report";
    let greyLiteratureType = ["report"];
    
    if (opengreyRecord.type) {
      const type = opengreyRecord.type.toLowerCase();
      if (type.includes("thesis") || type.includes("dissertation")) {
        venueType = "thesis";
        greyLiteratureType = ["thesis"];
      } else if (type.includes("conference")) {
        venueType = "conference";
        greyLiteratureType = ["conference"];
      } else if (type.includes("technical report")) {
        venueType = "report";
        greyLiteratureType = ["report"];
      }
    }

    return {
      title: opengreyRecord.title || "",
      authors: opengreyRecord.creators || [],
      abstract: opengreyRecord.abstract || "",
      year,
      doi: "",
      source: "opengrey",
      
      externalIds: {
        opengrey: opengreyRecord.identifier,
      },
      
      venue: opengreyRecord.publisher || "",
      venueType,
      
      url: `http://www.opengrey.eu/?id=${opengreyRecord.identifier}`,
      pdfUrl: "",
      
      // OpenGrey-specific metadata
      documentType: opengreyRecord.type,
      language: opengreyRecord.language,
      subjects: opengreyRecord.subjects,
      greyLiteratureType,
      
      citedByCount: 0,
      
      codeAvailable: false,
      codeUrls: [],
      dataAvailable: false,
      dataUrls: [],
      
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
      name: "opengrey",
      displayName: "OpenGrey",
      description: "European grey literature repository",
      supportsCitations: false,
      supportsFullText: false,
      rateLimit: "~0.5 requests/second (recommended)",
      requiresAuth: false,
      coverage: "European grey literature (reports, theses, conference papers)",
    };
  }
}

// Export singleton instance
export const opengreyProvider = new OpenGreyProvider();

export default { OpenGreyProvider, opengreyProvider };

// Made with Bob
