import test from "node:test";
import assert from "node:assert/strict";
import { searchArxiv } from "../server/services/ingestion/arxiv.js";
import { searchOpenAlex } from "../server/services/ingestion/openalex.js";
import { searchSemanticScholar } from "../server/services/ingestion/semanticScholar.js";
import { searchGitHubRepositories } from "../server/services/ingestion/github.js";

function withMockFetch(handler, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  return Promise.resolve()
    .then(run)
    .finally(() => {
      globalThis.fetch = originalFetch;
    });
}

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

test("arXiv connector parses title, abstract, URL, and PDF evidence from Atom", async () => {
  await withMockFetch(async (url) => {
    assert.match(String(url), /export\.arxiv\.org\/api\/query/);
    return new Response(`
      <feed>
        <entry>
          <id>http://arxiv.org/abs/2601.00001v1</id>
          <published>2026-01-01T00:00:00Z</published>
          <title>Multi-Agent Learning in Classrooms</title>
          <summary>This paper studies classroom agents.</summary>
          <author><name>A. Teacher</name></author>
        </entry>
      </feed>
    `, { status: 200, headers: { "content-type": "application/atom+xml" } });
  }, async () => {
    const papers = await searchArxiv("multi agent education", 1);
    assert.equal(papers.length, 1);
    assert.equal(papers[0].title, "Multi-Agent Learning in Classrooms");
    assert.equal(papers[0].abstract, "This paper studies classroom agents.");
    assert.equal(papers[0].url, "http://arxiv.org/abs/2601.00001v1");
    assert.equal(papers[0].pdfUrl, "http://arxiv.org/pdf/2601.00001v1");
  });
});

test("OpenAlex connector reconstructs abstracts and returns OA PDF evidence", async () => {
  await withMockFetch(async (url) => {
    assert.match(String(url), /api\.openalex\.org\/works/);
    return jsonResponse({
      results: [{
        title: "OpenAlex Evidence Paper",
        doi: "https://doi.org/10.1234/openalex",
        publication_year: 2025,
        cited_by_count: 42,
        abstract_inverted_index: {
          This: [0],
          paper: [1],
          has: [2],
          evidence: [3],
        },
        best_oa_location: { pdf_url: "https://example.org/openalex.pdf" },
        authorships: [{ author: { display_name: "B. Researcher" } }],
      }],
    });
  }, async () => {
    const papers = await searchOpenAlex("evidence", 1);
    assert.equal(papers.length, 1);
    assert.equal(papers[0].abstract, "This paper has evidence");
    assert.equal(papers[0].pdfUrl, "https://example.org/openalex.pdf");
    assert.equal(papers[0].doi, "https://doi.org/10.1234/openalex");
  });
});

test("Semantic Scholar connector returns abstract and open-access PDF evidence", async () => {
  await withMockFetch(async (url) => {
    assert.match(String(url), /api\.semanticscholar\.org\/graph\/v1\/paper\/search/);
    assert.match(String(url), /openAccessPdf/);
    return jsonResponse({
      data: [{
        title: "Semantic Scholar Evidence Paper",
        abstract: "A real abstract from Semantic Scholar.",
        year: 2024,
        url: "https://www.semanticscholar.org/paper/example",
        openAccessPdf: { url: "https://example.org/s2.pdf" },
        externalIds: { DOI: "10.1234/s2" },
        citationCount: 12,
        authors: [{ name: "C. Scholar" }],
      }],
    });
  }, async () => {
    const papers = await searchSemanticScholar("evidence", 1);
    assert.equal(papers.length, 1);
    assert.equal(papers[0].abstract, "A real abstract from Semantic Scholar.");
    assert.equal(papers[0].pdfUrl, "https://example.org/s2.pdf");
    assert.equal(papers[0].doi, "10.1234/s2");
  });
});

test("GitHub connector returns repository URL and metadata evidence", async () => {
  await withMockFetch(async (url) => {
    assert.match(String(url), /api\.github\.com\/search\/repositories/);
    return jsonResponse({
      items: [{
        full_name: "org/research-tool",
        description: "A research crawler support repository.",
        html_url: "https://github.com/org/research-tool",
        stargazers_count: 123,
        forks_count: 4,
        language: "JavaScript",
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        owner: { login: "org" },
      }],
    });
  }, async () => {
    const repos = await searchGitHubRepositories("research crawler", 1);
    assert.equal(repos.length, 1);
    assert.equal(repos[0].title, "org/research-tool");
    assert.equal(repos[0].url, "https://github.com/org/research-tool");
    assert.equal(repos[0].stars, 123);
  });
});
