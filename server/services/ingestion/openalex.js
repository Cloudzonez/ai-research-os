import { config } from "../../config.js";

const OPENALEX_EMAIL = config.openAlexEmail || "JOpZgvOQfB8l1FW1SfBNZB";

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

export default { searchOpenAlex, searchOpenAlexSimple };
