import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { RateLimiter } from "../server/services/paperSearch/rateLimiter.js";
import { withRetry } from "../server/services/paperSearch/retryHandler.js";
import { normalize, cleanDoi } from "../server/services/paperSearch/normalizer.js";
import {
  PaperDeduplicator,
  paperIdentity,
  deduplicateBatch,
} from "../server/services/paperSearch/deduplicator.js";
import { rankPapers } from "../server/services/paperSearch/ranking.js";
import { mockModel } from "./_helpers/mockMongooseModel.js";

// ─── RateLimiter ────────────────────────────────────────────────────────────

describe("RateLimiter", () => {
  let limiter;

  it("acquires tokens when available", async () => {
    limiter = new RateLimiter({ maxTokens: 5, refillRate: 0, refillInterval: 100000 });
    const start = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    assert.ok(Date.now() - start < 100, "should not block when tokens available");
    assert.equal(limiter.stats().available, 2);
    limiter.destroy();
  });

  it("queues when tokens exhausted", async () => {
    limiter = new RateLimiter({ maxTokens: 1, refillRate: 0, refillInterval: 100000 });
    await limiter.acquire();
    assert.equal(limiter.stats().waiting, 0);

    let resolved = false;
    const p = limiter.acquire().then(() => { resolved = true; });
    assert.equal(limiter.stats().waiting, 1);
    assert.equal(resolved, false);

    limiter.release();
    await p;
    assert.equal(resolved, true);
    limiter.destroy();
  });

  it("refills tokens over time", async () => {
    limiter = new RateLimiter({ maxTokens: 2, refillRate: 10, refillInterval: 100 });
    await limiter.acquire();
    await limiter.acquire();
    assert.ok(limiter.stats().available < 1);

    await sleep(250);
    assert.ok(limiter.stats().available >= 1, "should have refilled");
    limiter.destroy();
  });

  it("destroy releases all waiters", async () => {
    limiter = new RateLimiter({ maxTokens: 1, refillRate: 0, refillInterval: 100000 });
    await limiter.acquire();

    let resolved = false;
    limiter.acquire().then(() => { resolved = true; });
    limiter.destroy();
    await sleep(10);
    assert.equal(resolved, true);
  });
});

// ─── RetryHandler ───────────────────────────────────────────────────────────

describe("RetryHandler", () => {
  it("retries on 429/503 and succeeds eventually", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 3) {
        const err = new Error("rate limited");
        err.status = 429;
        err.headers = new Map();
        throw err;
      }
      return "ok";
    };
    const result = await withRetry(fn, { retries: 3, baseDelayMs: 10, jitter: false });
    assert.equal(result, "ok");
    assert.equal(calls, 3);
  });

  it("throws after exhausting retries", async () => {
    const fn = async () => {
      const err = new Error("unavailable");
      err.status = 503;
      throw err;
    };
    try {
      await withRetry(fn, { retries: 2, baseDelayMs: 10, jitter: false });
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal(err.status, 503);
    }
  });

  it("does not retry on 4xx (except 429)", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      const err = new Error("not found");
      err.status = 404;
      throw err;
    };
    try {
      await withRetry(fn, { retries: 3, baseDelayMs: 10 });
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal(err.status, 404);
      assert.equal(calls, 1);
    }
  });

  it("backs off exponentially", async () => {
    const delays = [];
    let calls = 0;
    const fn = async () => {
      calls++;
      const err = new Error("server error");
      err.status = 502;
      throw err;
    };
    try {
      await withRetry(fn, {
        retries: 3,
        baseDelayMs: 10,
        jitter: false,
        onRetry: (_, __, delay) => delays.push(delay),
      });
    } catch {}
    assert.equal(delays.length, 3);
    assert.ok(delays[1] >= delays[0], "delays should increase");
    assert.ok(delays[2] >= delays[1], "delays should increase");
  });
});

// ─── Normalizer ─────────────────────────────────────────────────────────────

describe("Normalizer", () => {
  it("normalizes OpenAlex raw item", () => {
    const raw = {
      id: "https://openalex.org/W123456789",
      title: " Test Paper ",
      authors: ["Alice Wang", "Bob Li"],
      abstract: "hello world",
      doi: "https://doi.org/10.1234/test",
      publication_year: 2024,
      publication_date: "2024-03-15",
      cited_by_count: 42,
      type: "journal-article",
      best_oa_location: { pdf_url: "https://example.com/paper.pdf" },
      primary_location: { source: { display_name: "Nature" }, pdf_url: null },
      topics: [{ display_name: "Machine Learning" }, { display_name: "NLP" }],
      _raw: null,
    };

    const paper = normalize("openalex", raw);
    assert.equal(paper.title, "Test Paper");
    assert.equal(paper.source, "openalex");
    assert.equal(paper.sourceIds.openalex, "W123456789");
    assert.equal(paper.sourceIds.doi, "10.1234/test");
    assert.deepEqual(paper.authors, ["Alice Wang", "Bob Li"]);
    assert.equal(paper.abstract, "hello world");
    assert.equal(paper.year, 2024);
    assert.equal(paper.citedByCount, 42);
    assert.equal(paper.pdfUrl, "https://example.com/paper.pdf");
    assert.equal(paper.venue, "Nature");
    assert.deepEqual(paper.categories, ["Machine Learning", "NLP"]);
    assert.equal(paper.doi, "10.1234/test");
  });

  it("normalizes Crossref raw item", () => {
    const raw = {
      DOI: "10.5555/example",
      title: ["Example Paper Title"],
      author: [
        { given: "Alice", family: "Smith" },
        { given: "Bob", family: "Jones" },
      ],
      abstract: "This is an abstract.",
      type: "journal-article",
      "published-print": { "date-parts": [[2023, 5, 10]] },
      "published-date": "2023-05-10",
      year: 2023,
      "container-title": ["Journal of Examples"],
      "is-referenced-by-count": 15,
      subject: ["Computer Science", "AI"],
      _raw: null,
    };

    const paper = normalize("crossref", raw);
    assert.equal(paper.title, "Example Paper Title");
    assert.equal(paper.source, "crossref");
    assert.equal(paper.doi, "10.5555/example");
    assert.deepEqual(paper.authors, ["Alice Smith", "Bob Jones"]);
    assert.equal(paper.abstract, "This is an abstract.");
    assert.equal(paper.year, 2023);
    assert.equal(paper.published, "2023-05-10");
    assert.equal(paper.citedByCount, 15);
    assert.equal(paper.venue, "Journal of Examples");
    assert.deepEqual(paper.categories, ["Computer Science", "AI"]);
  });

  it("normalizes Semantic Scholar raw item", () => {
    const raw = {
      paperId: "abc123def456",
      title: "Deep Learning Review",
      authors: [{ name: "Carol Zhang", authorId: "z1" }],
      abstract: "A comprehensive review.",
      externalIds: { DOI: "10.7777/review", ArXiv: "2401.00001" },
      year: 2025,
      url: "https://semanticscholar.org/paper/abc123",
      openAccessPdf: { url: "https://arxiv.org/pdf/2401.00001.pdf" },
      citationCount: 88,
      referenceCount: 45,
      venue: "ICLR",
      publicationDate: "2025-01-15",
      publicationTypes: ["JournalArticle"],
      fieldsOfStudy: ["Artificial Intelligence", "Deep Learning"],
      _raw: null,
    };

    const paper = normalize("semantic_scholar", raw);
    assert.equal(paper.title, "Deep Learning Review");
    assert.equal(paper.sourceIds.semanticScholar, "abc123def456");
    assert.equal(paper.sourceIds.doi, "10.7777/review");
    assert.equal(paper.sourceIds.arxiv, "2401.00001");
    assert.equal(paper.citedByCount, 88);
    assert.equal(paper.referenceCount, 45);
    assert.equal(paper.pdfUrl, "https://arxiv.org/pdf/2401.00001.pdf");
    assert.equal(paper.venue, "ICLR");
  });

  it("normalizes arXiv raw item", () => {
    const raw = {
      id: "2401.50001",
      title: "Novel Transformer Architecture",
      authors: ["David Park", "Eve Chen"],
      abstract: "We propose a new architecture.",
      doi: "10.9999/arxiv.2401.50001",
      year: 2024,
      published: "2024-01-20T00:00:00Z",
      categories: ["cs.AI", "cs.CL"],
      journalRef: "Published in ACL 2024",
      _raw: null,
    };

    const paper = normalize("arxiv", raw);
    assert.equal(paper.title, "Novel Transformer Architecture");
    assert.equal(paper.sourceIds.arxiv, "2401.50001");
    assert.equal(paper.sourceIds.doi, "10.9999/arxiv.2401.50001");
    assert.equal(paper.url, "https://arxiv.org/abs/2401.50001");
    assert.equal(paper.pdfUrl, "https://arxiv.org/pdf/2401.50001");
    assert.deepEqual(paper.categories, ["cs.AI", "cs.CL"]);
    assert.equal(paper.journalRef, "Published in ACL 2024");
  });

  it("normalizes PubMed raw item", () => {
    const raw = {
      pmid: "12345678",
      title: "Gene Expression Study",
      authors: ["Frank Miller"],
      abstract: "Study of gene expression patterns.",
      doi: "10.1111/pm.12345678",
      pubdate: "2023-06-15",
      source: "Nature Medicine",
      pubtype: "Journal Article",
      meshTerms: ["Gene Expression", "Humans"],
      _raw: null,
    };

    const paper = normalize("pubmed", raw);
    assert.equal(paper.title, "Gene Expression Study");
    assert.equal(paper.sourceIds.pubmed, "12345678");
    assert.equal(paper.sourceIds.doi, "10.1111/pm.12345678");
    assert.equal(paper.url, "https://pubmed.ncbi.nlm.nih.gov/12345678/");
    assert.deepEqual(paper.categories, ["Gene Expression", "Humans"]);
    assert.equal(paper.venue, "Nature Medicine");
  });

  it("normalizes Unpaywall raw item", () => {
    const raw = {
      doi: "10.2222/oa-paper",
      title: "Open Access Research",
      is_oa: true,
      oa_status: "green",
      best_oa_location: { pdf_url: "https://example.com/oa-paper.pdf" },
      oa_locations: [],
      journal_name: "PLOS ONE",
      year: 2022,
      published_date: "2022-08-01",
      _raw: null,
    };

    const paper = normalize("unpaywall", raw);
    assert.equal(paper.doi, "10.2222/oa-paper");
    assert.equal(paper.isOpenAccess, true);
    assert.equal(paper.oaStatus, "green");
    assert.equal(paper.pdfUrl, "https://example.com/oa-paper.pdf");
    assert.equal(paper.venue, "PLOS ONE");
  });

  it("handles missing fields gracefully", () => {
    const paper = normalize("arxiv", { title: "Minimal" });
    assert.equal(paper.title, "Minimal");
    assert.deepEqual(paper.authors, []);
    assert.equal(paper.abstract, "");
    assert.equal(paper.doi, null);
    assert.equal(paper.year, null);
    assert.equal(paper.url, null);
  });

  it("cleanDoi strips doi.org prefix", () => {
    assert.equal(cleanDoi("https://doi.org/10.1234/test"), "10.1234/test");
    assert.equal(cleanDoi("10.1234/test"), "10.1234/test");
    assert.equal(cleanDoi(""), "");
  });
});

// ─── Deduplicator ───────────────────────────────────────────────────────────

describe("Deduplicator", () => {
  it("deduplicates by DOI (case-insensitive)", () => {
    const papers = [
      { doi: "10.1234/Test", title: "Test Paper", authors: [], year: 2024 },
      { doi: "10.1234/test", title: "Test Paper Duplicate", authors: [], year: 2024 },
    ];
    const { unique, duplicates } = deduplicateBatch(papers);
    assert.equal(unique.length, 1);
    assert.equal(duplicates.length, 1);
  });

  it("deduplicates by title + year + first author", () => {
    const papers = [
      { title: "Deep Learning Review", authors: ["Alice Smith"], year: 2024 },
      { title: "  deep learning review  ", authors: ["Alice Smith"], year: 2024 },
    ];
    const { unique, duplicates } = deduplicateBatch(papers);
    assert.equal(unique.length, 1);
    assert.equal(duplicates.length, 1);
  });

  it("does not false-match different years", () => {
    const papers = [
      { title: "Deep Learning Review", authors: ["Alice Smith"], year: 2024 },
      { title: "Deep Learning Review", authors: ["Alice Smith"], year: 2020 },
    ];
    const { unique } = deduplicateBatch(papers);
    assert.equal(unique.length, 2);
  });

  it("deduplicates by exact title when no DOI", () => {
    const papers = [
      { title: "Unique Paper Title", authors: [], year: null },
      { title: "Unique Paper Title", authors: [], year: null },
    ];
    const { unique, duplicates } = deduplicateBatch(papers);
    assert.equal(unique.length, 1);
    assert.equal(duplicates.length, 1);
  });

  it("identity uses DOI when available", () => {
    const id1 = paperIdentity({ doi: "10.1234/test", title: "Foo" });
    const id2 = paperIdentity({ doi: "https://doi.org/10.1234/test", title: "Bar" });
    assert.equal(id1, id2);
  });

  it("findExisting returns null without paperStore", async () => {
    const dedup = new PaperDeduplicator();
    const existing = await dedup.findExisting({ doi: "10.1234/test" });
    assert.equal(existing, null);
  });

  it("findExisting matches by DOI in paperStore", async () => {
    const store = mockModel([
      { _id: "existing-1", title: "Existing Paper", doi: "10.1234/existing", sourceIds: { openalex: "W999", doi: "10.1234/existing" } },
    ]);
    const dedup = new PaperDeduplicator({ paperStore: store });
    const existing = await dedup.findExisting({ doi: "10.1234/existing" });
    assert.ok(existing);
    assert.equal(existing._id, "existing-1");
  });
});

// ─── Ranking ────────────────────────────────────────────────────────────────

describe("Ranking", () => {
  it("ranks papers by citation, recency, and keyword match", () => {
    const papers = [
      { title: "Old uncited paper", year: 2018, citedByCount: 0, abstract: "" },
      { title: "Recent cited paper about AI", year: 2025, citedByCount: 50, abstract: "AI research", venue: "NeurIPS" },
      { title: "Old mega-cited paper", year: 2015, citedByCount: 5000, abstract: "" },
    ];

    const ranked = rankPapers(papers, { keywords: ["ai"] });
    assert.equal(ranked.length, 3);
    assert.ok(ranked[0]._score > ranked[1]._score, "best paper should score highest");
    assert.ok(ranked[1]._score > ranked[2]._score, "worst paper should score lowest");
    assert.ok("_score" in ranked[0]);
  });

  it("scores by recency", () => {
    const recent = [{ title: "New", year: new Date().getFullYear(), citedByCount: 0, abstract: "" }];
    const old = [{ title: "Old", year: 2000, citedByCount: 0, abstract: "" }];

    const ranked = rankPapers([...old, ...recent]);
    assert.equal(ranked[0].title, "New");
    assert.equal(ranked[1].title, "Old");
  });

  it("scores OA papers higher", () => {
    const oa = [{ title: "OA", year: 2024, citedByCount: 0, pdfUrl: "https://example.com/paper.pdf" }];
    const closed = [{ title: "Closed", year: 2024, citedByCount: 0, pdfUrl: null }];

    const ranked = rankPapers([...closed, ...oa]);
    assert.equal(ranked[0].title, "OA");
  });
});

// ─── UnifiedPaperSearch (unit-level) ────────────────────────────────────────

describe("UnifiedPaperSearch", () => {
  // We test the resolvers and ID detection without real network calls
  let UnifiedPaperSearch;

  beforeEach(async () => {
    const mod = await import("../server/services/paperSearch/index.js");
    UnifiedPaperSearch = mod.UnifiedPaperSearch;
    mod.resetSearchService();
  });

  it("resolves provider aliases", () => {
    const svc = new UnifiedPaperSearch({ providers: {} });
    const resolved = svc._resolveProviders(["arxiv", "s2", "open alex"]);
    assert.deepEqual(resolved, ["arxiv", "semantic_scholar", "openalex"]);
  });

  it("returns default providers when none requested", () => {
    const svc = new UnifiedPaperSearch({ providers: {} });
    const resolved = svc._resolveProviders([]);
    assert.ok(resolved.includes("openalex"));
    assert.ok(resolved.includes("crossref"));
    assert.ok(resolved.includes("semantic_scholar"));
    assert.ok(resolved.includes("arxiv"));
  });

  it("detects DOI IDs", () => {
    const svc = new UnifiedPaperSearch({ providers: {} });
    assert.equal(svc._detectIdType("10.1234/example"), "doi");
    assert.equal(svc._detectIdType("10.5678/foo.bar_123"), "doi");
  });

  it("detects arXiv IDs", () => {
    const svc = new UnifiedPaperSearch({ providers: {} });
    assert.equal(svc._detectIdType("2401.00001"), "arxiv");
  });

  it("detects PubMed IDs", () => {
    const svc = new UnifiedPaperSearch({ providers: {} });
    assert.equal(svc._detectIdType("12345678"), "pubmed");
    assert.equal(svc._detectIdType("PMC123456"), "pubmed");
  });

  it("detects OpenAlex IDs", () => {
    const svc = new UnifiedPaperSearch({ providers: {} });
    assert.equal(svc._detectIdType("W123456789"), "openalex");
  });

  it("detects Semantic Scholar IDs", () => {
    const svc = new UnifiedPaperSearch({ providers: {} });
    assert.equal(svc._detectIdType("649def34f8be52c8b66281af98ae884c09aef38b"), "semantic_scholar");
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
