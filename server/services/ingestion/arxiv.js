import { SearchProvider } from "../search/SearchProvider.js";

export async function searchArxiv(query, maxResults = 10, options = {}) {
  const baseUrl = "http://export.arxiv.org/api/query";
  const params = new URLSearchParams({
    search_query: `all:${query}`,
    start: 0,
    max_results: maxResults,
    sortBy: "submittedDate",
    sortOrder: "descending",
  });

  const url = `${baseUrl}?${params.toString()}`;
  const res = await fetchWithRetry(url, {
    headers: { Accept: "application/atom+xml" },
  }, options);

  if (!res.ok) {
    throw new Error(`arXiv API error: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();

  // Simple regex-based Atom XML parsing (avoids xml2js dependency)
  const entries = xml.split(/<entry>/).slice(1);
  return entries.map((entry) => {
    const getTag = (tag) => {
      const match = entry.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
      return match ? match[1].trim() : "";
    };
    const getAuthors = () => {
      const matches = entry.match(/<name>([^<]*)<\/name>/g);
      return matches ? matches.map((m) => m.replace(/<\/?name>/g, "").trim()) : [];
    };
    const id = getTag("id");

    return {
      title: getTag("title"),
      authors: getAuthors(),
      abstract: getTag("summary"),
      doi: getTag("arxiv:doi") || `arxiv:${id}`,
      year: parseInt(getTag("published")?.slice(0, 4)) || new Date().getFullYear(),
      source: "arxiv",
      url: id,
      pdfUrl: id ? id.replace("/abs/", "/pdf/") : "",
      published: getTag("published"),
    };
  });
}

async function fetchWithRetry(url, init, options = {}) {
  const maxRetries = options.retries ?? 3;
  const baseDelay = options.retryDelay || 2000;
  const timeoutMs = options.timeoutMs || 15000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status !== 429 && res.status !== 503) return res;
    if (attempt === maxRetries) return res;
  }
}

/**
 * arXiv search provider implementing SearchProvider interface
 */
export class ArxivProvider extends SearchProvider {
  constructor(config = {}) {
    super(config);
    this.name = "arxiv";
  }

  async search(query) {
    const results = await searchArxiv(
      query.searchQuery,
      query.maxResults || 20,
      {
        timeoutMs: this.timeout,
      }
    );
    
    return results.map((paper, index) => this.normalize(paper, index));
  }

  async getPaper(id) {
    // arXiv ID format: http://arxiv.org/abs/2301.12345
    const arxivId = id.includes("arxiv.org") ? id.split("/").pop() : id;
    const url = `http://export.arxiv.org/api/query?id_list=${arxivId}`;
    
    const res = await fetch(url, {
      headers: { Accept: "application/atom+xml" },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!res.ok) {
      throw new Error(`arXiv API error: ${res.status}`);
    }

    const xml = await res.text();
    const entries = xml.split(/<entry>/).slice(1);
    
    if (entries.length === 0) {
      throw new Error("Paper not found");
    }

    const entry = entries[0];
    const getTag = (tag) => {
      const match = entry.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
      return match ? match[1].trim() : "";
    };
    const getAuthors = () => {
      const matches = entry.match(/<name>([^<]*)<\/name>/g);
      return matches ? matches.map((m) => m.replace(/<\/?name>/g, "").trim()) : [];
    };
    const entryId = getTag("id");

    return this.normalize({
      title: getTag("title"),
      authors: getAuthors(),
      abstract: getTag("summary"),
      doi: getTag("arxiv:doi") || `arxiv:${entryId}`,
      year: parseInt(getTag("published")?.slice(0, 4)) || new Date().getFullYear(),
      source: "arxiv",
      url: entryId,
      pdfUrl: entryId ? entryId.replace("/abs/", "/pdf/") : "",
      published: getTag("published"),
    });
  }

  normalize(rawPaper, sourceRank = 0) {
    const arxivId = rawPaper.url?.split("/").pop() || "";
    
    return {
      title: rawPaper.title || "",
      authors: rawPaper.authors || [],
      abstract: rawPaper.abstract || "",
      year: rawPaper.year || new Date().getFullYear(),
      doi: rawPaper.doi || "",
      url: rawPaper.url || "",
      pdfUrl: rawPaper.pdfUrl || "",
      source: "arxiv",
      
      externalIds: {
        arxiv: arxivId,
        doi: rawPaper.doi?.startsWith("arxiv:") ? "" : rawPaper.doi,
      },
      
      venue: "arXiv",
      venueType: "preprint",
      citedByCount: 0, // arXiv doesn't provide citation counts
      
      codeAvailable: false,
      codeUrls: [],
      dataAvailable: true, // All arXiv papers are open access
      dataUrls: rawPaper.pdfUrl ? [rawPaper.pdfUrl] : [],
      
      sourceRank,
      searchRelevanceScore: null,
    };
  }

  getMetadata() {
    return {
      name: "arxiv",
      supportsCitations: false,
      supportsFullText: true,
      rateLimit: "3 requests/second (recommended)",
      requiresAuth: false,
    };
  }
}

// Export singleton instance
export const arxivProvider = new ArxivProvider();
