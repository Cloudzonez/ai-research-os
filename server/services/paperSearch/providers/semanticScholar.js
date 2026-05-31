import { BaseProvider } from "../BaseProvider.js";
import { RateLimiter } from "../rateLimiter.js";
import { normalize } from "../normalizer.js";
import { config } from "../../../config.js";
import { getActiveDebugLog } from "../../trackerDebugLog.js";

const PAPER_FIELDS = [
  "title", "authors", "abstract", "year", "externalIds",
  "url", "openAccessPdf", "citationCount", "venue",
  "publicationDate", "publicationTypes", "journal",
  "referenceCount", "citationCount", "fieldsOfStudy",
].join(",");

export class SemanticScholarProvider extends BaseProvider {
  constructor(options = {}) {
    const apiKey = options.apiKey || config.semanticScholarApiKey || "";
    const hasKey = Boolean(apiKey);
    super({
      name: "semantic_scholar",
      baseUrl: "https://api.semanticscholar.org/graph/v1",
      rateLimiter: options.rateLimiter || new RateLimiter({
        maxTokens: hasKey ? 10 : 1,
        refillRate: hasKey ? 10 : 1,
      }),
      headers: {
        Accept: "application/json",
        ...(hasKey ? { "x-api-key": apiKey } : {}),
      },
      cacheTtlMs: options.cacheTtlMs ?? 300000,
      ...options.overrides,
    });
    this.apiKey = apiKey;
    this.fields = options.fields || PAPER_FIELDS;
  }

  async search(params = {}) {
    const {
      query,
      maxResults = 25,
      offset = 0,
      filter = {},
    } = params;

    const limit = Math.min(Math.max(Number(maxResults) || 25, 1), 100);
    const searchParams = new URLSearchParams({
      query: query || "",
      limit: String(limit),
      offset: String(Math.max(0, Number(offset) || 0)),
      fields: this.fields,
    });

    if (filter.yearMin || filter.yearMax) {
      const from = filter.yearMin || 1900;
      const to = filter.yearMax || new Date().getFullYear() + 1;
      searchParams.set("year", `${from}-${to}`);
    }
    if (filter.venue) {
      searchParams.set("venue", String(filter.venue));
    }
    if (filter.fieldsOfStudy && Array.isArray(filter.fieldsOfStudy)) {
      for (const fos of filter.fieldsOfStudy) {
        searchParams.append("fieldsOfStudy", fos);
      }
    }

    const path = `/paper/search?${searchParams.toString()}`;
    const data = await this._fetch(path);
    const results = data.data || [];
    const normalized = results.map((paper) => {
      const raw = this._toRawItem(paper);
      return normalize("semantic_scholar", { ...raw, _raw: raw._raw });
    });

    const debugLog = getActiveDebugLog();
    if (debugLog) debugLog.detail(`[paperSearch/semanticScholar] search() returned`, { raw: results.length, normalized: normalized.length, total: data.total || "?", query: query?.slice(0, 60) });

    return normalized;
  }

  async getPaper(id) {
    let lookupId = String(id);
    if (lookupId.startsWith("10.")) {
      lookupId = `DOI:${lookupId}`;
    } else if (/^\d{4}\.\d{4,5}/.test(lookupId)) {
      lookupId = `ArXiv:${lookupId}`;
    }
    const path = `/paper/${encodeURIComponent(lookupId)}?fields=${this.fields}`;
    try {
      const paper = await this._fetch(path);
      if (!paper || paper.error) return null;
      const raw = this._toRawItem(paper);
      return normalize("semantic_scholar", { ...raw, _raw: raw._raw });
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  async getCitations(id) {
    let paperId = String(id);
    if (paperId.startsWith("10.")) paperId = `DOI:${paperId}`;
    else if (/^\d{4}\.\d{4,5}/.test(paperId)) paperId = `ArXiv:${paperId}`;

    const path = `/paper/${encodeURIComponent(paperId)}/citations?limit=50&fields=${this.fields}`;
    try {
      const data = await this._fetch(path);
      const results = (data.data || []).map((entry) => {
        const raw = this._toRawItem(entry.citingPaper || entry);
        return normalize("semantic_scholar", { ...raw, _raw: raw._raw });
      });
      return results;
    } catch {
      return [];
    }
  }

  async getReferences(id) {
    let paperId = String(id);
    if (paperId.startsWith("10.")) paperId = `DOI:${paperId}`;
    else if (/^\d{4}\.\d{4,5}/.test(paperId)) paperId = `ArXiv:${paperId}`;

    const path = `/paper/${encodeURIComponent(paperId)}/references?limit=50&fields=${this.fields}`;
    try {
      const data = await this._fetch(path);
      const results = (data.data || []).map((entry) => {
        const raw = this._toRawItem(entry.citedPaper || entry);
        return normalize("semantic_scholar", { ...raw, _raw: raw._raw });
      });
      return results;
    } catch {
      return [];
    }
  }

  _toRawItem(paper) {
    return {
      paperId: paper.paperId || "",
      title: paper.title || "",
      authors: (paper.authors || []).map((a) => ({ name: a.name || "", authorId: a.authorId || "" })),
      abstract: paper.abstract || "",
      externalIds: paper.externalIds || {},
      year: paper.year || null,
      publicationDate: paper.publicationDate || null,
      url: paper.url || "",
      openAccessPdf: paper.openAccessPdf || null,
      citationCount: paper.citationCount || 0,
      referenceCount: paper.referenceCount || 0,
      venue: paper.venue || "",
      publicationTypes: paper.publicationTypes || [],
      journal: paper.journal || null,
      fieldsOfStudy: paper.fieldsOfStudy || [],
      _raw: paper,
    };
  }
}

export default { SemanticScholarProvider };
