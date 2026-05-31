import { SearchProvider } from "../search/SearchProvider.js";

/**
 * PubMed/NCBI E-utilities API integration
 * Docs: https://www.ncbi.nlm.nih.gov/books/NBK25501/
 * Rate limit: 3 requests/second (10/sec with API key)
 */
export class PubMedProvider extends SearchProvider {
  constructor(config = {}) {
    super(config);
    this.name = "pubmed";
    this.baseUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
    this.apiKey = config.apiKey || process.env.PUBMED_API_KEY;
    this.rateLimit = this.apiKey ? 100 : 333; // ms between requests
    this.lastRequestTime = 0;
  }

  async search(query) {
    const maxResults = query.maxResults || 20;
    
    // Step 1: Search for PMIDs
    const pmids = await this.searchPMIDs(query.searchQuery, maxResults);
    
    if (pmids.length === 0) {
      return [];
    }

    // Step 2: Fetch article details
    const articles = await this.fetchArticleDetails(pmids);
    
    // Step 3: Normalize results
    return articles.map((article, index) => this.normalize(article, index));
  }

  async searchPMIDs(queryText, maxResults) {
    await this.waitForRateLimit();

    const params = new URLSearchParams({
      db: "pubmed",
      term: queryText,
      retmax: maxResults,
      retmode: "json",
      sort: "relevance",
    });

    if (this.apiKey) {
      params.append("api_key", this.apiKey);
    }

    const url = `${this.baseUrl}/esearch.fcgi?${params.toString()}`;
    
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`PubMed search error: ${response.status}`);
      }

      const data = await response.json();
      return data.esearchresult?.idlist || [];
    } catch (error) {
      console.error("PubMed search error:", error);
      throw error;
    }
  }

  async fetchArticleDetails(pmids) {
    await this.waitForRateLimit();

    const params = new URLSearchParams({
      db: "pubmed",
      id: pmids.join(","),
      retmode: "json",
    });

    if (this.apiKey) {
      params.append("api_key", this.apiKey);
    }

    const url = `${this.baseUrl}/esummary.fcgi?${params.toString()}`;
    
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`PubMed fetch error: ${response.status}`);
      }

      const data = await response.json();
      const result = data.result;
      
      if (!result) {
        return [];
      }

      // Extract articles from result object
      const articles = [];
      for (const pmid of pmids) {
        if (result[pmid] && result[pmid].uid) {
          articles.push(result[pmid]);
        }
      }

      return articles;
    } catch (error) {
      console.error("PubMed fetch error:", error);
      throw error;
    }
  }

  async getPaper(id) {
    // Extract PMID from various formats
    const pmid = this.extractPMID(id);
    
    const articles = await this.fetchArticleDetails([pmid]);
    
    if (articles.length === 0) {
      throw new Error("Paper not found");
    }

    return this.normalize(articles[0], 0);
  }

  normalize(pubmedArticle, sourceRank = 0) {
    // Extract DOI from elocationid or articleids
    let doi = "";
    if (pubmedArticle.elocationid) {
      doi = pubmedArticle.elocationid.replace(/^doi:\s*/i, "");
    } else if (pubmedArticle.articleids) {
      const doiObj = pubmedArticle.articleids.find(id => id.idtype === "doi");
      if (doiObj) {
        doi = doiObj.value;
      }
    }

    // Extract PMC ID
    let pmcid = "";
    if (pubmedArticle.articleids) {
      const pmcObj = pubmedArticle.articleids.find(id => id.idtype === "pmc");
      if (pmcObj) {
        pmcid = pmcObj.value;
      }
    }

    // Parse publication date
    let year = new Date().getFullYear();
    if (pubmedArticle.pubdate) {
      const yearMatch = pubmedArticle.pubdate.match(/\d{4}/);
      if (yearMatch) {
        year = parseInt(yearMatch[0]);
      }
    }

    // Extract authors
    const authors = [];
    if (pubmedArticle.authors) {
      for (const author of pubmedArticle.authors) {
        if (author.name) {
          authors.push(author.name);
        }
      }
    }

    return {
      title: pubmedArticle.title || "",
      authors,
      abstract: pubmedArticle.abstract || "",
      year,
      doi,
      source: "pubmed",
      
      externalIds: {
        pubmed: pubmedArticle.uid,
        pmc: pmcid,
        doi: doi || undefined,
      },
      
      venue: pubmedArticle.fulljournalname || pubmedArticle.source || "",
      venueType: "journal",
      
      url: `https://pubmed.ncbi.nlm.nih.gov/${pubmedArticle.uid}/`,
      pdfUrl: pmcid ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/pdf/` : "",
      
      // PubMed-specific metadata
      pubTypes: pubmedArticle.pubtype || [],
      meshTerms: pubmedArticle.meshterms || [],
      
      citedByCount: 0, // PubMed doesn't provide citation counts
      
      codeAvailable: false,
      codeUrls: [],
      dataAvailable: !!pmcid, // PMC articles have full text
      dataUrls: pmcid ? [`https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/`] : [],
      
      sourceRank,
      searchRelevanceScore: null,
    };
  }

  extractPMID(id) {
    // Handle various PMID formats
    if (typeof id === "number") {
      return id.toString();
    }
    
    if (typeof id === "string") {
      // Extract from URL: https://pubmed.ncbi.nlm.nih.gov/12345678/
      const urlMatch = id.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/);
      if (urlMatch) {
        return urlMatch[1];
      }
      
      // Extract from PMID: prefix
      const pmidMatch = id.match(/^PMID:?\s*(\d+)$/i);
      if (pmidMatch) {
        return pmidMatch[1];
      }
      
      // Assume it's just the PMID
      if (/^\d+$/.test(id)) {
        return id;
      }
    }
    
    throw new Error(`Invalid PMID format: ${id}`);
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
      name: "pubmed",
      displayName: "PubMed",
      description: "Biomedical literature from MEDLINE and life science journals",
      supportsCitations: false,
      supportsFullText: true, // Via PMC
      rateLimit: this.apiKey ? "10 requests/second" : "3 requests/second",
      requiresAuth: false,
      coverage: "35M+ biomedical citations",
    };
  }
}

// Export singleton instance
export const pubmedProvider = new PubMedProvider();

export default { PubMedProvider, pubmedProvider };

// Made with Bob
