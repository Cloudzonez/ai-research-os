import test from "node:test";
import assert from "node:assert/strict";
import { searchArxiv } from "../server/services/ingestion/arxiv.js";
import { searchOpenAlex } from "../server/services/ingestion/openalex.js";
import { searchSemanticScholar } from "../server/services/ingestion/semanticScholar.js";
import { searchGitHubRepositories } from "../server/services/ingestion/github.js";

const live = process.env.LIVE_CRAWLER_TEST === "1";

function hasPaperEvidence(paper) {
  return Boolean(paper.title && (paper.abstract || paper.summary || paper.pdfUrl || paper.url || paper.doi));
}

test("live arXiv connector fetches paper abstract or PDF evidence", { skip: !live }, async () => {
  const papers = await searchArxiv("multi agent reinforcement learning", 3);
  assert.ok(papers.length > 0);
  assert.ok(papers.some(hasPaperEvidence));
});

test("live OpenAlex connector fetches paper abstract, URL, or DOI evidence", { skip: !live }, async () => {
  const papers = await searchOpenAlex("multi agent reinforcement learning", 3);
  assert.ok(papers.length > 0);
  assert.ok(papers.some(hasPaperEvidence));
});

test("live Semantic Scholar connector fetches paper abstract, URL, or DOI evidence", { skip: !live }, async () => {
  const papers = await searchSemanticScholar("multi agent reinforcement learning", 3);
  assert.ok(papers.length > 0);
  assert.ok(papers.some(hasPaperEvidence));
});

test("live GitHub connector fetches repository URL metadata", { skip: !live }, async () => {
  const repos = await searchGitHubRepositories("rag evaluation benchmark", 3);
  assert.ok(repos.length > 0);
  assert.ok(repos.some((repo) => repo.title && repo.url));
});
