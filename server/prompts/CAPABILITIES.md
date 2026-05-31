# Academic Radar — System Capabilities & Prompt Guide

> **Purpose:** This document is the single source of truth for what the system CAN do.
> Each prompt file under `server/prompts/` should reference the relevant section below
> to keep AI-generated configurations compatible with actual system capabilities.
>
> **Rule:** Any prompt that generates tracker configs, source lists, or search parameters
> MUST import and reference the capability constants from `capabilities.js`.

---

## 1. Data Sources

### Source Capability Matrix

| Source | API | Chinese Support | Returns | Rate Limit | Max Results | Cached |
|--------|-----|-----------------|---------|-----------|-------------|--------|
| **arxiv** | `/ingestion/arxiv.js` + `/paperSearch/providers/arxiv.js` | **NO — English only** | title, authors, truncated abstract (~250 chars), categories, PDF URL | 0.33 req/s | 100 | Yes |
| **openalex** | `/ingestion/openalex.js` + `/paperSearch/providers/openalex.js` | **YES** (matches Chinese titles/abstracts) | title, authors, abstract, DOI, citedByCount, OA PDF URL | 1 req/s (unauth), 10 req/s (key) | 200 | Yes |
| **semantic_scholar** | `/ingestion/semanticScholar.js` + `/paperSearch/providers/semanticScholar.js` | **NO — English only** | title, authors, abstract, citationCount, OA PDF URL, venue | 1 req/s (unauth), 10 req/s (key) | 100 | Yes |
| **crossref** | `/paperSearch/providers/crossref.js` | **YES** (publisher-dependent metadata) | title, authors, abstract (if available), DOI, type, citedByCount | 50 req/s | 1000 | Yes |
| **pubmed** | `/paperSearch/providers/pubmed.js` | **YES** (Chinese biomedical literature) | title, authors, abstract (structured), DOI, PMID, MeSH terms | 3 req/s (unauth), 10 req/s (key) | 100 | Yes |
| **github** | `/ingestion/github.js` | **YES** (keyword match on repo metadata) | repo name, description, stars, forks, language, URL (NOT papers) | 60 req/hr (unauth), 5000 req/hr (token) | 100 | **No** |

### Key Rules for Source Selection

1. **Chinese-language queries → MUST include at least one of: `openalex`, `crossref`.** `arxiv` and `semantic_scholar` will return ZERO results.
2. **English CS/AI/ML queries → `arxiv` is best** (fastest, most complete for CS).
3. **Biomedical/life science → `pubmed`** (MeSH indexing, structured abstracts).
4. **Need citations → `semantic_scholar`, `openalex`** (they include citation counts).
5. **Repository/code → `github`** (returns repos, not papers — different item type).
6. **General academic search → always include `openalex` + `crossref`** as fallback.
7. **Tracker defaults:** `["arxiv", "openalex", "semantic_scholar"]` for English topics, `["openalex", "crossref", "semantic_scholar"]` for Chinese.

---

## 2. Tracker Configuration

### Fields

| Field | Type | Description | Valid Values |
|-------|------|-------------|--------------|
| `name` | string (max 60 chars) | Display name for the tracker | Any |
| `keywords` | string[] (max 8) | Search terms, joined with spaces for query | English or Chinese words |
| `sources` | string[] | Academic sources to crawl | See Source Capability Matrix above |
| `signals` | string[] (max 6) | Alert triggers | e.g., "高相关", "新论文", "High relevance" |
| `cadence` | "Daily" or "Weekly" | How often to crawl | Daily, Weekly |
| `maxResults` | number (1–50) | Results per source per crawl | 1–50, default 25 |

### Source-Language Compatibility

- Query contains Chinese → do NOT use `arxiv` as only source. Always pair with `openalex` or `crossref`.
- Query contains only English → `arxiv` is fine alone, but `openalex` provides better abstracts and citation data.

---

## 3. Paper Processing Pipeline

### Stages

```
Crawl (fetch from sources)
  → Normalize (unify field names across sources, assign itemType: paper/repository)
  → Deduplicate (DOI + title matching against existing DB)
  → Store (MongoDB Paper documents, status: "parsed")
  → Summarize (LLM: 5-field structured analysis — tldr, motivation, method, result, conclusion)
  → Triage (LLM: relevance 0–10, category, novelty, reasoning)
  → Enrich (HTML page generation, full-text extraction from PDF)
```

### Paper Model Fields (for prompt context)

- **Identity:** title, doi, source, sourceIds (per-source IDs)
- **Authors:** authors (string[])
- **Content:** abstract, text (full text if extracted)
- **Metadata:** year, url, pdfUrl, itemType (paper/repository), tags
- **AI Enrichments:** summary, contributions, methods, limitations, aiSummary (tldr/motivation/method/result/conclusion)
- **Triage:** triageRelevance, triageCategory, triageNovelty, triageReasoning

---

## 4. AI Actions (What the System Can Do)

### Via Chat Interface

| Action | Prefix | Description |
|--------|--------|-------------|
| `create_tracker` | `TRACKER:` | Create a new paper tracker with name, keywords, sources |
| `upload_paper_pdf` | `PDF:` | Upload and parse a paper PDF |
| `draft_paper_section` | `WRITE:` | Generate a related work draft from literature |
| `general` | `GENERAL:` | General research Q&A (default) |

### Via REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/trackers` | GET/POST | List all / Create tracker |
| `/api/trackers/:id/crawl` | POST | Execute crawl for a tracker |
| `/api/trackers/generate` | POST | AI-generate tracker from topic |
| `/api/papers` | GET | List/search papers |
| `/api/papers/search` | POST | Multi-source paper search |
| `/api/papers/:id/summarize` | POST | AI-summarize a paper |
| `/api/papers/:id/html` | GET | Get AI-generated HTML page for paper |
| `/api/dashboards` | GET/POST | List/Create dashboards |
| `/api/writing/generate` | POST | Generate a related work draft |
| `/api/chat/stream` | POST | Streaming AI chat |

### Via Queue Worker

| Job Type | Description |
|----------|-------------|
| `summarize_paper` | AI analysis of paper abstract → 5-field structured summary |
| `analyze_paper_full` | Full-text AI analysis → summary, contributions, methods, limitations |

---

## 5. Model Configuration

| Config | Default | Description |
|--------|---------|-------------|
| Model | `deepseek-v4-pro` | DeepSeek API model |
| Base URL | env `DEEPSEEK_BASE_URL` | API endpoint |
| API Key | env `DEEPSEEK_API_KEY` | Authentication token |
| Chat temperature | 0.7 (chat), 0.2–0.3 (structured output) | Lower for JSON extraction |
| Max tokens | 2048 (chat), 4096+ (analysis) | Depends on task |

---

## 6. Frontend Routes

| View | Component | Route |
|------|-----------|-------|
| AI Center (chat) | `AiCenter.jsx` | `/ai` |
| Library | `LibraryView.jsx` | `/library` |
| Paper Detail | `PaperDetailView.jsx` | `/paper/:id` |
| Paper Reader | `PaperReader.jsx` | `/reader/:id` |
| Trackers | `TrackersView.jsx` | `/trackers` |
| Dashboards | `DashboardsView.jsx` | `/dashboards` |
| Foundry | `FoundryView.jsx` | `/foundry` |
| Governance | `GovernanceView.jsx` | `/governance` |

---

## 7. Prompt File Index

| File | Used By | Purpose |
|------|---------|---------|
| `chat.js` | `deepseek.js` | Default system prompts (ZH/EN) |
| `paperParser.js` | `aiPaperParser.js` | Batch crawl result → structured analysis |
| `paperSummarizer.js` | `paperSummarizer.js` | Paper abstract → 5-field summary |
| `aiTriage.js` | `aiTriage.js` | Crawled papers → relevance scoring |
| `htmlRenderer.js` | `htmlRenderer.js` | Paper + digest HTML page generation |
| `aiRouter.js` | `aiRouter.js` | Context injection + tracker gen |
| `searchPlan.js` | `searchPlanToParams.js` | NL query → structured search params |
| `standardCrawler.js` | `standardCrawler.js` | Crawler config suggestion |
| `paperAnalyzer.js` | `paperAnalyzer.js` | Metadata extraction, text summarization, claims, dedup |
| `contextEngine.js` | `contextEngine.js` | Relevance ranking |
| `appFactory.js` | `appFactory.js` | App spec + React code generation |
| `agentRunner.js` | `agentRunner.js` | Agent system prompt builder |
| `writing.js` | `routes/writing.js` | Related work draft generation |
| `dashboards.js` | `routes/dashboards.js` | Dashboard HTML generation |
| `foundry.js` | `routes/foundry.js` | Script code generation |
| `trackers.js` | `routes/trackers.js` | Tracker generation from topic |
| `worker.js` | `workers/runner.js` | Full-text paper analysis |
| `toolRegistry.js` | `toolRegistry.js` | Draft section tool prompt |
