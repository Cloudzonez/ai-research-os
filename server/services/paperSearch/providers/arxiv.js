import { BaseProvider } from "../BaseProvider.js";
import { RateLimiter } from "../rateLimiter.js";
import { normalize } from "../normalizer.js";
import { getActiveDebugLog } from "../../trackerDebugLog.js";

export class ArxivProvider extends BaseProvider {
  constructor(options = {}) {
    super({
      name: "arxiv",
      baseUrl: "http://export.arxiv.org/api",
      rateLimiter: options.rateLimiter || new RateLimiter({
        maxTokens: 1,
        refillRate: 1 / 3,
        refillInterval: 3000,
      }),
      headers: {
        "User-Agent": "AI-Research-Bot/1.0 (mailto:admin@example.com)",
      },
      cacheTtlMs: options.cacheTtlMs ?? 600000,
      ...options.overrides,
    });
  }

  async search(params = {}) {
    const {
      query,
      maxResults = 25,
      filter = {},
    } = params;

    const capped = Math.min(Math.max(Number(maxResults) || 25, 1), 100);
    const searchParams = new URLSearchParams({
      search_query: buildArxivQuery(query, filter),
      start: "0",
      max_results: String(capped),
      sortBy: filter.sortBy || "relevance",
      sortOrder: filter.sortOrder || "descending",
    });

    const path = `/query?${searchParams.toString()}`;
    const text = await this._fetchText(path);
    const papers = parseArxivAtom(text);
    const normalized = papers.map((raw) => normalize("arxiv", { ...raw, _raw: raw._raw }));

    const debugLog = getActiveDebugLog();
    if (debugLog) debugLog.detail(`[paperSearch/arxiv] search() returned`, { parsed: papers.length, normalized: normalized.length, query: query?.slice(0, 60) });

    return normalized;
  }

  async getPaper(id) {
    const arxivId = String(id).replace(/^arxiv:/i, "").replace(/v\d+$/, "").trim();
    const path = `/query?id_list=${encodeURIComponent(arxivId)}&max_results=1`;
    try {
      const text = await this._fetchText(path);
      const papers = parseArxivAtom(text);
      if (!papers.length) return null;
      const raw = papers[0];
      return normalize("arxiv", { ...raw, _raw: raw._raw });
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }
}

function buildArxivQuery(query, filter = {}) {
  const parts = [];
  if (query) parts.push(`all:${escapeArxivQuery(query)}`);
  if (filter.categories && filter.categories.length) {
    const catQuery = filter.categories.map((c) => `cat:${c}`).join("+OR+");
    parts.push(`(${catQuery})`);
  }
  return parts.join("+AND+") || "all:*";
}

function escapeArxivQuery(str) {
  return str.replace(/[()]/g, "").replace(/\s+/g, "+AND+");
}

function parseArxivAtom(xml) {
  const papers = [];
  const entries = xml.split("<entry>").slice(1);

  for (const entryStr of entries) {
    const entryContent = entryStr.split("</entry>")[0];
    if (!entryContent) continue;

    try {
      const paper = {
        id: extractTag(entryContent, "id").replace("http://arxiv.org/abs/", "").trim(),
        title: stripHtml(extractTag(entryContent, "title")),
        authors: extractAuthors(entryContent),
        abstract: stripHtml(extractTag(entryContent, "summary")),
        doi: extractArxivDoi(entryContent),
        year: extractYear(entryContent),
        published: extractTag(entryContent, "published"),
        updated: extractTag(entryContent, "updated"),
        categories: extractCategories(entryContent),
        journalRef: extractTag(entryContent, "arxiv:journal_ref"),
        comment: extractTag(entryContent, "arxiv:comment"),
        source: "arxiv",
      };
      if (paper.id) papers.push(paper);
    } catch {
      // Skip malformed entries
    }
  }

  return papers;
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function extractAuthors(xml) {
  const authors = [];
  const authorRegex = /<author>([\s\S]*?)<\/author>/gi;
  let match;
  while ((match = authorRegex.exec(xml)) !== null) {
    const name = extractTag(match[1], "name");
    if (name) authors.push(name);
  }
  return authors;
}

function extractArxivDoi(xml) {
  const all = xml.match(/<arxiv:doi>([\s\S]*?)<\/arxiv:doi>/gi) || [];
  for (const entry of all) {
    const doi = entry.replace(/<\/?arxiv:doi>/gi, "").trim();
    if (doi.startsWith("10.")) return doi;
  }
  return "";
}

function extractYear(xml) {
  const published = extractTag(xml, "published");
  if (published) {
    const m = published.match(/(\d{4})/);
    if (m) return Number(m[1]);
  }
  return null;
}

function extractCategories(xml) {
  const cats = [];
  const catRegex = /<category[^>]*term="([^"]*)"/gi;
  let match;
  while ((match = catRegex.exec(xml)) !== null) {
    cats.push(match[1]);
  }
  return cats;
}

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export default { ArxivProvider };
