import { config } from "../../config.js";
import { SearchProvider } from "../search/SearchProvider.js";

const OPENALEX_EMAIL = config.openAlexEmail || config.openAlexEmail;

export async function searchOpenAlex(query, maxResults = 10, options = {}) {
  const baseUrl = "https://api.openalex.org/works";
  const params = new URLSearchParams({
    search: query,
    per_page: String(Math.min(maxResults, 50)),
    sort: options.sort || "cited_by_count:desc",
    mailto: OPENALEX_EMAIL,
  });

  // Optional filters
  if (options.yearFrom || options.yearTo) {
    const from = options.yearFrom || 1900;
    const to = options.yearTo || new Date().getFullYear();
    params.append("filter", `publication_year:${from}-${to}`);
  }

  if (options.page && options.page > 1) {
    params.append("page", String(options.page));
  }

  const url = `${baseUrl}?${params.toString()}`;
  const res = await fetchWithRetry(url, {
    headers: { "User-Agent": `mailto:${OPENALEX_EMAIL}` },
  }, options);

  if (!res.ok) {
    throw new Error(`OpenAlex API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const totalResults = data.meta?.count || 0;

  return {
    results: (data.results || []).map((work) => ({
      openAlexId: work.id || "",
      title: work.title || "",
      authors: (work.authorships || []).map((a) => a.author?.display_name || "").filter(Boolean),
      abstract: work.abstract_inverted_index
        ? invertAbstract(work.abstract_inverted_index)
        : "",
      doi: work.doi ? work.doi.replace("https://doi.org/", "") : "",
      year: work.publication_year || new Date().getFullYear(),
      source: "openalex",
      url: work.doi ? `https://doi.org/${work.doi.replace("https://doi.org/", "")}` : (work.id || ""),
      pdfUrl: work.best_oa_location?.pdf_url
        || work.primary_location?.pdf_url
        || work.open_access?.oa_url
        || "",
      citedByCount: work.cited_by_count || 0,
      type: work.type || "",
      journal: work.primary_location?.source?.display_name || "",
      isOpenAccess: work.open_access?.is_oa || false,
    })),
    totalResults,
    page: options.page || 1,
    perPage: maxResults,
  };
}

// Legacy compat: return just the array
export async function searchOpenAlexSimple(query, maxResults = 10, options = {}) {
  const { results } = await searchOpenAlex(query, maxResults, options);
  return results;
}

function invertAbstract(invertedIndex) {
  if (!invertedIndex) return "";
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.join(" ");
}

async function fetchWithRetry(url, init, options = {}) {
  const maxRetries = options.retries ?? 3;
  const baseDelay = options.retryDelay || 3000;
  const timeoutMs = options.timeoutMs || 15000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status !== 429 && res.status !== 503) return res;
    if (attempt === maxRetries) return res;
    const delay = baseDelay * Math.pow(2, attempt);
    console.warn(`OpenAlex: ${res.status} on attempt ${attempt + 1}, retrying in ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

/**
 * OpenAlex search provider implementing SearchProvider interface
 */
export class OpenAlexProvider extends SearchProvider {
  constructor(config = {}) {
    super(config);
    this.name = "openalex";
    this.email = config.email || OPENALEX_EMAIL;
  }

  async search(query) {
    const { results } = await searchOpenAlex(
      query.searchQuery,
      query.maxResults || 20,
      {
        yearFrom: query.filters?.yearFrom,
        yearTo: query.filters?.yearTo,
        sort: this._mapSortBy(query.sortBy),
        timeoutMs: this.timeout,
      }
    );
    
    return results.map((paper, index) => this.normalize(paper, index));
  }

  async getPaper(id) {
    // OpenAlex ID format: https://openalex.org/W...
    const url = id.startsWith("http") ? id : `https://api.openalex.org/works/${id}`;
    
    const res = await fetch(url, {
      headers: { "User-Agent": `mailto:${this.email}` },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!res.ok) {
      throw new Error(`OpenAlex API error: ${res.status}`);
    }

    const work = await res.json();
    return this.normalize({
      openAlexId: work.id,
      title: work.title,
      authors: (work.authorships || []).map(a => a.author?.display_name).filter(Boolean),
      abstract: work.abstract_inverted_index ? invertAbstract(work.abstract_inverted_index) : "",
      doi: work.doi ? work.doi.replace("https://doi.org/", "") : "",
      year: work.publication_year,
      source: "openalex",
      url: work.doi || work.id,
      pdfUrl: work.best_oa_location?.pdf_url || work.primary_location?.pdf_url || "",
      citedByCount: work.cited_by_count || 0,
      journal: work.primary_location?.source?.display_name || "",
    });
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
      source: "openalex",
      
      externalIds: {
        openAlex: rawPaper.openAlexId || "",
        doi: rawPaper.doi || "",
      },
      
      venue: rawPaper.journal || "",
      venueType: this._inferVenueType(rawPaper.type),
      citedByCount: rawPaper.citedByCount || 0,
      
      codeAvailable: false, // OpenAlex doesn't provide this
      codeUrls: [],
      dataAvailable: rawPaper.isOpenAccess || false,
      dataUrls: rawPaper.pdfUrl ? [rawPaper.pdfUrl] : [],
      
      sourceRank,
      searchRelevanceScore: null, // Will be set by federation manager
    };
  }

  getMetadata() {
    return {
      name: "openalex",
      supportsCitations: true,
      supportsFullText: false,
      rateLimit: "100,000 requests/day (polite pool with email)",
      requiresAuth: false,
    };
  }

  _mapSortBy(sortBy) {
    const mapping = {
      relevance: "relevance_score:desc",
      citations: "cited_by_count:desc",
      date: "publication_date:desc",
    };
    return mapping[sortBy] || "cited_by_count:desc";
  }

  _inferVenueType(type) {
    if (!type) return "unknown";
    const lowerType = type.toLowerCase();
    if (lowerType.includes("journal")) return "journal";
    if (lowerType.includes("conference") || lowerType.includes("proceedings")) return "conference";
    if (lowerType.includes("preprint")) return "preprint";
    if (lowerType.includes("book")) return "book";
    return "unknown";
  }
}

// Export singleton instance for backward compatibility
export const openAlexProvider = new OpenAlexProvider();

export default { searchOpenAlex, searchOpenAlexSimple };
