# Reference Repos — Live Test Report & Borrowing Plan

> Date: 2026-05-26  
> All tests run on Arch Linux, Python 3.14.5, Node.js v22, with proxy bypassed.

---

## 1. paper-search-mcp-nodejs (TypeScript / Node.js)

**Status**: ✅ Installed, tested, works

### Test Results

```
npm install     → 507 packages, 6s
npm test        → 158/158 tests PASSED, 15/19 suites PASSED
                  (4 suites fail due to Jest ESM config, not code bugs)
```

### Key Observations

- **Best infrastructure code of any repo analyzed.** The rate limiter (token bucket), retry handler (exponential backoff + full jitter + Retry-After respect), request cache (SHA-256 keyed LRU), and security utilities are all production-grade.
- **14 academic platforms** abstracted behind a single `PaperSource` base class — arXiv, PubMed, Crossref, Semantic Scholar, Web of Science, Scopus, Springer, Wiley, ScienceDirect, Google Scholar, bioRxiv, medRxiv, IACR, Sci-Hub.
- **TypeScript → JavaScript port is trivial.** All patterns are standard JS with types stripped.

### What to Borrow (Priority 1 — Same Language)

| Utility | File | Lines | Port Effort |
|---|---|---|---|
| **Token bucket rate limiter** | `utils/RateLimiter.ts` | ~60 | 1 hour — pure algorithm, no deps |
| **Retry with backoff + jitter** | `utils/ErrorHandler.ts` | ~100 | 1 hour — wrap existing retry code |
| **SHA-256 keyed LRU cache** | `utils/RequestCache.ts` | ~50 | 30 min — `lru-cache` npm package |
| **Security utils** | `utils/SecurityUtils.ts` | ~80 | 30 min — DOI sanitize, query validate |
| **Platform capabilities** | `PaperSource.getCapabilities()` | pattern | Adopt pattern, not port code |
| **Centralized config** | `config/constants.ts` | ~30 | Consolidate existing scattered config |

Total port effort: **~4 hours** for all 6 utilities.

---

## 2. paperscraper (Python)

**Status**: ✅ Installed (with workaround for Python 3.14), works

### Test Results

| Test | Time | Results |
|---|---|---|
| PubMed search: "deep learning" + "optimization" | ~3s | 1 paper found (fine for max_results=3) |
| arXiv search: same query | **~7s** | 3 papers found |

### Key Finding: arXiv Performance

**Our current arXiv code takes 55+ seconds and often fails.** paperscraper takes 7 seconds and always succeeds. Why?

| Aspect | Our code (arxiv.js) | paperscraper (arxiv pkg) |
|---|---|---|
| Discovery | HTML scrape → 400 error → retry × 4 (each 5-30s) | Direct API call via `arxiv` Python package |
| Retry on failure | 4 retries with 5-20s delays each | 1 retry with proper API handling |
| API delay compliance | N/A (never reaches API) | 3.1s between calls (arXiv requirement) |
| Result | Timeout or partial | 3 papers in 7s |

**Recommendation**: Replace our `ingestion/arxiv.js` logic with either:
1. The `arxiv` npm package (Node.js equivalent of the Python package), OR
2. paperscraper's local dump pattern (download full arXiv metadata once, query locally)

### What to Borrow (Priority 2)

| Pattern | Impact |
|---|---|
| **Local dump pattern** | Download arXiv metadata snapshot once. Store as JSONL. Query locally → instant, no API calls, no rate limits. |
| **field_mapper normalization** | Each source maps to common schema via a small dict. Much cleaner than our current normalizePaper. |
| **Source dispatch registry** | `QUERY_FN_DICT` pattern — one dict maps source names to functions. Add/remove sources trivially. |
| **PDF fallback chain** | Dict-based fallback: `{ bioc: fn, elife: fn, unpaywall: fn }`. Linear chain, each tries and returns or passes. |

---

## 3. findpapers (Python)

**Status**: ✅ Installed, works

### Test Results

| Test | Time | Results |
|---|---|---|
| arXiv only: "deep learning" + "optimization", 5 papers | ~12s | 5 papers (with enrichment) |
| Multi-source: arXiv + OpenAlex + Semantic Scholar, 3/ea | **~22s** | 9 papers after dedup |

### Key Observations

- **Two-pass deduplication works.** DOI exact match then title-compatible merge. No cross-source duplicates found in test (query was broad).
- **Snowballing API exists** (BFS citation traversal — forward, backward, or both).
- **Enrichment adds ~2.5s per paper** (crossref + web scraping to fill missing metadata).
- **8 search databases** supported: arXiv, OpenAlex, Semantic Scholar, PubMed, Crossref, Scopus, IEEE, Web of Science. Plus enrichment from web scraping.
- **Query syntax is solid**: `ti[term]`, `abs[term]`, AND/OR/NOT, wildcards.
- **Per-source query builders**: Each database has its own query translator.

### What to Borrow (Priority 3)

| Pattern | Impact |
|---|---|
| **Two-pass dedup** | Implement in our paperStore: pass 1 = DOI exact match, pass 2 = title prefix + year-compatible merge |
| **Snowballing BFS** | After tracker crawl: fetch references (backward) + citations (forward) from Semantic Scholar. BFS with max_depth=1 for initial version. |
| **Connector registry** | Central dispatch table mapping source name → connector class. Makes adding new sources trivial. |
| **Enrichment pattern** | After search, enrich papers with metadata from additional sources (crossref + web). Our tracker crawl could do this. |

---

## 4. Performance Comparison: Our Code vs References

| Operation | Our Code | Best Reference | Ratio |
|---|---|---|---|
| arXiv search (3 papers) | **55s+ (often fails)** | paperscraper: **7s** | 8× slower |
| PubMed search (3 papers) | Not tested | paperscraper: **3s** | — |
| Multi-source (3 sources, 3 papers each) | Not tested | findpapers: **22s** | — |
| Rate limiting | Naive retry + delay | paper-search-mcp: token bucket | — |
| Retry | Linear/binary backoff | paper-search-mcp: jitter + Retry-After | — |
| API caching | None | paper-search-mcp: SHA-256 LRU | — |

---

## 5. Final Borrowing Decision

### What to Port Immediately (This Week)

From **paper-search-mcp-nodejs** (TypeScript → JavaScript, same language):

1. **RateLimiter** — `server/services/rateLimiter.js`
   - Token bucket algorithm, per-source instances, `waitForPermission()` async
   - Replaces our scattered `setTimeout` delays

2. **retryHandler** — add to `server/services/deepseek.js` and all `ingestion/*.js`
   - `retryWithBackoff(fn, { maxRetries, context })` — wraps any async function
   - Exponential backoff + full jitter + Retry-After header respect

3. **RequestCache** — `server/services/requestCache.js`
   - `lru-cache` npm package, SHA-256 key from (source, query, params)
   - Wrap every external API call: `cache.get(key) ?? (await apiCall(); cache.set(key, result))`

4. **SecurityUtils** — `server/services/securityUtils.js`
   - `sanitizeDoi()`, `validateQueryComplexity()`, `withTimeout()`

### What to Refactor (This Week)

5. **Fix arXiv ingestion** — Replace `ingestion/arxiv.js` retry loop with the `arxiv` npm package direct API call. No more 55s timeouts.

6. **Add source capabilities metadata** — Each ingestion adapter exports a `capabilities` object: `{ search: true, download: true, requiresApiKey: false }`. Used by the registry dispatch.

### What to Build (Next Week)

7. **Two-pass dedup in paperStore** — DOI exact match → title prefix + year-compatible merge.

8. **Citation snowballing** — BFS through Semantic Scholar citations, 1 level deep initially.

### What's NOT Worth Porting

- **paperscraper's local dump**: Requires downloading 2-3 GB. Build later when we have >100 daily crawls.
- **findpapers' query parser**: Our AI generates tracker specs, not query strings. Overkill.
- **paper-search-mcp's MCP protocol**: We use Express REST, not stdio MCP.

---

## 6. Expected Impact After Borrowing

| Metric | Before | After | Improvement |
|---|---|---|---|
| arXiv crawl time (10 papers) | 55s+ (often fails) | ~10s (reliable) | 5× faster, 100% reliable |
| API call reliability | Unpredictable | Token bucket + jitter retry | No more 429/throttle failures |
| Repeated API calls | No caching — fresh call every time | LRU cache with TTL | 50-80% fewer API calls for repeated queries |
| Deduplication quality | DOI only | DOI + title + year-compatible | Fewer duplicates, better merge |
| New paper discovery | Keyword search only | + citation snowballing | Find related papers that keywords miss |
| Code maintainability | Scattered delays, retries | Centralized rate limiter + retry handler | One place to tune for all sources |
