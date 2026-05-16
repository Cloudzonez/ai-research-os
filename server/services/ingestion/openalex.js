export async function searchOpenAlex(query, maxResults = 10, options = {}) {
  const baseUrl = "https://api.openalex.org/works";
  const params = new URLSearchParams({
    search: query,
    per_page: String(maxResults),
    sort: "cited_by_count:desc",
  });

  const url = `${baseUrl}?${params.toString()}`;
  const res = await fetchWithRetry(url, {
    headers: { "User-Agent": "mailto:ai-research-os@university.edu" },
  }, options);

  if (!res.ok) {
    throw new Error(`OpenAlex API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return (data.results || []).map((work) => ({
    title: work.title || "",
    authors: (work.authorships || []).map((a) => a.author?.display_name || ""),
    abstract: work.abstract_inverted_index
      ? invertAbstract(work.abstract_inverted_index)
      : "",
    doi: work.doi || "",
    year: work.publication_year || new Date().getFullYear(),
    source: "openalex",
    url: work.doi ? `https://doi.org/${work.doi}` : "",
    pdfUrl: work.best_oa_location?.pdf_url || work.primary_location?.pdf_url || "",
    citedByCount: work.cited_by_count || 0,
    type: work.type || "",
  }));
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

export default { searchOpenAlex };
