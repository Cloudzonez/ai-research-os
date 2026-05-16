# Tracker Crawl Test Standard

Tracker creation is considered useful only when it creates a runnable literature monitor, not just a display card.

## Required Behavior

1. Creation derives search-ready keywords from the teacher's topic even if model output is unavailable or malformed.
2. Sources are normalized to supported academic crawlers: `arxiv` and `openalex`.
3. Creation immediately crawls selected sources with the derived query.
4. Crawled papers are normalized into paper records with title, authors, abstract, DOI, year, source, score, sharing, tags, and parsed status.
5. Results are deduplicated by DOI first and normalized title second.
6. Existing papers are still counted as tracked results but are not inserted twice.
7. Partial source failures are returned and stored without discarding successful source results.
8. The tracker stores the crawl query, status, errors, paper count, last run time, and crawled paper ids.
9. A tracker can be manually recrawled through `POST /api/trackers/:id/crawl`.

## Verification

- `npm run test:trackers` validates the tracker crawl service without network or database dependencies.
- `npm run test:e2e` validates the browser flow around tracker creation and tracker board behavior.
- `npm run build` must pass after tracker changes.
