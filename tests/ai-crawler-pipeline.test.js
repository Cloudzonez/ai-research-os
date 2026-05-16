import test from "node:test";
import assert from "node:assert/strict";

// Connectors — real HTTP fetches
import { searchArxiv } from "../server/services/ingestion/arxiv.js";
import { searchOpenAlex } from "../server/services/ingestion/openalex.js";
import { searchSemanticScholar } from "../server/services/ingestion/semanticScholar.js";
import { searchGitHubRepositories } from "../server/services/ingestion/github.js";

// AI parser — the new service that will be built to pass these tests
import { parseCrawlResultsWithAI, normalizeToStandardFormat } from "../server/services/aiPaperParser.js";

// Orchestrator
import { runStandardCrawler, buildStandardCrawlerSpec } from "../server/services/standardCrawler.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidStandardFormat(item) {
  return Boolean(
    item.title &&
    typeof item.title === "string" &&
    item.title.length > 0 &&
    (item.abstract || item.summary) &&
    item.source &&
    typeof item.score === "number" &&
    Array.isArray(item.tags)
  );
}

function hasAbstractEvidence(item) {
  if (!item.abstract) return false;
  return item.abstract.length >= 30;
}

function hasPdfUrl(item) {
  return Boolean(item.pdfUrl && item.pdfUrl.startsWith("http"));
}

function hasDoi(item) {
  return Boolean(item.doi && item.doi.length > 0);
}

function hasUrl(item) {
  return Boolean(item.url && item.url.startsWith("http"));
}

// ---------------------------------------------------------------------------
// 1. CONNECTOR LIVE TESTS — every connector hits its real public API
// ---------------------------------------------------------------------------

test("arXiv live: returns papers with title, abstract, DOI, and PDF URL from real API", async () => {
  const papers = await searchArxiv("multi agent reinforcement learning", 5);

  assert.ok(papers.length >= 1, "should return at least 1 paper");
  assert.ok(papers.length <= 5, "should respect maxResults");

  for (const p of papers) {
    assert.ok(p.title, "every paper must have a title");
    assert.equal(p.source, "arxiv", "source must be arxiv");
  }

  const withAbstract = papers.filter((p) => hasAbstractEvidence(p));
  assert.ok(withAbstract.length >= 1, "at least some papers must have real abstracts (>=30 chars)");

  const withPdf = papers.filter((p) => hasPdfUrl(p));
  assert.ok(withPdf.length >= 1, "at least some papers must have PDF URLs");

  const withId = papers.filter((p) => p.doi || p.url);
  assert.ok(withId.length >= 1, "papers must have DOI or arXiv URL");
});

test("OpenAlex live: returns papers with reconstructed abstracts and OA PDF links", async () => {
  const papers = await searchOpenAlex("multi agent reinforcement learning", 5);

  assert.ok(papers.length >= 1, "should return at least 1 paper");

  for (const p of papers) {
    assert.ok(p.title, "every paper must have a title");
    assert.equal(p.source, "openalex", "source must be openalex");
  }

  const withAbstract = papers.filter((p) => hasAbstractEvidence(p));
  assert.ok(withAbstract.length >= 1, "at least some papers must have reconstructed abstracts");

  const withDoi = papers.filter((p) => hasDoi(p));
  assert.ok(withDoi.length >= 1, "at least some papers must have DOIs");
});

test("Semantic Scholar live: returns papers with abstracts and OA PDF links", async () => {
  let papers;
  try {
    papers = await searchSemanticScholar("multi agent reinforcement learning", 5);
  } catch (err) {
    if (err.message.includes("429")) {
      console.warn("Semantic Scholar rate limited — skipping test");
      return;
    }
    throw err;
  }

  assert.ok(papers.length >= 1, "should return at least 1 paper");

  for (const p of papers) {
    assert.ok(p.title, "every paper must have a title");
    assert.equal(p.source, "semantic_scholar", "source must be semantic_scholar");
  }

  const withAbstract = papers.filter((p) => hasAbstractEvidence(p));
  assert.ok(withAbstract.length >= 1, "at least some papers must have abstracts");

  const withDoi = papers.filter((p) => hasDoi(p));
  assert.ok(withDoi.length >= 1, "at least some papers must have DOIs");
});

test("GitHub live: returns repositories with full metadata from real API", async () => {
  const repos = await searchGitHubRepositories("rag evaluation benchmark", 5);

  assert.ok(repos.length >= 1, "should return at least 1 repository");

  for (const repo of repos) {
    assert.ok(repo.title, "every repo must have a title (full_name)");
    assert.ok(repo.url && repo.url.startsWith("https://github.com"), "every repo must have a GitHub URL");
    assert.equal(repo.itemType, "repository", "itemType must be repository");
    assert.equal(repo.source, "github", "source must be github");
    assert.ok(typeof repo.stars === "number", "stars must be a number");
  }

  const withDesc = repos.filter((r) => r.abstract && r.abstract.length > 10);
  assert.ok(withDesc.length >= 1, "at least some repos must have descriptions");
});

// ---------------------------------------------------------------------------
// 2. AI PAPER PARSER — parses raw crawl results into standard format
// ---------------------------------------------------------------------------

test("AI parser produces standard-format papers with generated abstracts from real crawl data", async () => {
  // Fetch real papers that may have missing or short abstracts
  const rawPapers = await searchArxiv("continual learning catastrophic forgetting", 3);
  assert.ok(rawPapers.length >= 1, "need real papers to test AI parsing");

  const parsed = await parseCrawlResultsWithAI(rawPapers, {
    source: "arxiv",
    locale: "en",
  });

  assert.ok(parsed.length >= 1, "should return parsed papers");
  assert.ok(parsed.length <= rawPapers.length, "should not create more papers than input");

  for (const paper of parsed) {
    assert.ok(isValidStandardFormat(paper), `paper should match standard format: ${paper.title}`);
    assert.ok(hasAbstractEvidence(paper), "AI parser must ensure every paper has a substantial abstract");
    assert.ok(paper.summary, "AI parser must generate a summary for every paper");
    assert.ok(paper.contributions, "AI parser must extract contributions for every paper");
    assert.ok(paper.methods, "AI parser must extract methods for every paper");
    assert.ok(paper.limitations, "AI parser must identify limitations for every paper");
    assert.equal(paper.status, "summarized", "status must be summarized after AI parsing");
    assert.ok(paper.score >= 0 && paper.score <= 100, "score must be in 0-100 range");
  }
});

test("AI parser generates description-based abstracts for GitHub repositories", async () => {
  const rawRepos = await searchGitHubRepositories("paper crawler research", 3);
  assert.ok(rawRepos.length >= 1, "need real repos to test AI parsing");

  const parsed = await parseCrawlResultsWithAI(rawRepos, {
    source: "github",
    locale: "en",
  });

  assert.ok(parsed.length >= 1, "should return parsed repos");

  for (const repo of parsed) {
    assert.ok(repo.title, "repo must have a title");
    assert.ok(repo.abstract && repo.abstract.length >= 30, "repo must have AI-generated description as abstract");
    assert.ok(repo.summary, "repo must have an AI-generated summary");
    assert.ok(repo.url && repo.url.startsWith("https://github.com"), "repo must have GitHub URL");
    assert.ok(repo.tags.includes("repository"), "must be tagged as repository");
    assert.equal(repo.status, "summarized", "status must be summarized");
  }
});

test("AI parser handles mixed academic and GitHub results in a single batch", async () => {
  const [arxivPapers, githubRepos] = await Promise.all([
    searchArxiv("transformer attention mechanism", 2),
    searchGitHubRepositories("transformer nlp library", 2),
  ]);

  const mixedRaw = [
    ...arxivPapers,
    ...githubRepos.map((r) => ({ ...r, itemType: "repository", source: "github" })),
  ];

  assert.ok(mixedRaw.length >= 2, "need mixed results");

  const parsed = await parseCrawlResultsWithAI(mixedRaw, { locale: "en" });

  const papers = parsed.filter((p) => !p.tags.includes("repository"));
  const repos = parsed.filter((p) => p.tags.includes("repository"));

  assert.ok(papers.length >= 1, "should have academic papers");
  assert.ok(repos.length >= 1, "should have repositories");

  for (const paper of papers) {
    assert.ok(isValidStandardFormat(paper), "academic paper should be in standard format");
    assert.ok(paper.contributions, "academic paper should have contributions");
    assert.ok(paper.methods, "academic paper should have methods");
  }

  for (const repo of repos) {
    assert.ok(repo.url && repo.url.startsWith("https://github.com"), "repo should have GitHub URL");
    assert.ok(repo.abstract && repo.abstract.length >= 30, "repo should have AI-generated abstract");
  }
});

// ---------------------------------------------------------------------------
// 3. FULL PIPELINE — crawl → AI parse → standard format → store-ready
// ---------------------------------------------------------------------------

function memoryPaperStore(seed = []) {
  const records = [...seed];
  return {
    records,
    async findDuplicate(item) {
      return records.find((r) => {
        if (item.doi && r.doi) return item.doi === r.doi;
        if (item.url && r.url) return r.url === item.url;
        return r.source === item.source && r.title === item.title;
      }) || null;
    },
    async create(item) {
      const created = { ...item, _id: `item-${records.length + 1}` };
      records.push(created);
      return created;
    },
  };
}

test("full pipeline: multi-source live crawl → AI parse → standard format store", async () => {
  const spec = buildStandardCrawlerSpec("Find recent papers and repos about AI agents", {
    aiText: JSON.stringify({
      name: "AI Agents Research",
      query: "autonomous AI agents",
      sources: ["arxiv", "github"],
      keywords: ["AI", "agents", "autonomous"],
      maxResults: 3,
    }),
  });

  assert.equal(spec.mode, "standard");
  assert.deepEqual(spec.sources, ["arxiv", "github"]);

  const store = memoryPaperStore();

  const crawl = await runStandardCrawler(spec, {
    paperStore: store,
    connectors: {
      arxiv: searchArxiv,
      github: searchGitHubRepositories,
    },
    aiParser: parseCrawlResultsWithAI,
    aiParserOptions: { locale: "en" },
  });

  // Crawl structure
  assert.ok(crawl.itemCount >= 1, "should find at least 1 item from real sources");
  assert.ok(crawl.paperCount >= 0, "paperCount should be a number");
  assert.ok(crawl.repositoryCount >= 0, "repositoryCount should be a number");
  assert.equal(crawl.itemCount, crawl.paperCount + crawl.repositoryCount);
  assert.equal(crawl.sources.length, 2, "should have attempted both sources");

  // Every crawled item that made it into the store must be in standard format
  for (const record of store.records) {
    assert.ok(isValidStandardFormat(record), `stored record must be standard format: ${record.title}`);
    assert.ok(record.summary, "stored record must have AI-generated summary");
    assert.ok(record.contributions, "stored record must have contributions");
    assert.ok(record.methods, "stored record must have methods");
    assert.ok(record.limitations, "stored record must have limitations");
    assert.equal(record.status, "summarized", "stored record must be summarized");

    if (record.tags.includes("repository")) {
      assert.ok(record.url && record.url.startsWith("https://github.com"), "repo must have GitHub URL");
    } else {
      const hasEvidence = record.abstract || record.doi || record.pdfUrl || record.url;
      assert.ok(hasEvidence, `academic paper must have evidence: ${record.title}`);
    }
  }

  // PDF URL capture
  const papers = store.records.filter((r) => !r.tags.includes("repository"));
  const withPdf = papers.filter((p) => hasPdfUrl(p));
  // At least some arxiv papers should have PDF URLs
  if (papers.length > 0) {
    assert.ok(withPdf.length >= 1 || papers.some((p) => p.doi),
      "academic papers must have PDF URLs or DOIs");
  }
});

test("full pipeline handles source failures gracefully with real APIs", async () => {
  const spec = buildStandardCrawlerSpec("test partial failure handling", {
    aiText: JSON.stringify({
      query: "quantum computing",
      sources: ["arxiv", "openalex", "semantic_scholar", "github"],
      maxResults: 2,
    }),
  });

  const store = memoryPaperStore();

  const crawl = await runStandardCrawler(spec, {
    paperStore: store,
    connectors: {
      arxiv: searchArxiv,
      openalex: searchOpenAlex,
      semantic_scholar: searchSemanticScholar,
      github: searchGitHubRepositories,
    },
    aiParser: parseCrawlResultsWithAI,
    aiParserOptions: { locale: "en" },
  });

  // All sources were attempted
  assert.equal(crawl.sources.length, 4, "should attempt all 4 sources");
  assert.equal(crawl.sourceResults.length + crawl.errors.length, 4,
    "each source should produce a result or error");

  // At least some sources should succeed
  assert.ok(crawl.itemCount >= 1, "at least some items should be found across real sources");

  // Verify all stored items are properly parsed
  for (const record of store.records) {
    assert.ok(isValidStandardFormat(record), "all stored records must be standard format");
    assert.equal(record.status, "summarized");
  }
});

test("full pipeline deduplicates across sources while preserving AI parsing", async () => {
  // Search the same topic on both arXiv and Semantic Scholar — duplicates are likely
  const spec = buildStandardCrawlerSpec("dedup test", {
    aiText: JSON.stringify({
      query: "large language model reasoning",
      sources: ["arxiv", "semantic_scholar"],
      maxResults: 5,
    }),
  });

  const store = memoryPaperStore();

  const crawl = await runStandardCrawler(spec, {
    paperStore: store,
    connectors: {
      arxiv: searchArxiv,
      semantic_scholar: searchSemanticScholar,
    },
    aiParser: parseCrawlResultsWithAI,
    aiParserOptions: { locale: "en" },
  });

  assert.ok(crawl.itemCount >= 1, "should find papers from real sources");

  // No duplicate titles in the store (case-insensitive)
  const titles = store.records.map((r) => r.title.toLowerCase().trim());
  const uniqueTitles = new Set(titles);
  assert.equal(titles.length, uniqueTitles.size, "store must not contain duplicate papers");

  // All records are AI-parsed
  for (const record of store.records) {
    assert.equal(record.status, "summarized");
    assert.ok(record.summary, "must have summary");
  }
});

// ---------------------------------------------------------------------------
// 4. PDF DOWNLOAD HANDLING
// ---------------------------------------------------------------------------

test("PDF URLs are captured from academic sources", async () => {
  // Use arxiv and openalex which are more reliable under rate limits
  const [arxivPapers, openalexPapers] = await Promise.all([
    searchArxiv("graph neural networks", 3),
    searchOpenAlex("graph neural networks", 3),
  ]);

  const allPapers = [...arxivPapers, ...openalexPapers];
  assert.ok(allPapers.length >= 3, "should have papers from academic sources");

  const withPdf = allPapers.filter((p) => hasPdfUrl(p));
  assert.ok(withPdf.length >= 1,
    `at least some papers must have PDF URLs (found ${withPdf.length})`);

  // Verify PDF URLs are valid HTTP(S) URLs pointing to documents
  for (const p of withPdf) {
    assert.ok(
      p.pdfUrl.startsWith("http"),
      `PDF URL must be a valid HTTP URL: ${p.pdfUrl}`
    );
  }
});

// ---------------------------------------------------------------------------
// 5. NORMALIZE TO STANDARD FORMAT (unit-level, no network)
// ---------------------------------------------------------------------------

test("normalizeToStandardFormat produces valid Paper-model-compatible objects", () => {
  const rawItem = {
    title: "  Test Paper Title  ",
    authors: ["Alice Chen", "", null, "Bob Zhang"],
    abstract: "Short.",
    doi: "https://doi.org/10.1234/test",
    year: "2025",
    source: "arxiv",
    pdfUrl: "https://arxiv.org/pdf/2501.00001.pdf",
    url: "https://arxiv.org/abs/2501.00001",
    citedByCount: 15,
    itemType: "paper",
  };

  const aiAnalysis = {
    abstract: "This is a comprehensive AI-generated abstract that describes the paper.",
    summary: "This paper presents a novel approach to testing.",
    contributions: "1. A new testing framework. 2. Empirical validation.",
    methods: "The authors conducted experiments on benchmark datasets.",
    limitations: "The approach is limited to small-scale datasets.",
  };

  const result = normalizeToStandardFormat(rawItem, aiAnalysis, {
    source: "arxiv",
    spec: { name: "Test Area", keywords: ["testing", "framework"] },
  });

  assert.equal(result.title, "Test Paper Title", "title should be cleaned");
  assert.deepEqual(result.authors, ["Alice Chen", "Bob Zhang"], "authors should filter falsy values");
  assert.equal(result.abstract, aiAnalysis.abstract, "abstract should come from AI analysis");
  assert.equal(result.doi, "10.1234/test", "DOI should be cleaned");
  assert.equal(result.year, 2025, "year should be a number");
  assert.equal(result.source, "arxiv");
  assert.equal(result.pdfUrl, "https://arxiv.org/pdf/2501.00001.pdf");
  assert.equal(result.summary, aiAnalysis.summary);
  assert.equal(result.contributions, aiAnalysis.contributions);
  assert.equal(result.methods, aiAnalysis.methods);
  assert.equal(result.limitations, aiAnalysis.limitations);
  assert.equal(result.status, "summarized");
  assert.ok(result.score >= 70 && result.score <= 100, "score should be computed");
  assert.ok(result.tags.includes("arXiv"), "should have source label tag");
  assert.ok(result.tags.includes("testing"), "should have keyword tags");
  assert.equal(result.sharing, "school");
});

test("normalizeToStandardFormat handles GitHub repositories correctly", () => {
  const rawRepo = {
    title: "org/awesome-research-tool",
    authors: ["org"],
    abstract: "A tool for research.",
    url: "https://github.com/org/awesome-research-tool",
    stars: 2500,
    forks: 120,
    language: "Python",
    itemType: "repository",
    source: "github",
  };

  const aiAnalysis = {
    abstract: "An open-source Python tool for academic research paper discovery and analysis. Features include automated crawling of multiple academic sources, AI-powered paper summarization, and PDF management.",
    summary: "Comprehensive research paper discovery and analysis platform.",
    contributions: "Automated multi-source crawling, AI summarization pipeline.",
    methods: "Python, GitHub API, language models for summarization.",
    limitations: "Limited to English-language papers, requires API keys for some sources.",
  };

  const result = normalizeToStandardFormat(rawRepo, aiAnalysis, {
    source: "github",
    spec: { name: "Research Tools", keywords: ["research", "tool", "python"] },
  });

  assert.equal(result.title, "org/awesome-research-tool");
  assert.ok(result.abstract.length > 50, "repo abstract should be detailed");
  assert.equal(result.url, "https://github.com/org/awesome-research-tool");
  assert.ok(result.tags.includes("repository"), "must be tagged repository");
  assert.ok(result.tags.includes("GitHub"), "must have GitHub source tag");
  assert.equal(result.score, 90, "high-star repos should score high");
  assert.equal(result.status, "summarized");
  assert.equal(result.summary, aiAnalysis.summary);
});
