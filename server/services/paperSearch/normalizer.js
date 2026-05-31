function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanDoi(value) {
  if (!value) return "";
  return String(value).replace(/^https?:\/\/doi\.org\//i, "").trim();
}

function extractYear(dateStr) {
  if (!dateStr) return null;
  const match = String(dateStr).match(/(\d{4})/);
  return match ? Number(match[1]) : null;
}

export function normalize(providerName, rawItem) {
  const fn = PROVIDER_NORMALIZERS[providerName];
  if (!fn) return normalizeGeneric(rawItem, providerName);
  return { ...normalizeGeneric(rawItem, providerName), ...fn(rawItem) };
}

function normalizeGeneric(raw, source) {
  return {
    title: cleanText(raw.title),
    source,
    sourceIds: {},
    doi: cleanDoi(raw.doi) || null,
    abstract: cleanText(raw.abstract || raw.summary || ""),
    authors: Array.isArray(raw.authors) ? raw.authors.filter(Boolean).map(cleanText) : [],
    year: raw.year ? Number(raw.year) : null,
    url: cleanText(raw.url) || null,
    pdfUrl: cleanText(raw.pdfUrl) || null,
    published: raw.published || raw.publishedDate || null,
    updated: raw.updated || null,
    citedByCount: Number(raw.citedByCount) || 0,
    venue: cleanText(raw.venue) || null,
    type: cleanText(raw.type) || null,
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    journalRef: cleanText(raw.journalRef) || null,
    itemType: raw.itemType || "paper",
    _raw: raw._raw || null,
  };
}

const PROVIDER_NORMALIZERS = {
  openalex(raw) {
    const doi = cleanDoi(raw.doi);
    const openalexId = raw.id ? String(raw.id).replace("https://openalex.org/", "") : "";
    const pdfUrl = raw.best_oa_location?.pdf_url || raw.primary_location?.pdf_url || "";

    return {
      sourceIds: {
        openalex: openalexId,
        doi: doi || undefined,
      },
      doi,
      pdfUrl: cleanText(pdfUrl) || null,
      venue: cleanText(raw.primary_location?.source?.display_name) || null,
      type: cleanText(raw.type) || null,
      citedByCount: Number(raw.cited_by_count) || 0,
      year: raw.publication_year || null,
      published: raw.publication_date || null,
      categories: (raw.topics || []).map((t) => t.display_name).filter(Boolean),
    };
  },

  crossref(raw) {
    const doi = cleanDoi(raw.DOI);
    const authors = [];
    if (raw.author) {
      for (const a of raw.author) {
        const name = [a.given, a.family].filter(Boolean).join(" ");
        if (name) authors.push(name);
      }
    }
    const year = raw.year || null;

    return {
      sourceIds: {
        crossref: doi || undefined,
        doi: doi || undefined,
      },
      doi,
      title: cleanText(raw.title?.[0]) || cleanText(raw.title),
      authors: authors.length ? authors : [],
      abstract: cleanText(raw.abstract) || "",
      year,
      published: raw["published-date"] || null,
      url: doi ? `https://doi.org/${doi}` : null,
      type: cleanText(raw.type) || null,
      venue: cleanText(raw["container-title"]?.[0]) || null,
      citedByCount: Number(raw["is-referenced-by-count"]) || 0,
      categories: raw.subject || [],
      journalRef: null,
    };
  },

  semantic_scholar(raw) {
    const doi = cleanDoi(raw.externalIds?.DOI);
    const arxivId = cleanText(raw.externalIds?.ArXiv) || undefined;
    const paperId = raw.paperId || "";

    return {
      sourceIds: {
        semanticScholar: paperId,
        doi: doi || undefined,
        arxiv: arxivId,
      },
      doi,
      title: cleanText(raw.title),
      authors: (raw.authors || []).map((a) => a.name || "").filter(Boolean),
      abstract: cleanText(raw.abstract),
      year: raw.year || extractYear(raw.publicationDate) || null,
      url: cleanText(raw.url) || null,
      pdfUrl: cleanText(raw.openAccessPdf?.url) || null,
      published: raw.publicationDate || null,
      citedByCount: Number(raw.citationCount) || 0,
      referenceCount: Number(raw.referenceCount) || 0,
      venue: cleanText(raw.venue) || cleanText(raw.journal?.name) || null,
      type: (raw.publicationTypes || []).join(", ") || null,
      categories: (raw.fieldsOfStudy || []).filter(Boolean),
    };
  },

  arxiv(raw) {
    const arxivId = raw.id || cleanText(raw.arxivId) || "";
    const doi = cleanDoi(raw.doi) || (arxivId ? `arxiv:${arxivId}` : "");

    return {
      sourceIds: {
        arxiv: arxivId,
        doi: raw.doi ? doi : undefined,
      },
      doi: raw.doi ? doi : null,
      title: cleanText(raw.title),
      authors: Array.isArray(raw.authors) ? raw.authors.filter(Boolean).map(cleanText) : [],
      abstract: cleanText(raw.abstract || raw.summary),
      year: Number(raw.year) || extractYear(raw.published) || null,
      url: arxivId ? `https://arxiv.org/abs/${arxivId}` : null,
      pdfUrl: arxivId ? `https://arxiv.org/pdf/${arxivId}` : null,
      published: raw.published || null,
      updated: raw.updated || null,
      categories: Array.isArray(raw.categories) ? raw.categories : [],
      journalRef: cleanText(raw.journalRef) || null,
    };
  },

  pubmed(raw) {
    const pmid = String(raw.pmid || raw.uid || "");
    const doi = cleanDoi(raw.doi || raw.elocationid);

    return {
      sourceIds: {
        pubmed: pmid,
        doi: doi || undefined,
      },
      doi,
      title: cleanText(raw.title),
      authors: Array.isArray(raw.authors) ? raw.authors.filter(Boolean).map(cleanText) : [],
      abstract: cleanText(raw.abstract),
      year: extractYear(raw.pubdate) || extractYear(raw.sortpubdate) || null,
      published: raw.pubdate || null,
      url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : null,
      type: cleanText(raw.pubtype) || null,
      venue: cleanText(raw.source) || cleanText(raw.journal) || null,
      categories: (raw.meshTerms || []).filter(Boolean),
    };
  },

  unpaywall(raw) {
    const doi = cleanDoi(raw.doi);
    const bestOa = raw.best_oa_location || {};
    const oaPdfUrl = bestOa.pdf_url || (raw.oa_locations || []).find((l) => l.pdf_url)?.pdf_url || "";

    return {
      sourceIds: {
        doi: doi || undefined,
      },
      doi,
      title: cleanText(raw.title),
      authors: [], // Unpaywall doesn't reliably return authors
      abstract: "",
      pdfUrl: cleanText(oaPdfUrl) || null,
      isOpenAccess: raw.is_oa || false,
      oaStatus: cleanText(raw.oa_status) || null,
      venue: cleanText(raw.journal_name) || null,
      year: raw.year || extractYear(raw.published_date) || null,
      published: raw.published_date || null,
    };
  },
};

export { PROVIDER_NORMALIZERS, normalizeGeneric, cleanText, cleanDoi, extractYear };
export default { normalize, PROVIDER_NORMALIZERS, normalizeGeneric };
