export async function searchSemanticScholar(query, maxResults = 10, options = {}) {
  const baseUrl = "https://api.semanticscholar.org/graph/v1/paper/search";
  const params = new URLSearchParams({
    query,
    limit: String(Math.min(Math.max(Number(maxResults) || 10, 1), 100)),
    fields: "title,authors,abstract,year,externalIds,url,openAccessPdf,citationCount,venue,publicationDate",
  });

  const headers = { Accept: "application/json" };
  const apiKey = options.apiKey || process.env.SEMANTIC_SCHOLAR_API_KEY;
  if (apiKey) headers["x-api-key"] = apiKey;

  const res = await fetchWithRetry(`${baseUrl}?${params.toString()}`, { headers }, options);
  if (!res.ok) {
    throw new Error(`Semantic Scholar API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return (data.data || []).map((paper) => ({
    title: paper.title || "",
    authors: (paper.authors || []).map((author) => author.name || "").filter(Boolean),
    abstract: paper.abstract || "",
    doi: paper.externalIds?.DOI || "",
    year: paper.year || Number(paper.publicationDate?.slice(0, 4)) || new Date().getFullYear(),
    source: "semantic_scholar",
    url: paper.url || "",
    pdfUrl: paper.openAccessPdf?.url || "",
    citedByCount: paper.citationCount || 0,
    venue: paper.venue || "",
  }));
}

async function fetchWithRetry(url, init, options = {}) {
  const maxRetries = options.retries ?? 5;
  const baseDelay = options.retryDelay || 4000;
  const timeoutMs = options.timeoutMs || 15000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status !== 429 && res.status !== 503) return res;
    if (attempt === maxRetries) return res;
    const delay = baseDelay * Math.pow(2, attempt);
    console.warn(`Semantic Scholar: ${res.status} on attempt ${attempt + 1}, retrying in ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

export default { searchSemanticScholar };
