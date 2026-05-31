import { SearchProvider } from "../search/SearchProvider.js";

export async function searchSemanticScholar(query, maxResults = 10, options = {}) {
  const baseUrl = "https://api.semanticscholar.org/graph/v1/paper/search";
  const params = new URLSearchParams({
    query,
    limit: String(Math.min(Math.max(Number(maxResults) || 10, 1), 100)),
    fields: "title,authors,abstract,year,externalIds,url,openAccessPdf,citationCount,venue,publicationDate",
  });

  const headers = { Accept: "application/json" };
  const apiKey = options.apiKey || process.env.SEMANTIC_SCHOLAR_API_KEY;
  if (apiKey) headers["x-api-key"] = apiKey;

  const res = await fetchWithRetry(`${baseUrl}?${params.toString()}`, { headers }, options);
  if (!res.ok) {
    throw new Error(`Semantic Scholar API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return (data.data || []).map((paper) => ({
    title: paper.title || "",
    authors: (paper.authors || []).map((author) => author.name || "").filter(Boolean),
    abstract: paper.abstract || "",
    doi: paper.externalIds?.DOI || "",
    year: paper.year || Number(paper.publicationDate?.slice(0, 4)) || new Date().getFullYear(),
    source: "semantic_scholar",
    url: paper.url || "",
    pdfUrl: paper.openAccessPdf?.url || "",
    citedByCount: paper.citationCount || 0,
    venue: paper.venue || "",
  }));
}

async function fetchWithRetry(url, init, options = {}) {
  const maxRetries = options.retries ?? 5;
  const baseDelay = options.retryDelay || 4000;
  const timeoutMs = options.timeoutMs || 15000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status !== 429 && res.status !== 503) return res;
    if (attempt === maxRetries) return res;
    const delay = baseDelay * Math.pow(2, attempt);
    console.warn(`Semantic Scholar: ${res.status} on attempt ${attempt + 1}, retrying in ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

/**
 * Semantic Scholar search provider implementing SearchProvider interface
 */
export class SemanticScholarProvider extends SearchProvider {
  constructor(config = {}) {
    super(config);
    this.name = "semantic_scholar";
    this.apiKey = config.apiKey || process.env.SEMANTIC_SCHOLAR_API_KEY;
  }

  async search(query) {
    const results = await searchSemanticScholar(
      query.searchQuery,
      query.maxResults || 20,
      {
        apiKey: this.apiKey,
        timeoutMs: this.timeout,
      }
    );
    
    return results.map((paper, index) => this.normalize(paper, index));
  }

  async getPaper(id) {
    // Semantic Scholar ID format: paper ID or DOI
    const url = `https://api.semanticscholar.org/graph/v1/paper/${id}`;
    const headers = { Accept: "application/json" };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;
    
    const res = await fetch(url + "?fields=title,authors,abstract,year,externalIds,url,openAccessPdf,citationCount,venue,publicationDate,referenceCount,influentialCitationCount", {
      headers,
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!res.ok) {
      throw new Error(`Semantic Scholar API error: ${res.status}`);
    }

    const paper = await res.json();
    return this.normalize({
      title: paper.title,
      authors: (paper.authors || []).map(a => a.name).filter(Boolean),
      abstract: paper.abstract || "",
      doi: paper.externalIds?.DOI || "",
      year: paper.year || Number(paper.publicationDate?.slice(0, 4)) || new Date().getFullYear(),
      source: "semantic_scholar",
      url: paper.url || "",
      pdfUrl: paper.openAccessPdf?.url || "",
      citedByCount: paper.citationCount || 0,
      referencesCount: paper.referenceCount || 0,
      influentialCitationCount: paper.influentialCitationCount || 0,
      venue: paper.venue || "",
      semanticScholarId: paper.paperId,
    });
  }

  async getCitations(id, options = {}) {
    const direction = options.direction || "forward";
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    
    const endpoint = direction === "forward" ? "citations" : "references";
    const url = `https://api.semanticscholar.org/graph/v1/paper/${id}/${endpoint}?fields=title,authors,year,citationCount&limit=${limit}&offset=${offset}`;
    
    const headers = { Accept: "application/json" };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;
    
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!res.ok) {
      throw new Error(`Semantic Scholar API error: ${res.status}`);
    }

    const data = await res.json();
    const citations = (data.data || []).map(item => {
      const paper = direction === "forward" ? item.citingPaper : item.citedPaper;
      return this.normalize({
        title: paper.title,
        authors: (paper.authors || []).map(a => a.name),
        year: paper.year,
        citedByCount: paper.citationCount || 0,
        source: "semantic_scholar",
        semanticScholarId: paper.paperId,
      });
    });

    return {
      citations,
      totalCount: data.total || citations.length,
    };
  }

  normalize(rawPaper, sourceRank = 0) {
    return {
      title: rawPaper.title || "",
      authors: rawPaper.authors || [],
      abstract: rawPaper.abstract || "",
      year: rawPaper.year || new Date().getFullYear(),
      doi: rawPaper.doi || "",
      url: rawPaper.url || "",
      pdfUrl: rawPaper.pdfUrl || "",
      source: "semantic_scholar",
      
      externalIds: {
        semanticScholar: rawPaper.semanticScholarId || "",
        doi: rawPaper.doi || "",
      },
      
      venue: rawPaper.venue || "",
      venueType: "unknown",
      citedByCount: rawPaper.citedByCount || 0,
      referencesCount: rawPaper.referencesCount || 0,
      influentialCitationCount: rawPaper.influentialCitationCount || 0,
      
      codeAvailable: false,
      codeUrls: [],
      dataAvailable: !!rawPaper.pdfUrl,
      dataUrls: rawPaper.pdfUrl ? [rawPaper.pdfUrl] : [],
      
      sourceRank,
      searchRelevanceScore: null,
    };
  }

  getMetadata() {
    return {
      name: "semantic_scholar",
      supportsCitations: true,
      supportsFullText: false,
      rateLimit: this.apiKey ? "5,000 requests/5 minutes" : "100 requests/5 minutes",
      requiresAuth: false,
    };
  }
}

// Export singleton instance
export const semanticScholarProvider = new SemanticScholarProvider();

export default { searchSemanticScholar };
