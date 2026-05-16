export async function searchArxiv(query, maxResults = 10, options = {}) {
  const baseUrl = "http://export.arxiv.org/api/query";
  const params = new URLSearchParams({
    search_query: `all:${query}`,
    start: 0,
    max_results: maxResults,
    sortBy: "submittedDate",
    sortOrder: "descending",
  });

  const url = `${baseUrl}?${params.toString()}`;
  const res = await fetchWithRetry(url, {
    headers: { Accept: "application/atom+xml" },
  }, options);

  if (!res.ok) {
    throw new Error(`arXiv API error: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();

  // Simple regex-based Atom XML parsing (avoids xml2js dependency)
  const entries = xml.split(/<entry>/).slice(1);
  return entries.map((entry) => {
    const getTag = (tag) => {
      const match = entry.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
      return match ? match[1].trim() : "";
    };
    const getAuthors = () => {
      const matches = entry.match(/<name>([^<]*)<\/name>/g);
      return matches ? matches.map((m) => m.replace(/<\/?name>/g, "").trim()) : [];
    };
    const id = getTag("id");

    return {
      title: getTag("title"),
      authors: getAuthors(),
      abstract: getTag("summary"),
      doi: getTag("arxiv:doi") || `arxiv:${id}`,
      year: parseInt(getTag("published")?.slice(0, 4)) || new Date().getFullYear(),
      source: "arxiv",
      url: id,
      pdfUrl: id ? id.replace("/abs/", "/pdf/") : "",
      published: getTag("published"),
    };
  });
}

async function fetchWithRetry(url, init, options = {}) {
  const maxRetries = options.retries ?? 3;
  const baseDelay = options.retryDelay || 2000;
  const timeoutMs = options.timeoutMs || 15000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status !== 429 && res.status !== 503) return res;
    if (attempt === maxRetries) return res;
    console.warn(`arXiv: ${res.status} on attempt ${attempt + 1}, retrying in ${baseDelay * Math.pow(2, attempt)}ms...`);
  }
}
