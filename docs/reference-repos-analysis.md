# Reference Repository Analysis — Basement Decision

> Date: 2026-05-26  
> Context: Evaluating 7 open-source academic research repos to decide whether to
> build on one as a basement, borrow patterns from all, or continue on our own codebase.

---

## 1. Repos Analyzed

| # | Repo | Stars | Language | Type |
|---|---|---|---|---|
| 1 | `jannisborn/paperscraper` | 521 | Python | Crawling library |
| 2 | `jonatasgrosman/findpapers` | 358 | Python | Literature review tool |
| 3 | `LearningCircuit/local-deep-research` | 8k | Python/Flask/React | Full research platform |
| 4 | `dw-dengwei/daily-arXiv-ai-enhanced` | 2.8k | Python/Vanilla JS | Daily arXiv + AI |
| 5 | `kaixindelele/ChatPaper` | 19.5k | Python | Paper summarization |
| 6 | `Ar9av/PaperOrchestra` | 544 | Python/skills | Paper writing pipeline |
| 7 | `Dianel555/paper-search-mcp-nodejs` | 162 | TypeScript | MCP search server |

---

## 2. Side-by-Side Comparison as a Potential Basement

| Feature | Our Code | paperscraper | findpapers | local-deep-research | daily-arXiv | ChatPaper | PaperOrchestra | paper-search-mcp |
|---|---|---|---|---|---|---|---|---|
| **Language** | Node.js ESM | Python | Python | Python | Python/JS | Python | Python | TypeScript |
| **Backend server** | ✅ Express 5 | ❌ library | ❌ CLI/lib | ✅ Flask | ❌ GitHub Pages | ❌ Gradio | ❌ skills | ❌ stdio MCP |
| **Frontend** | ✅ React 19 | ❌ | ❌ | ✅ React+Vite | ✅ Vanilla JS | ❌ Gradio | ❌ | ❌ |
| **Database** | ✅ MongoDB | ❌ JSONL | ❌ JSON/BibTeX | ✅ SQLCipher | ❌ JSONL | ❌ files | ❌ files | ❌ cache only |
| **User system** | ✅ JWT auth | ❌ | ❌ | ✅ (multi-user) | ❌ (password gate) | ❌ | ❌ | ❌ |
| **Job queue** | ✅ MongoDB Q | ❌ | ❌ | ✅ APScheduler | ✅ GH Actions | ❌ | ❌ | ❌ |
| **Multi-source** | ✅ 6 sources | ✅ 4 sources | ✅ 8 sources | ✅ 35+ engines | ❌ arXiv only | ✅ 2 (arxiv+scholar) | ✅ 4 (S2+Crossref+OA+arXiv) | ✅ 14 platforms |
| **AI pipeline** | ✅ triage+summary | ❌ | ❌ | ✅ LLM relevance | ✅ summary | ✅ summary+review | ✅ paper writing | ❌ |
| **Rate limiting** | ⚠️ basic retry | ✅ excellent | ✅ decent | ✅ tenacity | ✅ arxiv pkg | ⚠️ basic | ⚠️ | ✅ token bucket |
| **Dedup** | ✅ DOI+title | ⚠️ simple | ✅ two-pass | ⚠️ basic | ✅ ID-based | ❌ | ✅ multi-index | ❌ |
| **Tests** | ✅ node:test | ✅ pytest | ❌ | ✅ pytest+benchmark | ❌ | ❌ | ❌ | ✅ Jest (158) |
| **PDF handling** | ⚠️ basic | ✅ fallback chain | ⚠️ basic | ✅ RAG chunking | ❌ links only | ✅ PyMuPDF | ❌ | ✅ pdf-parse |
| **Snowballing** | ❌ | ❌ | ✅ BFS | ⚠️ via search | ❌ | ❌ | ❌ | ❌ |
| **Scale ready** | ⚠️ V1 | ⚠️ library | ✅ parallel runner | ✅ multi-user | ❌ single user | ❌ single user | ❌ single run | ⚠️ library |

---

## 3. Decision: To Build on a Basement or Not?

### Option A: Switch to local-deep-research as basement
- **What we'd get**: Full research platform already built — users, search, RAG, document store, benchmarking. 35 search engines, 20+ research strategies, Flask + React frontend.
- **What we'd lose**: Entire Node.js/Express/MongoDB investment. Mongoose models, all routes, all services, all tests, React frontend components.
- **Effort**: ~3-6 months to port our features (trackers, chat center, paper reader, triage) into their Python/Flask stack.
- **Language mismatch**: Python backend vs our Node.js. React frontend is compatible though.

### Option B: Switch to paper-search-mcp-nodejs as basement
- **What we'd get**: Excellent search infrastructure in Node.js (rate limiting, caching, retry, 14 platforms).
- **What we'd lose**: It's a stdio MCP server, not an HTTP server. No database, no frontend, no user system, no AI pipeline. We'd need to build almost everything.
- **Effort**: ~1-2 months to wrap it as an HTTP service, then 2-3 more months to build the rest.
- **Language match**: TypeScript → JavaScript. Good.

### Option C: Keep our codebase, borrow heavily (RECOMMENDED)

Our architecture is well-designed and battle-tested:

```
Our strengths:
  ✅ ESM modular monolith — clean separation of concerns
  ✅ Express 5 + React 19 + MongoDB — modern, proven stack
  ✅ Job queue with worker process — ready for async crawls
  ✅ DI pattern for testability — well-architected
  ✅ Multi-source ingestion adapters — already 6 sources
  ✅ AI pipeline (triage → summary → HTML) — works end-to-end
  ✅ JWT auth + multi-user — production-ready
  ✅ Tracker system with scheduler — core feature

Our weaknesses (what to borrow):
  ❌ Rate limiting is naive (just retry + delay) — paper-search-mcp has token bucket
  ❌ Error handling lacks jitter — paper-search-mcp has full jitter + Retry-After
  ❌ No request caching on API calls — paper-search-mcp has SHA-256 keyed LRU
  ❌ arXiv is broken (timeout/400) — paperscraper has local dump pattern
  ❌ No citation snowballing — findpapers has BFS pattern
  ❌ Dedup is single-pass DOI only — findpapers has two-pass with compatible merge
  ❌ Config scattered across files — paper-search-mcp has centralized constants
  ❌ No platform capabilities metadata — paper-search-mcp declares per-platform capabilities
  ❌ No structured LLM output — daily-arXiv has Pydantic+function calling pattern
  ❌ api.js doesn't cover all endpoints — we just fixed this
  ❌ toClientPaper didn't map triage — we just fixed this
```

### Verdict: **Option C — Keep our codebase, borrow heavily**

The weaknesses are implementation details, not architectural flaws. Each can be fixed by borrowing specific patterns from the reference repos, without losing our existing investment.

---

## 4. What to Borrow — Priority Roadmap

### Phase 1: Infrastructure (Week 1-2)

Borrow from **paper-search-mcp-nodejs** (same language — can port directly):

| Component | Source File | How to Port |
|---|---|---|
| **Token bucket rate limiter** | `RateLimiter.ts` | Port to `server/services/rateLimiter.js` — same algorithm, clean JS |
| **Retry with backoff + jitter** | `ErrorHandler.ts` | Add `retryWithBackoff()` to your `deepseek.js` and all ingestion adapters |
| **SHA-256 keyed LRU cache** | `RequestCache.ts` | Port to `server/services/requestCache.js` — wrap API calls in all ingestion adapters |
| **Centralized config** | `config/constants.ts` | Consolidate timeouts, rate limits, API endpoints into `server/config.js` |
| **Security utilities** | `SecurityUtils.ts` | Port DOI sanitization, query validation to `server/services/` |

### Phase 2: Crawling Improvements (Week 2-3)

Borrow from **paperscraper**:

| Feature | How to Implement |
|---|---|
| **Local arXiv dump** | Download arXiv metadata snapshot once (Kaggle dataset or direct dump). Store as JSONL in `/data/`. Query locally instead of calling API. 1000× faster. |
| **Source dispatch registry** | Replace your current `defaultSearchers()` with a `QUERY_FN_DICT`-style dict: `{ arxiv: arxivSearcher, openalex: oaSearcher, ... }`. Add/remove sources by editing the dict. |
| **field_mapper normalization** | Each ingestion adapter maps source fields → common schema via a small dict. No massive mapper class. |
| **PDF fallback chain** | Dict-based: `{ bioc: fallbackBiocPmc, elife: fallbackElife, unpaywall: fallbackUnpaywall }`. Linear chain, each tries and returns or passes to next. |

Borrow from **findpapers**:

| Feature | How to Implement |
|---|---|
| **Two-pass dedup** | Pass 1: DOI exact match. Pass 2: title prefix + year-compatible merge (±1 year ok if preprint DOI present). |
| **Citation snowballing (BFS)** | After initial crawl: fetch references (backward) and citations (forward) from Semantic Scholar. BFS with max_depth. |

### Phase 3: AI Pipeline Enhancements (Week 3-4)

Borrow from **daily-arXiv-ai-enhanced** and **local-deep-research**:

| Feature | How to Implement |
|---|---|
| **Structured LLM output** | Use LangChain's `withStructuredOutput` pattern. Replace `parseResponse()` with Zod-validated structured output for triage, summary, and analysis. |
| **LLM relevance filtering** | Before full AI summary, let LLM judge relevance from title+abstract only (saves 80% token cost). |
| **Strategy pattern for research** | Different research modes (quick scan, deep dive, literature review) select different pipeline combos. |

### Phase 4: Polish (Week 4+)

Borrow from **our own fixes**:

| Fix | Status |
|---|---|
| `toClientPaper` maps triage fields | ✅ Done |
| `api.js` has crawlTracker/deleteTracker | ✅ Done |
| TrackersView uses centralized api client | ✅ Done |
| Make tracker generation async | Pending |
| Add CORS for frontend port | Pending |
| Set NO_PROXY for external API calls | Done (env setup) |

---

## 5. Architecture Diagram — Post-Borrow State

```
                          Academic Radar (v2)
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Frontend (React 19 + Vite + Tailwind)                      │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐        │
│  │AiCenter │ │Trackers  │ │Library  │ │PaperReader│        │
│  └────┬────┘ └────┬─────┘ └────┬────┘ └────┬─────┘        │
│       │           │            │            │               │
│       └───────────┴────────────┴────────────┘               │
│                        │ api.js (centralized client)         │
├────────────────────────┼────────────────────────────────────┤
│  Backend (Express 5)   │                                    │
│                        ▼                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  aiRouter.js  ←  contextEngine  ←  Paper Model       │   │
│  │       │                                              │   │
│  │       ├── deepseek.js (retry + jitter + cache)       │   │
│  │       ├── paperSummarizer.js (structured output)     │   │
│  │       └── aiTriage.js (structured output)            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  trackerCrawl.js                                      │   │
│  │       │                                              │   │
│  │       ├── Source Registry (QUERY_FN_DICT-style)      │   │
│  │       │   ├── arxivSearcher ← RateLimiter + Cache    │   │
│  │       │   ├── openalexSearcher ← RateLimiter + Cache │   │
│  │       │   ├── semanticScholarSearcher                │   │
│  │       │   └── crossrefSearcher                       │   │
│  │       │                                              │   │
│  │       ├── paperStore.js (two-pass dedup)             │   │
│  │       ├── pdfDownloader.js (fallback chain)           │   │
│  │       └── snowballRunner.js (BFS citations)           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Infrastructure                                      │   │
│  │  ├── rateLimiter.js (token bucket, per-source)       │   │
│  │  ├── retryHandler.js (exponential backoff + jitter)  │   │
│  │  ├── requestCache.js (SHA-256 keyed LRU)             │   │
│  │  └── securityUtils.js (DOI sanitize, query validate) │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Data: MongoDB ← Paper Model (confirmed "paper" collection) │
│        ┌─ local arXiv dump (JSONL, periodic refresh)        │
│        └─ Semantic Scholar cache (24h TTL)                  │
└──────────────────────────────────────────────────────────────┘

Borrowed patterns marked:
  🟢 paper-search-mcp-nodejs  — rate limiter, cache, retry, security
  🔵 paperscraper             — local dump, source registry, field mapper, PDF chain
  🟡 findpapers               — two-pass dedup, snowballing
  🟣 daily-arXiv              — structured output, exit-code gating
  🔴 local-deep-research      — strategy pattern, LLM relevance filter
```

---

## 6. FAQ for the Decision

### Q: Why not just use local-deep-research? It has everything.
**A**: It's Python/Flask. We'd throw away 100% of our Node.js code — all routes, services, models, tests, frontend. Plus migrating MongoDB to SQLCipher would lose data. The feature gap between our code and theirs is actually small — we have the same core features, just different implementations.

### Q: Why not build on paper-search-mcp-nodejs? Same language.
**A**: It's a stdio MCP server, not an HTTP server. No database, no users, no AI, no frontend. We'd rebuild 90% of our code anyway. Better to port the utility classes (rate limiter, cache, retry) into our existing architecture.

### Q: Is our code really that bad?
**A**: The *architecture* is good — Express + React + MongoDB + job queue + DI testing. The *implementation* has gaps — missing rate limiting, naive retry, no caching, broken arXiv. These are fixable by porting patterns from reference repos. You don't demolish a house because the kitchen sink leaks.

### Q: What's the biggest bang-for-buck fix?
**A**: Three things, in order:
1. **Port rate limiter + retry handler from paper-search-mcp-nodejs** — fixes all API reliability issues immediately
2. **Implement local arXiv dump from paperscraper pattern** — eliminates the 55-second arXiv timeout problem
3. **Make tracker generation async** — `/api/trackers/generate` currently blocks for 60+ seconds during crawl. Return immediately, run crawl in background, poll status.

---

## 7. Clone Reference

All 8 repos cloned to:
```
reference_repos/
├── paperscraper/
├── findpapers/
├── local-deep-research/
├── daily-arXiv-ai-enhanced/
├── ChatPaper/
├── PaperOrchestra/
├── paper-search-mcp-nodejs/
└── arxiv-mcp-server/
```

Full source code with their licenses (all MIT or equivalent). Reference freely.
