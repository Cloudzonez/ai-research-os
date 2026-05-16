export async function searchGitHubRepositories(query, maxResults = 10, options = {}) {
  const baseUrl = "https://api.github.com/search/repositories";
  const params = new URLSearchParams({
    q: query,
    sort: options.sort || "stars",
    order: options.order || "desc",
    per_page: String(Math.min(Math.max(Number(maxResults) || 10, 1), 100)),
  });

  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ai-research-os",
  };
  const token = options.token || process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}?${params.toString()}`, {
    headers,
    signal: AbortSignal.timeout(options.timeoutMs || 15000),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return (data.items || []).map((repo) => ({
    title: repo.full_name || repo.name || "",
    authors: repo.owner?.login ? [repo.owner.login] : [],
    abstract: repo.description || "",
    doi: "",
    year: Number(repo.created_at?.slice(0, 4)) || new Date().getFullYear(),
    source: "github",
    url: repo.html_url || "",
    stars: repo.stargazers_count || 0,
    forks: repo.forks_count || 0,
    language: repo.language || "",
    updatedAt: repo.updated_at || "",
    itemType: "repository",
  }));
}

export default { searchGitHubRepositories };
