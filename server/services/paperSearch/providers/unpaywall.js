import { BaseProvider } from "../BaseProvider.js";
import { RateLimiter } from "../rateLimiter.js";
import { normalize } from "../normalizer.js";
import { config } from "../../../config.js";

export class UnpaywallProvider extends BaseProvider {
  constructor(options = {}) {
    const email = options.email || config.unpaywallEmail || "ai-research@university.edu";
    super({
      name: "unpaywall",
      baseUrl: "https://api.unpaywall.org/v2",
      rateLimiter: options.rateLimiter || new RateLimiter({
        maxTokens: 2,
        refillRate: 1.16,
      }),
      headers: {
        "User-Agent": `AI-Research-OS/0.1 (mailto:${email})`,
      },
      cacheTtlMs: options.cacheTtlMs ?? 3600000,
      ...options.overrides,
    });
    this.email = email;
  }

  async search(_params) {
    throw new Error("Unpaywall does not support search. Use getPaper(doi) to check OA status.");
  }

  async getPaper(id) {
    const doi = encodeURIComponent(String(id).replace(/^https?:\/\/doi\.org\//i, "").trim());
    const path = `/${doi}?email=${encodeURIComponent(this.email)}`;

    try {
      const data = await this._fetch(path);
      if (!data || data.error) return null;

      const bestOa = data.best_oa_location || {};
      const oaLocations = data.oa_locations || [];

      const raw = {
        doi: data.doi || "",
        title: data.title || "",
        year: data.year || null,
        published_date: data.published_date || null,
        is_oa: data.is_oa || false,
        oa_status: data.oa_status || "closed",
        journal_name: data.journal_name || "",
        best_oa_location: bestOa,
        oa_locations: oaLocations,
        _raw: data,
      };

      return normalize("unpaywall", raw);
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  async getCitations(_id) {
    return [];
  }

  async getReferences(_id) {
    return [];
  }
}

export default { UnpaywallProvider };
