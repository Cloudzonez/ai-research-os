import { BaseProvider } from "../BaseProvider.js";
import { RateLimiter } from "../rateLimiter.js";
import { normalize } from "../normalizer.js";
import { config } from "../../../config.js";

export class PubMedProvider extends BaseProvider {
  constructor(options = {}) {
    const apiKey = options.apiKey || config.pubmedApiKey || "";
    const hasKey = Boolean(apiKey);
    super({
      name: "pubmed",
      baseUrl: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
      rateLimiter: options.rateLimiter || new RateLimiter({
        maxTokens: hasKey ? 10 : 3,
        refillRate: hasKey ? 10 : 3,
      }),
      headers: {
        "User-Agent": "AI-Research-OS/0.1 (mailto:ai-research@university.edu)",
      },
      cacheTtlMs: options.cacheTtlMs ?? 600000,
      ...options.overrides,
    });
    this.apiKey = apiKey;
  }

  async search(params = {}) {
    const {
      query,
      maxResults = 25,
      filter = {},
    } = params;

    const capped = Math.min(Math.max(Number(maxResults) || 25, 1), 100);

    const esearchParams = new URLSearchParams({
      db: "pubmed",
      term: buildPubMedQuery(query, filter),
      retmax: String(capped),
      retmode: "json",
      sort: filter.sortBy === "recency" ? "pub+date" : "relevance",
    });
    if (this.apiKey) esearchParams.set("api_key", this.apiKey);

    const searchPath = `/esearch.fcgi?${esearchParams.toString()}`;
    const searchData = await this._fetch(searchPath);
    const ids = searchData?.esearchresult?.idlist || [];

    if (!ids.length) return [];

    const papers = await this._fetchDetails(ids);
    return papers.map((raw) => normalize("pubmed", { ...raw, _raw: raw._raw }));
  }

  async getPaper(id) {
    const pmid = String(id).trim();
    const papers = await this._fetchDetails([pmid]);
    if (!papers.length) return null;
    const raw = papers[0];
    return normalize("pubmed", { ...raw, _raw: raw._raw });
  }

  async getCitations(id) {
    const pmid = String(id).trim();
    const elinkParams = new URLSearchParams({
      dbfrom: "pubmed",
      db: "pubmed",
      linkname: "pubmed_pubmed_citedin",
      id: pmid,
      retmode: "json",
    });
    if (this.apiKey) elinkParams.set("api_key", this.apiKey);

    try {
      const elinkPath = `/elink.fcgi?${elinkParams.toString()}`;
      const elinkData = await this._fetch(elinkPath);
      const linksets = elinkData?.linksets || [];
      const citingIds = [];
      for (const ls of linksets) {
        for (const link of ls.linksetdbs || []) {
          if (link.links) citingIds.push(...link.links);
        }
      }

      if (!citingIds.length) return [];
      return this._fetchDetails(citingIds.slice(0, 50));
    } catch {
      return [];
    }
  }

  async getReferences(id) {
    const pmid = String(id).trim();
    const elinkParams = new URLSearchParams({
      dbfrom: "pubmed",
      db: "pubmed",
      linkname: "pubmed_pubmed_refs",
      id: pmid,
      retmode: "json",
    });
    if (this.apiKey) elinkParams.set("api_key", this.apiKey);

    try {
      const elinkPath = `/elink.fcgi?${elinkParams.toString()}`;
      const elinkData = await this._fetch(elinkPath);
      const linksets = elinkData?.linksets || [];
      const refIds = [];
      for (const ls of linksets) {
        for (const link of ls.linksetdbs || []) {
          if (link.links) refIds.push(...link.links);
        }
      }

      if (!refIds.length) return [];
      const papers = await this._fetchDetails(refIds.slice(0, 50));
      return papers.map((raw) => normalize("pubmed", { ...raw, _raw: raw._raw }));
    } catch {
      return [];
    }
  }

  async _fetchDetails(ids) {
    const efetchParams = new URLSearchParams({
      db: "pubmed",
      id: ids.join(","),
      retmode: "xml",
    });
    if (this.apiKey) efetchParams.set("api_key", this.apiKey);

    const efetchPath = `/efetch.fcgi?${efetchParams.toString()}`;
    const xml = await this._fetchText(efetchPath);
    return parsePubMedXML(xml);
  }
}

function buildPubMedQuery(query, filter = {}) {
  const parts = [];
  if (query) parts.push(query);
  if (filter.yearMin) parts.push(`${filter.yearMin}[pdat]`);
  if (filter.yearMax) parts.push(`${filter.yearMax}[pdat]`);
  if (filter.type === "review") parts.push("review[ptyp]");
  if (filter.type === "clinical_trial") parts.push("clinical trial[ptyp]");
  return parts.join(" AND ") || "all[sb]";
}

function parsePubMedXML(xml) {
  const papers = [];
  const articles = xml.split("<PubmedArticle>").slice(1);

  for (const articleStr of articles) {
    const articleContent = articleStr.split("</PubmedArticle>")[0];
    if (!articleContent) continue;

    try {
      const pmid = extractTag(articleContent, "PMID");
      const article = extractSection(articleContent, "Article");
      const journal = extractSection(article, "Journal");
      const journalIssue = extractSection(journal, "JournalIssue");
      const authorList = extractSection(article, "AuthorList");
      const meshHeadings = extractMeshHeadings(articleContent);

      const authors = [];
      const authorRegex = /<Author[^>]*>([\s\S]*?)<\/Author>/gi;
      let authorMatch;
      while ((authorMatch = authorRegex.exec(authorList)) !== null) {
        const lastName = extractTag(authorMatch[1], "LastName");
        const foreName = extractTag(authorMatch[1], "ForeName");
        if (lastName) {
          authors.push(foreName ? `${foreName} ${lastName}` : lastName);
        }
      }

      const doi = extractArticleDoi(article);
      const elocationid = extractTag(article, "ELocationID");

      papers.push({
        pmid,
        title: extractTag(article, "ArticleTitle"),
        authors,
        abstract: extractAbstractTexts(article),
        doi,
        elocationid: elocationid.replace(/^doi:\s*/i, "") || null,
        pubdate: extractPubDate(journalIssue),
        sortpubdate: extractPubDate(journalIssue),
        pubtype: extractTag(article, "PublicationType"),
        source: extractTag(journal, "Title") || extractTag(journal, "ISOAbbreviation"),
        journal: extractTag(journal, "Title"),
        meshTerms: meshHeadings,
        _raw: null,
      });
    } catch {
      // Skip malformed entries
    }
  }

  return papers;
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].replace(/<[^>]+>/g, "").trim() : "";
}

function extractSection(xml, section) {
  const regex = new RegExp(`<${section}[^>]*>([\\s\\S]*?)</${section}>`, "i");
  const match = xml.match(regex);
  return match ? match[1] : "";
}

function extractArticleDoi(article) {
  const eiloc = extractTag(article, "ELocationID");
  if (eiloc && eiloc.startsWith("10.")) return eiloc.replace(/^doi:\s*/i, "");

  const allIds = article.match(/<ArticleId[^>]*IdType="doi"[^>]*>([\s\S]*?)<\/ArticleId>/i);
  if (allIds) return allIds[1].trim();

  const doiRegex = /<ArticleId[^>]*>[\s\S]*?<\/ArticleId>/gi;
  const all = article.match(doiRegex) || [];
  for (const entry of all) {
    if (entry.includes('IdType="doi"')) {
      const val = entry.replace(/<[^>]+>/g, "").trim();
      if (val.startsWith("10.")) return val;
    }
  }

  return "";
}

function extractAbstractTexts(article) {
  const abstractSection = extractSection(article, "Abstract");
  if (!abstractSection) return "";

  const texts = [];
  const textRegex = /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi;
  let match;
  while ((match = textRegex.exec(abstractSection)) !== null) {
    const label = match[0].match(/Label="([^"]*)"/);
    const prefix = label ? `${label[1]}: ` : "";
    texts.push(prefix + match[1].replace(/<[^>]+>/g, "").trim());
  }

  return texts.join(" ") || abstractSection.replace(/<[^>]+>/g, "").trim();
}

function extractPubDate(journalIssue) {
  const pubDate = extractSection(journalIssue, "PubDate");
  const year = extractTag(pubDate, "Year");
  const month = extractTag(pubDate, "Month");
  const day = extractTag(pubDate, "Day");

  if (!year) return null;
  const mon = monthToNum(month);
  const d = day ? String(day).padStart(2, "0") : "01";
  return `${year}-${mon}-${d}`;
}

function monthToNum(month) {
  const months = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  if (!month) return "01";
  const m = month.toLowerCase().slice(0, 3);
  return months[m] || "01";
}

function extractMeshHeadings(articleContent) {
  const terms = [];
  const meshRegex = /<MeshHeading>([\s\S]*?)<\/MeshHeading>/gi;
  let match;
  while ((match = meshRegex.exec(articleContent)) !== null) {
    const descriptor = extractTag(match[1], "DescriptorName");
    if (descriptor) terms.push(descriptor);
  }
  return terms;
}

export default { PubMedProvider };
