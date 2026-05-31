import { BaseProvider } from "../BaseProvider.js";
import { RateLimiter } from "../rateLimiter.js";
import { normalize } from "../normalizer.js";
import { config } from "../../../config.js";

export class CrossrefProvider extends BaseProvider {
  constructor(options = {}) {
    const email = options.email || config.crossrefEmail || "ai-research@university.edu";
    super({
      name: "crossref",
      baseUrl: "https://api.crossref.org",
      rateLimiter: options.rateLimiter || new RateLimiter({
        maxTokens: 50,
        refillRate: 50,
      }),
      headers: {
        "User-Agent": `AI-Research-OS/0.1 (mailto:${email})`,
      },
      cacheTtlMs: options.cacheTtlMs ?? 600000,
      ...options.overrides,
    });
    this.email = email;
  }

  async search(params = {}) {
    const {
      query,
      maxResults = 25,
      offset = 0,
      filter = {},
    } = params;

    const capped = Math.min(Math.max(Number(maxResults) || 25, 1), 1000);
    const searchParams = new URLSearchParams();
    if (query) searchParams.set("query", query);
    searchParams.set("rows", String(capped));
    searchParams.set("offset", String(Math.max(0, Number(offset) || 0)));

    const filters = [];
    if (filter.type && filter.type !== "all") {
      filters.push(`type:${filter.type}`);
    }
    if (filter.yearMin) {
      filters.push(`from-pub-date:${filter.yearMin}-01-01`);
    }
    if (filter.yearMax) {
      filters.push(`until-pub-date:${filter.yearMax}-12-31`);
    }
    if (filters.length) {
      searchParams.set("filter", filters.join(","));
    }

    const path = `/works?${searchParams.toString()}`;
    const data = await this._fetch(path);
    const items = data.message?.items || [];
    return items.map((item) => {
      const raw = this._toRawItem(item);
      return normalize("crossref", { ...raw, _raw: raw._raw });
    });
  }

  async getPaper(id) {
    const doi = encodeURIComponent(String(id).replace(/^https?:\/\/doi\.org\//i, "").trim());
    const path = `/works/${doi}`;
    try {
      const data = await this._fetch(path);
      const item = data.message;
      if (!item) return null;
      const raw = this._toRawItem(item);
      return normalize("crossref", { ...raw, _raw: raw._raw });
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  async getCitations(id) {
    const doi = encodeURIComponent(String(id).replace(/^https?:\/\/doi\.org\//i, "").trim());
    const path = `/works?filter=cites:${doi}&rows=50`;
    try {
      const data = await this._fetch(path);
      const items = data.message?.items || [];
      return items.map((item) => {
        const raw = this._toRawItem(item);
        return normalize("crossref", { ...raw, _raw: raw._raw });
      });
    } catch {
      return [];
    }
  }

  _toRawItem(item) {
    const dateParts = item["published-print"]?.["date-parts"]?.[0]
      || item["created"]?.["date-parts"]?.[0]
      || [];

    return {
      DOI: item.DOI || "",
      title: item.title || [],
      author: item.author || [],
      abstract: item.abstract || "",
      type: item.type || "",
      "published-print": item["published-print"] || null,
      "created": item.created || null,
      "published-date": dateParts.length
        ? `${dateParts[0]}-${String(dateParts[1] || 1).padStart(2, "0")}-${String(dateParts[2] || 1).padStart(2, "0")}`
        : null,
      year: dateParts[0] || null,
      "container-title": item["container-title"] || [],
      "is-referenced-by-count": item["is-referenced-by-count"] || 0,
      subject: item.subject || [],
      url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : ""),
      _raw: item,
    };
  }
}

export default { CrossrefProvider };
