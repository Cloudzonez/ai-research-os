import { OpenAlexProvider } from "./providers/openalex.js";
import { CrossrefProvider } from "./providers/crossref.js";
import { SemanticScholarProvider } from "./providers/semanticScholar.js";
import { ArxivProvider } from "./providers/arxiv.js";
import { PubMedProvider } from "./providers/pubmed.js";
import { UnpaywallProvider } from "./providers/unpaywall.js";
import { PaperDeduplicator, deduplicateBatch } from "./deduplicator.js";
import { rankPapers } from "./ranking.js";
import cache from "../cache.js";

const PROVIDER_REGISTRY = {
  openalex: OpenAlexProvider,
  crossref: CrossrefProvider,
  semantic_scholar: SemanticScholarProvider,
  arxiv: ArxivProvider,
  pubmed: PubMedProvider,
  unpaywall: UnpaywallProvider,
};

const PROVIDER_ALIASES = {
  "open alex": "openalex",
  open_alex: "openalex",
  crossref: "crossref",
  cross_ref: "crossref",
  "semantic scholar": "semantic_scholar",
  semantic_scholar: "semantic_scholar",
  s2: "semantic_scholar",
  arxiv: "arxiv",
  "arxiv.org": "arxiv",
  arXiv: "arxiv",
  pubmed: "pubmed",
  "pub med": "pubmed",
  ncbi: "pubmed",
  unpaywall: "unpaywall",
  "open access": "unpaywall",
  oa: "unpaywall",
};

const DEFAULT_PROVIDERS = ["openalex", "crossref", "semantic_scholar", "arxiv"];

export class UnifiedPaperSearch {
  constructor(options = {}) {
    this.providers = options.providers || this._buildDefaultProviders(options);
    this.deduplicator = options.deduplicator || new PaperDeduplicator({
      paperStore: options.paperStore || null,
      strictMode: options.strictDedup ?? false,
    });
    this.cache = options.cache || cache;
    this.defaultProviders = options.defaultProviders || DEFAULT_PROVIDERS;
    this.paperStore = options.paperStore || null;
    this.providerOptions = options.providerOptions || {};
  }

  _buildDefaultProviders(options) {
    const providers = {};
    const providerOpts = options.providerOptions || {};
    for (const [name, Cls] of Object.entries(PROVIDER_REGISTRY)) {
      try {
        providers[name] = new Cls(providerOpts[name] || {});
      } catch {
        // Provider unavailable — will be skipped at search time
      }
    }
    return providers;
  }

  async search(params = {}) {
    const startTime = Date.now();
    const {
      query,
      maxResults = 25,
      providers: requestedProviders,
      filters = {},
      deduplicate = true,
      enrich = false,
      timeoutPerProvider = 15000,
    } = params;

    const providerNames = this._resolveProviders(requestedProviders);
    const perProviderCap = Math.max(5, Math.ceil(maxResults / providerNames.length));

    const providerResults = [];
    const allPapers = [];
    const errors = [];

    const tasks = providerNames.map(async (name) => {
      const provider = this.providers[name];
      if (!provider) {
        errors.push({ provider: name, error: "Provider unavailable" });
        return;
      }

      try {
        const results = await Promise.race([
          provider.search({ query, maxResults: perProviderCap, filters }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${timeoutPerProvider}ms`)), timeoutPerProvider)
          ),
        ]);
        providerResults.push({ provider: name, count: results.length, errors: [] });
        for (const paper of results) allPapers.push(paper);
      } catch (err) {
        providerResults.push({ provider: name, count: 0, errors: [err.message] });
        errors.push({ provider: name, error: err.message });
      }
    });

    await Promise.allSettled(tasks);

    let deduplicated = [];
    let duplicateCount = 0;

    if (deduplicate && allPapers.length > 0) {
      const batchResult = deduplicateBatch(allPapers);
      deduplicated = batchResult.unique;
      duplicateCount = batchResult.duplicates.length;

      if (this.paperStore) {
        const dbResult = await this.deduplicator.deduplicate(deduplicated);
        deduplicated = dbResult.unique;
        duplicateCount += dbResult.duplicates.length;
      }
    } else {
      deduplicated = allPapers;
    }

    if (enrich) {
      deduplicated = await this._enrichWithOA(deduplicated);
    }

    const ranked = rankPapers(deduplicated, {
      keywords: query ? query.toLowerCase().split(/\s+/).filter((w) => w.length > 2) : [],
    });

    const sanitized = ranked.map((paper) => {
      const { _raw, ...clean } = paper;
      return clean;
    });

    return {
      results: sanitized,
      providerResults,
      totalFetched: allPapers.length,
      totalAfterDedup: sanitized.length,
      duplicatesRemoved: duplicateCount,
      errors,
      timingMs: Date.now() - startTime,
    };
  }

  async getPaper(id, options = {}) {
    const idType = this._detectIdType(id);

    const tryOrder = [];
    switch (idType) {
      case "doi":
        tryOrder.push("crossref", "openalex", "semantic_scholar");
        break;
      case "arxiv":
        tryOrder.push("arxiv", "semantic_scholar");
        break;
      case "pubmed":
        tryOrder.push("pubmed");
        break;
      case "openalex":
        tryOrder.push("openalex");
        break;
      case "semantic_scholar":
        tryOrder.push("semantic_scholar");
        break;
      default:
        tryOrder.push("crossref", "openalex", "semantic_scholar", "arxiv", "pubmed");
    }

    for (const name of tryOrder) {
      const provider = this.providers[name];
      if (!provider) continue;
      try {
        const paper = await provider.getPaper(id);
        if (paper) return paper;
      } catch {
        continue;
      }
    }

    return null;
  }

  async getCitations(id, options = {}) {
    const allCitations = [];
    const idType = this._detectIdType(id);

    const tryOrder = [];
    if (idType === "pubmed") tryOrder.push("pubmed");
    tryOrder.push("semantic_scholar", "openalex", "crossref");

    for (const name of tryOrder) {
      const provider = this.providers[name];
      if (!provider || !provider.getCitations) continue;
      try {
        const citations = await provider.getCitations(id);
        if (citations.length) allCitations.push(...citations);
      } catch {
        continue;
      }
    }

    const batchResult = deduplicateBatch(allCitations);
    return batchResult.unique;
  }

  async getReferences(id, options = {}) {
    const allRefs = [];
    const idType = this._detectIdType(id);

    const tryOrder = [];
    if (idType === "pubmed") tryOrder.push("pubmed");
    tryOrder.push("semantic_scholar", "openalex");

    for (const name of tryOrder) {
      const provider = this.providers[name];
      if (!provider || !provider.getReferences) continue;
      try {
        const refs = await provider.getReferences(id);
        if (refs.length) allRefs.push(...refs);
      } catch {
        continue;
      }
    }

    const batchResult = deduplicateBatch(allRefs);
    return batchResult.unique;
  }

  async _enrichWithOA(papers) {
    const unpaywall = this.providers.unpaywall;
    if (!unpaywall) return papers;

    return Promise.all(
      papers.map(async (paper) => {
        if (paper.pdfUrl && !paper.isOpenAccess) return paper;
        if (!paper.doi) return paper;
        try {
          const enriched = await unpaywall.getPaper(paper.doi);
          if (enriched && enriched.pdfUrl) {
            return { ...enriched, ...paper, pdfUrl: enriched.pdfUrl || paper.pdfUrl, isOpenAccess: enriched.isOpenAccess };
          }
        } catch {
          // Enrichment failure is non-fatal
        }
        return paper;
      })
    );
  }

  _resolveProviders(requested) {
    if (!requested || !requested.length) return this.defaultProviders;

    const resolved = [];
    for (const name of requested) {
      const normalized = PROVIDER_ALIASES[String(name).toLowerCase().trim()] || String(name).toLowerCase().trim();
      if (PROVIDER_REGISTRY[normalized]) {
        resolved.push(normalized);
      }
    }

    return resolved.length ? [...new Set(resolved)] : this.defaultProviders;
  }

  _detectIdType(id) {
    const str = String(id).trim();
    if (/^10\.\d{4,}/.test(str)) return "doi";
    if (/^\d{4}\.\d{4,5}/.test(str)) return "arxiv";
    if (/^\d{7,8}$/.test(str)) return "pubmed";
    if (/^W\d{8,}$/i.test(str)) return "openalex";
    if (/^[a-f0-9]{40}$/i.test(str)) return "semantic_scholar";
    if (/^PMC\d+$/i.test(str)) return "pubmed";
    return "unknown";
  }

  destroy() {
    for (const provider of Object.values(this.providers)) {
      if (provider && typeof provider.destroy === "function") {
        provider.destroy();
      }
    }
  }
}

let _instance = null;

export function getSearchService(options = {}) {
  if (!_instance) {
    _instance = new UnifiedPaperSearch(options);
  }
  return _instance;
}

export function resetSearchService() {
  if (_instance && typeof _instance.destroy === "function") {
    _instance.destroy();
  }
  _instance = null;
}

export { PROVIDER_REGISTRY, PROVIDER_ALIASES, DEFAULT_PROVIDERS };
export default { UnifiedPaperSearch, getSearchService, resetSearchService };
