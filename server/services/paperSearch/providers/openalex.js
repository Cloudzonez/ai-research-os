import { BaseProvider } from "../BaseProvider.js";
import { RateLimiter } from "../rateLimiter.js";
import { normalize } from "../normalizer.js";
import { config } from "../../../config.js";
import { getActiveDebugLog } from "../../trackerDebugLog.js";

export class OpenAlexProvider extends BaseProvider {
  constructor(options = {}) {
    const apiKey = options.apiKey || config.openalexApiKey || "";
    const isPremium = Boolean(apiKey);
    super({
      name: "openalex",
      baseUrl: "https://api.openalex.org",
      rateLimiter: options.rateLimiter || new RateLimiter({
        maxTokens: isPremium ? 10 : 1,
        refillRate: isPremium ? 10 : 1,
      }),
      headers: {
        "User-Agent": "mailto:ai-research@university.edu",
        ...(apiKey && !options.useParamAuth ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      cacheTtlMs: options.cacheTtlMs ?? 300000,
      ...options.overrides,
    });
    this.apiKey = apiKey;
    this.useParamAuth = options.useParamAuth ?? true;
  }

  async search(params = {}) {
    const {
      query,
      maxResults = 25,
      page = 1,
      filter = {},
    } = params;

    const searchParams = new URLSearchParams();
    if (query) searchParams.set("search", query);
    searchParams.set("per_page", String(Math.min(Math.max(Number(maxResults) || 25, 1), 200)));
    searchParams.set("page", String(Math.max(1, Number(page) || 1)));
    searchParams.set("sort", params.sort || "cited_by_count:desc");

    if (this.apiKey && this.useParamAuth) {
      searchParams.set("api_key", this.apiKey);
    }

    if (filter.yearMin || filter.yearMax) {
      const from = filter.yearMin || 1900;
      const to = filter.yearMax || new Date().getFullYear() + 1;
      searchParams.set("filter", `publication_year:${from}-${to}`);
    }
    if (filter.type && filter.type !== "all") {
      const existing = searchParams.get("filter") || "";
      searchParams.set("filter", existing ? `${existing},type:${filter.type}` : `type:${filter.type}`);
    }
    if (filter.venue) {
      const existing = searchParams.get("filter") || "";
      searchParams.set("filter", existing ? `${existing},primary_location.source.display_name.search:${filter.venue}` : `primary_location.source.display_name.search:${filter.venue}`);
    }

    const path = `/works?${searchParams.toString()}`;
    const data = await this._fetch(path);
    const results = (data.results || []).map((work) => this._toRawItem(work));
    const normalized = results.map((raw) => normalize("openalex", { ...raw, _raw: raw._raw }));

    const debugLog = getActiveDebugLog();
    if (debugLog) debugLog.detail(`[paperSearch/openalex] search() returned`, { raw: results.length, normalized: normalized.length, total: data.meta?.count || "?", query: query?.slice(0, 60) });

    return normalized;
  }

  async getPaper(id) {
    const openalexId = String(id).replace("https://openalex.org/", "").replace(/^W/, "");
    const path = `/works/W${openalexId}${this.apiKey && this.useParamAuth ? `?api_key=${this.apiKey}` : ""}`;
    try {
      const work = await this._fetch(path);
      const raw = this._toRawItem(work);
      return normalize("openalex", { ...raw, _raw: raw._raw });
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  async getCitations(id) {
    const openalexId = String(id).replace("https://openalex.org/", "").replace(/^W/, "");
    const params = new URLSearchParams({
      filter: `cites:W${openalexId}`,
      per_page: "50",
      sort: "cited_by_count:desc",
    });
    if (this.apiKey && this.useParamAuth) params.set("api_key", this.apiKey);
    const path = `/works?${params.toString()}`;
    const data = await this._fetch(path);
    return (data.results || []).map((work) => {
      const raw = this._toRawItem(work);
      return normalize("openalex", { ...raw, _raw: raw._raw });
    });
  }

  async getReferences(id) {
    const paper = await this.getPaper(id);
    if (!paper || !paper._raw?.referenced_works) return [];
    const ids = (paper._raw.referenced_works || []).slice(0, 50);
    if (!ids.length) return [];
    const filter = ids.map((wid) => String(wid).replace("https://openalex.org/", "")).join("|");
    const params = new URLSearchParams({
      filter: `openalex_id:${filter}`,
      per_page: "50",
    });
    if (this.apiKey && this.useParamAuth) params.set("api_key", this.apiKey);
    const path = `/works?${params.toString()}`;
    const data = await this._fetch(path);
    return (data.results || []).map((work) => {
      const raw = this._toRawItem(work);
      return normalize("openalex", { ...raw, _raw: raw._raw });
    });
  }

  _toRawItem(work) {
    return {
      id: work.id || "",
      title: work.title || "",
      authors: (work.authorships || []).map((a) => a.author?.display_name || ""),
      abstract: work.abstract_inverted_index ? invertAbstract(work.abstract_inverted_index) : (work.abstract || ""),
      doi: work.doi || "",
      publication_year: work.publication_year || null,
      publication_date: work.publication_date || null,
      source: "openalex",
      url: work.doi ? `https://doi.org/${work.doi}` : "",
      pdfUrl: work.best_oa_location?.pdf_url || work.primary_location?.pdf_url || "",
      cited_by_count: work.cited_by_count || 0,
      type: work.type || "",
      best_oa_location: work.best_oa_location || null,
      primary_location: work.primary_location || null,
      topics: work.topics || [],
      referenced_works: work.referenced_works || [],
      _raw: work,
    };
  }
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

export default { OpenAlexProvider };
