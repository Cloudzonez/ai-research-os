# Standard Crawler Architecture

Crawler creation no longer depends on AI-generated executable code.

## Contract

AI may suggest:

- crawler name
- query string
- keywords
- supported sources
- max result count
- source filters

The platform executes only maintained standard connectors:

- `arxiv`
- `openalex`
- `semantic_scholar`
- `github`

A connector result is accepted only when it has inspectable fetched content:

- paper-like sources must return a title plus at least one of abstract, summary, PDF URL, landing URL, or DOI
- GitHub must return a repository name/title plus repository URL

## Flow

1. User asks for a crawler.
2. AI suggests a JSON crawler spec.
3. The backend normalizes and validates the spec.
4. The spec is saved as `CrawlerPlugin.crawlerSpec`.
5. `POST /api/crawlers/:id/run` executes maintained connectors, not generated code.
6. Results are normalized and stored as reusable records.

Legacy generated-code crawlers are still supported through the old sandbox fallback when a saved crawler has no standard spec.

## Supported Connectors

- arXiv: Atom API query endpoint.
- OpenAlex: Works API search endpoint.
- Semantic Scholar: Academic Graph paper search endpoint.
- GitHub: REST repository search endpoint.

## Tests

- `npm run test:crawlers` validates both the crawler contract and each maintained connector parser with mocked endpoint responses.
- `npm run test:crawlers:live` optionally hits the real public endpoints and verifies the same evidence standard.
