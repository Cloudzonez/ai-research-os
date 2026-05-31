# Academic Radar — Project File Structure & Purpose

> Auto-generated 2026-05-25. Describes every file in the repo and what it's used for.

---

## Root Directory

| Path | Purpose |
|---|---|
| `package.json` | Project manifest: npm scripts, dependencies (React 19, Express 5, Mongoose 9, DeepSeek), ESM mode |
| `package-lock.json` | Locked dependency tree |
| `index.html` | Vite HTML entry point — mounts the React app at `#root` |
| `vite.config.js` | Vite 7 config: React plugin, dev server on port 5173, proxies `/api/*` → `localhost:3001` |
| `tailwind.config.js` | Tailwind CSS 3 config — scans `src/` for utility classes |
| `postcss.config.js` | PostCSS with Tailwind + Autoprefixer |
| `tsconfig.json` | TypeScript config — `allowJs`, JSX support, path aliases. TS is only for IDE intellisense; no compilation |
| `playwright.config.js` | Playwright E2E test config — Chromium, web server on port 5179 |
| `.env` | Environment variables (DEEPSEEK_API_KEY, MONGO_URI, etc.) — gitignored |
| `.gitignore` | Ignores `node_modules/`, `dist/`, `.env`, `uploads/`, `test-results/`, `_backup/`, `.cache/` |
| `ecosystem.config.cjs` | PM2 process config for production deployment |
| `CLAUDE.md` | Agent constitution — project overview, conventions, commands for Claude Code |
| `README.md` | Human-facing project overview and quickstart |

---

## `src/` — React Frontend

### Entry & Core

| File | Purpose |
|---|---|
| [src/main.jsx](../src/main.jsx) | React entry point — renders `<App />` into `#root` |
| [src/components/App.jsx](../src/components/App.jsx) | Root component: auth gate, view router (AiCenter, Trackers, Library, Writing, Governance, Foundry, PaperDetail), global state (papers, trackers, crawlers, messages, user, theme, locale), keyboard shortcuts (Ctrl+1-6 for views) |

### View Components (`src/components/views/`)

| File | Purpose |
|---|---|
| [AiCenter.jsx](../src/components/views/AiCenter.jsx) | Chat-first AI console — user types natural language commands, AI routes to trackers/crawlers/writing/drafts |
| [TrackersView.jsx](../src/components/views/TrackersView.jsx) | Tracker management UI — create, list, and trigger research paper trackers |
| [LibraryView.jsx](../src/components/views/LibraryView.jsx) | Paper library — browse, filter, upload PDFs, select papers for reading |
| [PaperDetailView.jsx](../src/components/views/PaperDetailView.jsx) | Single paper detail — metadata, AI summary, actions (summarize, analyze) |
| [WritingView.jsx](../src/components/views/WritingView.jsx) | Writing studio — generate and edit research drafts (related work, etc.) |
| [GovernanceView.jsx](../src/components/views/GovernanceView.jsx) | Admin/governance dashboard — system health, token usage, crawler plugins |
| [FoundryView.jsx](../src/components/views/FoundryView.jsx) | AI Foundry — generate mini-apps and scripts from natural language descriptions |

### Shared Components

| File | Purpose |
|---|---|
| [Header.jsx](../src/components/Header.jsx) | Top bar: product name, locale toggle (zh/en), theme toggle (light/dark), context panel toggle, user menu |
| [Navigation.jsx](../src/components/Navigation.jsx) | Left sidebar: view navigation links, usage stats (trackers, token budget, assets, monthly %) |
| [ContextPanel.jsx](../src/components/ContextPanel.jsx) | Right slide-out panel: shows current task context (papers, trackers, crawlers, health) |
| [PaperChat.jsx](../src/components/PaperChat.jsx) | Chat interface scoped to a single paper — ask questions about a specific paper |
| [PaperHTMLView.jsx](../src/components/PaperHTMLView.jsx) | Renders AI-generated HTML for rich paper display (structured summaries, evidence cards) |
| [PaperReader.jsx](../src/components/PaperReader.jsx) | Full academic reading experience — paper content + AI chat + context |
| [MessageCard.jsx](../src/components/MessageCard.jsx) | Chat message bubble — renders different message kinds (general, tracker, crawler, paper summary, writing draft) |
| [Workspace.jsx](../src/components/Workspace.jsx) | Chat workspace layout — message list + input area |
| [RightRail.jsx](../src/components/RightRail.jsx) | Right-side panel for context and additional info in chat view |
| [InfoPanel.jsx](../src/components/InfoPanel.jsx) | Info/help panel for user guidance |
| [Login.jsx](../src/components/Login.jsx) | Login/register form — email, password, name, role |
| [Toast.jsx](../src/components/Toast.jsx) | Toast notification system (success/error/info) — provides `ToastProvider` + `useToast` hook |
| [LoadingStates.jsx](../src/components/LoadingStates.jsx) | Reusable loading skeletons and spinners |
| [ErrorBoundary.jsx](../src/components/ErrorBoundary.jsx) | React error boundary — catches render errors, shows fallback UI |

### Utilities

| File | Purpose |
|---|---|
| [src/utils/api.js](../src/utils/api.js) | Centralized API client — all backend endpoints (auth, chat, papers, trackers, writing, crawlers, foundry, health), JWT token handling, file upload base64 encoding, SSE streaming support |
| [src/utils/cn.js](../src/utils/cn.js) | Tailwind classname merge utility (deduplicates conflicting classes) |
| [src/utils/sharingLabel.js](../src/utils/sharingLabel.js) | Sharing level label helper (private/project/school/university) |

### Data & Config

| File | Purpose |
|---|---|
| [src/data/quickPrompts.js](../src/data/quickPrompts.js) | Predefined quick-action prompts shown in the AI Center (create tracker, process PDF, write related work, generate crawler) |
| [src/data/routeTemplates.js](../src/data/routeTemplates.js) | AI command routing templates — maps user intent patterns to response kinds |

### Internationalization

| File | Purpose |
|---|---|
| [src/i18n/index.js](../src/i18n/index.js) | All UI copy strings in `zh` (Chinese, default) and `en` (English) — product name, navigation labels, button text, toast messages, form placeholders |

### TypeScript Types (`src/types/`)

> For IDE intellisense only — not compiled.

| File | Purpose |
|---|---|
| [paper.ts](../src/types/paper.ts) | Paper interfaces: metadata, AI summary, triage fields, evidence cards, status |
| [tracker.ts](../src/types/tracker.ts) | Tracker interfaces: crawl config, cadence, sources, signals, status |
| [crawler.ts](../src/types/crawler.ts) | Crawler plugin interfaces: source adapters, parser spec, tests |
| [shared.ts](../src/types/shared.ts) | Shared types: pagination, API response wrappers, sharing enums |
| [api.ts](../src/types/api.ts) | API request/response shapes |
| [ai-action.ts](../src/types/ai-action.ts) | AI action interfaces: tool calls, approval requests, sandbox execution |
| [context.ts](../src/types/context.ts) | Context bundle types: papers, tokens, tiers, escalation |
| [artifact.ts](../src/types/artifact.ts) | Artifact types: generated apps, scripts, research objects |
| [user.ts](../src/types/user.ts) | User types: role, quota, preferences |
| [writing.ts](../src/types/writing.ts) | Writing draft types |
| [index.ts](../src/types/index.ts) | Barrel re-export of all types |

### Styles

| File | Purpose |
|---|---|
| [src/styles.css](../src/styles.css) | Global CSS — Tailwind directives (`@tailwind base/components/utilities`), custom reusable classes, scrollbar styling |

---

## `server/` — Express Backend

### Entry

| File | Purpose |
|---|---|
| [server/index.js](../server/index.js) | Express app setup: CORS, JSON parsing, static file serving, route mounting (9 route modules), MongoDB connection, server start on port 3001 |
| [server/config.js](../server/config.js) | All env vars centralized: PORT, MONGO_URI, DEEPSEEK_API_KEY, model names (chat/code/crawler/summary), paper search provider API keys, AUTH_SECRET, STORAGE_PATH |

### Middleware

| File | Purpose |
|---|---|
| [server/middleware/auth.js](../server/middleware/auth.js) | JWT authentication: `authRequired` (returns 401), `authOptional` (attaches user or null), `adminRequired` (returns 403), `generateToken` |
| [server/middleware/approval.js](../server/middleware/approval.js) | Action approval/audit logging — records AI actions (chat, tool calls) with risk level, tokens used, user context |

### Models (Mongoose/MongoDB)

| File | Purpose |
|---|---|
| [server/models/Paper.js](../server/models/Paper.js) | Paper schema: title, authors, abstract, DOI, source IDs (cross-source dedup), AI summary fields (tldr/motivation/method/result/conclusion), triage (relevance/novelty/category), evidence cards, HTML page, full text, status pipeline (parsing→parsed→summarized→error) |
| [server/models/Tracker.js](../server/models/Tracker.js) | Tracker schema: name, cadence (Daily/Weekly/Monthly), keywords, sources, signals, crawl status, last crawl results |
| [server/models/User.js](../server/models/User.js) | User schema: email, passwordHash, name, role (teacher/admin), school, quota/usage, preferences, active status |
| [server/models/Message.js](../server/models/Message.js) | Chat message schema: role (user/assistant), kind (general/tracker/crawler/pdf/write), text, sessionId, contextBundle |
| [server/models/CrawlerPlugin.js](../server/models/CrawlerPlugin.js) | Crawler plugin schema: name, description, crawlerKind, crawlerSpec, sourceConfig, parserCode, tests, active/approved status, owner |
| [server/models/AgentSpec.js](../server/models/AgentSpec.js) | Agent specification schema: name, description, tools, system prompt, model config |
| [server/models/AIAction.js](../server/models/AIAction.js) | AI action log schema: action type, model, input/output, tokens, risk level, approval status |
| [server/models/ToolDefinition.js](../server/models/ToolDefinition.js) | MCP tool definition schema: name, description, input schema, handler |
| [server/models/ExecutableResearchObject.js](../server/models/ExecutableResearchObject.js) | Research object schema: executable research artifacts with code, data, and environment |
| [server/models/GeneratedApp.js](../server/models/GeneratedApp.js) | AI-generated app schema (Foundry): name, description, source code, preview |
| [server/models/GeneratedScript.js](../server/models/GeneratedScript.js) | AI-generated script schema (Foundry): name, language, source code |
| [server/models/School.js](../server/models/School.js) | School/tenant schema: name, domain, member count, settings |
| [server/models/EvalSuite.js](../server/models/EvalSuite.js) | Evaluation suite schema: test cases for AI output quality assessment |

### Routes

| File | Purpose |
|---|---|
| [server/routes/chat.js](../server/routes/chat.js) | Chat API: `POST /api/chat` (non-streaming), `POST /api/chat/stream` (SSE streaming with step/token/done events), `GET /api/chat/messages` (message history) |
| [server/routes/papers.js](../server/routes/papers.js) | Papers API: CRUD, upload PDF, ingest from sources, analyze, summarize, HTML generation, search |
| [server/routes/trackers.js](../server/routes/trackers.js) | Trackers API: CRUD, generate tracker config via AI, execute crawl |
| [server/routes/writing.js](../server/routes/writing.js) | Writing API: generate drafts (related work, etc.) via AI |
| [server/routes/crawlers.js](../server/routes/crawlers.js) | Crawler plugins API: list, generate from description |
| [server/routes/foundry.js](../server/routes/foundry.js) | AI Foundry API: generate apps and scripts, list generated artifacts, stats |
| [server/routes/auth.js](../server/routes/auth.js) | Auth API: register, login, get current user (me) |
| [server/routes/approvals.js](../server/routes/approvals.js) | Approvals API: list, approve, reject pending AI actions |
| [server/routes/mcp.js](../server/routes/mcp.js) | MCP (Model Context Protocol) API: list tools, execute tool calls |
| [server/routes/health.js](../server/routes/health.js) | Health check: `GET /api/health` — returns server status, DB state, uptime |

### Services

#### Core AI Pipeline

| File | Purpose |
|---|---|
| [server/services/deepseek.js](../server/services/deepseek.js) | DeepSeek API client: `chat()` (non-streaming), `chatStream()` (SSE streaming), `parseResponse()` (extracts kind/text/context from model output) |
| [server/services/aiRouter.js](../server/services/aiRouter.js) | Main AI router: `routeChat()` and `routeChatStream()` — builds context bundle, checks token budget, calls DeepSeek, parses response kind (general/tracker/crawler/write), handles tier escalation, creates side effects (trackers, crawlers, drafts) |
| [server/services/contextEngine.js](../server/services/contextEngine.js) | Context retrieval: `buildContextBundle()` — gathers relevant papers for a query based on tier level (0-4), token budget, and user permissions |
| [server/services/contextTiers.js](../server/services/contextTiers.js) | Context tier definitions (0=title only, 1=+abstract, 2=+summary/contributions/methods, 3=+evidence cards, 4=+full text chunks) |
| [server/services/tokenFlow.js](../server/services/tokenFlow.js) | Token budget management: `checkBudget()` (quota enforcement), `recordUsage()` (track spending per user) |

#### Paper Search & Ingestion

| File | Purpose |
|---|---|
| [server/services/paperSearch/index.js](../server/services/paperSearch/index.js) | `UnifiedPaperSearch` class: orchestrates multi-source paper search across 6 providers with timeout, dedup, ranking. Singleton via `getSearchService()` |
| [server/services/paperSearch/BaseProvider.js](../server/services/paperSearch/BaseProvider.js) | Abstract base class for search providers — defines `search()`, `getPaper()`, `getCitations()`, `getReferences()` interface |
| [server/services/paperSearch/providers/arxiv.js](../server/services/paperSearch/providers/arxiv.js) | arXiv API provider — search and paper lookup |
| [server/services/paperSearch/providers/openalex.js](../server/services/paperSearch/providers/openalex.js) | OpenAlex API provider |
| [server/services/paperSearch/providers/semanticScholar.js](../server/services/paperSearch/providers/semanticScholar.js) | Semantic Scholar API provider |
| [server/services/paperSearch/providers/crossref.js](../server/services/paperSearch/providers/crossref.js) | Crossref API provider |
| [server/services/paperSearch/providers/pubmed.js](../server/services/paperSearch/providers/pubmed.js) | PubMed API provider |
| [server/services/paperSearch/providers/unpaywall.js](../server/services/paperSearch/providers/unpaywall.js) | Unpaywall API provider — enriches papers with OA PDF URLs |
| [server/services/paperSearch/deduplicator.js](../server/services/paperSearch/deduplicator.js) | Paper deduplication — DOI-based + title fuzzy matching, cross-DB duplicate detection |
| [server/services/paperSearch/normalizer.js](../server/services/paperSearch/normalizer.js) | Paper data normalizer — standardizes fields from different providers into a common schema |
| [server/services/paperSearch/ranking.js](../server/services/paperSearch/ranking.js) | Paper ranking — scores by relevance (keyword match), citations, recency |
| [server/services/paperSearch/rateLimiter.js](../server/services/paperSearch/rateLimiter.js) | Rate limiter for external API calls |
| [server/services/paperSearch/retryHandler.js](../server/services/paperSearch/retryHandler.js) | Retry logic with exponential backoff for external API failures |
| [server/services/paperSearch/searchPlanToParams.js](../server/services/paperSearch/searchPlanToParams.js) | Converts AI-generated search plans into provider-specific query parameters |

#### Legacy Ingestion Adapters

| File | Purpose |
|---|---|
| [server/services/ingestion/arxiv.js](../server/services/ingestion/arxiv.js) | arXiv API adapter — search and crawl (fallback when paperSearch module unavailable) |
| [server/services/ingestion/openalex.js](../server/services/ingestion/openalex.js) | OpenAlex adapter (fallback) |
| [server/services/ingestion/semanticScholar.js](../server/services/ingestion/semanticScholar.js) | Semantic Scholar adapter (fallback) |
| [server/services/ingestion/github.js](../server/services/ingestion/github.js) | GitHub repository search adapter |

#### Paper Processing

| File | Purpose |
|---|---|
| [server/services/paperSummarizer.js](../server/services/paperSummarizer.js) | LLM paper summarization — generates structured summaries (TLDR, motivation, method, results, conclusion) |
| [server/services/paperAnalyzer.js](../server/services/paperAnalyzer.js) | PDF text → structured analysis: extracts methods, contributions, limitations, evidence cards |
| [server/services/aiPaperParser.js](../server/services/aiPaperParser.js) | AI-powered paper parsing — normalizes crawled items using LLM to extract structured metadata |
| [server/services/aiTriage.js](../server/services/aiTriage.js) | AI triage for high-volume crawls — classifies papers by relevance, novelty, category to filter noise |
| [server/services/htmlRenderer.js](../server/services/htmlRenderer.js) | Server-side HTML generation — creates rich, styled HTML pages for papers with AI summaries |
| [server/services/textChunker.js](../server/services/textChunker.js) | Splits paper full text into overlapping chunks for context retrieval |
| [server/services/pdfDownloader.js](../server/services/pdfDownloader.js) | Batch PDF downloader — fetches PDFs from URLs for crawled papers |

#### Crawler Orchestration

| File | Purpose |
|---|---|
| [server/services/standardCrawler.js](../server/services/standardCrawler.js) | Standard crawler orchestrator: `suggestStandardCrawlerSpec()` (AI generates crawl config), `buildStandardCrawlerSpec()` (normalizes config), `runStandardCrawler()` (4-phase pipeline: fetch → parse → dedup/store → PDF download) |
| [server/services/trackerCrawl.js](../server/services/trackerCrawl.js) | Tracker execution — runs a tracker's crawl config, processes results, updates tracker status |
| [server/services/crawlerFactory.js](../server/services/crawlerFactory.js) | Crawler plugin factory — instantiates crawlers from plugin specs |

#### Agent & Tool System

| File | Purpose |
|---|---|
| [server/services/agentRunner.js](../server/services/agentRunner.js) | Agent execution engine — runs agent specs against user tasks, tracks state (created→context_built→tool_calling→awaiting_approval→running_sandbox→completed→failed), trace/replay |
| [server/services/toolRegistry.js](../server/services/toolRegistry.js) | MCP tool registry — register, discover, and execute tools |
| [server/services/mcpGateway.js](../server/services/mcpGateway.js) | MCP gateway — manages MCP server connections and tool discovery |
| [server/services/sandbox.js](../server/services/sandbox.js) | Code sandbox — safely executes AI-generated code (crawler parsers, foundry scripts) |

#### Infrastructure

| File | Purpose |
|---|---|
| [server/services/queue.js](../server/services/queue.js) | MongoDB-backed job queue — `enqueue()`, `dequeue()`, job types (summarize_paper, analyze_paper, run_tracker) |
| [server/services/cache.js](../server/services/cache.js) | In-memory cache — TTL-based caching for context bundles, chat responses, search results |
| [server/services/storage.js](../server/services/storage.js) | File storage abstraction — manages uploaded PDFs |
| [server/services/modelMesh.js](../server/services/modelMesh.js) | Model routing mesh — routes AI requests to appropriate models (chat/code/crawler/summary) based on task type |
| [server/services/appFactory.js](../server/services/appFactory.js) | AI Foundry app generator — generates mini React apps from natural language descriptions |
| [server/services/evalRunner.js](../server/services/evalRunner.js) | Evaluation runner — executes eval suites to measure AI output quality |

### Workers

| File | Purpose |
|---|---|
| [server/workers/runner.js](../server/workers/runner.js) | Queue worker process — polls MongoDB for queued jobs, executes them (summarization, analysis, tracker crawls), handles retries and failure |

---

## `tests/` — Test Suite (node:test)

### Service Tests

| File | Purpose |
|---|---|
| [tests/deepseek-parse.test.js](../tests/deepseek-parse.test.js) | Tests DeepSeek response parsing |
| [tests/model-mesh.test.js](../tests/model-mesh.test.js) | Tests model routing mesh |
| [tests/sandbox-validate.test.js](../tests/sandbox-validate.test.js) | Tests code sandbox validation |
| [tests/approval-pure.test.js](../tests/approval-pure.test.js) | Tests approval/audit logic |
| [tests/cache-service.test.js](../tests/cache-service.test.js) | Tests cache service |
| [tests/token-flow.test.js](../tests/token-flow.test.js) | Tests token budget/quota system |
| [tests/queue-service.test.js](../tests/queue-service.test.js) | Tests job queue (enqueue/dequeue) |
| [tests/storage-service.test.js](../tests/storage-service.test.js) | Tests file storage service |
| [tests/paper-analyzer.test.js](../tests/paper-analyzer.test.js) | Tests paper analysis pipeline |
| [tests/context-engine.test.js](../tests/context-engine.test.js) | Tests context bundle building |
| [tests/context-escalation.test.js](../tests/context-escalation.test.js) | Tests tier escalation logic |
| [tests/context-tiers.test.js](../tests/context-tiers.test.js) | Tests context tier definitions |
| [tests/standard-crawler.test.js](../tests/standard-crawler.test.js) | Tests standard crawler spec building |
| [tests/connector-parser.test.js](../tests/connector-parser.test.js) | Tests source connector parsing |
| [tests/tracker-crawl.test.js](../tests/tracker-crawl.test.js) | Tests tracker crawl execution |
| [tests/ai-crawler-pipeline.test.js](../tests/ai-crawler-pipeline.test.js) | Tests AI crawler pipeline end-to-end |
| [tests/tool-registry.test.js](../tests/tool-registry.test.js) | Tests MCP tool registry |
| [tests/mcp-gateway.test.js](../tests/mcp-gateway.test.js) | Tests MCP gateway |
| [tests/agent-runner.test.js](../tests/agent-runner.test.js) | Tests agent execution engine |
| [tests/text-chunker.test.js](../tests/text-chunker.test.js) | Tests text chunking |
| [tests/live-standard-crawler.test.js](../tests/live-standard-crawler.test.js) | Live crawler integration test (opt-in via LIVE_CRAWLER_TEST=1) |

### Story/Acceptance Tests

| File | Purpose |
|---|---|
| [tests/story-1-pdf-pipeline.test.js](../tests/story-1-pdf-pipeline.test.js) | Story 1: PDF upload → parse → summarize pipeline |
| [tests/story-2-tracker-crawl.test.js](../tests/story-2-tracker-crawl.test.js) | Story 2: Tracker creation → crawl execution → results |
| [tests/story-3-context-chat.test.js](../tests/story-3-context-chat.test.js) | Story 3: Context-aware chat with paper references |

### Feature Tests

| File | Purpose |
|---|---|
| [tests/academic-reader-qa.test.js](../tests/academic-reader-qa.test.js) | Academic reader Q&A feature tests |
| [tests/ai-triage.test.js](../tests/ai-triage.test.js) | AI triage classification tests |
| [tests/paper-search.test.js](../tests/paper-search.test.js) | Unified paper search tests |
| [tests/paper-summarizer.test.js](../tests/paper-summarizer.test.js) | Paper summarization tests |
| [tests/auth-middleware.test.js](../tests/auth-middleware.test.js) | Auth middleware tests |
| [tests/worker-runner.test.js](../tests/worker-runner.test.js) | Queue worker tests |

### Route Tests

| File | Purpose |
|---|---|
| [tests/routes/health.test.js](../tests/routes/health.test.js) | Health endpoint tests |

### E2E Tests (Playwright)

| File | Purpose |
|---|---|
| [tests/e2e/login.spec.js](../tests/e2e/login.spec.js) | Login/register flow E2E |
| [tests/e2e/paper-library.spec.js](../tests/e2e/paper-library.spec.js) | Paper library browsing E2E |
| [tests/e2e/foundry.spec.js](../tests/e2e/foundry.spec.js) | AI Foundry E2E |
| [tests/e2e/governance.spec.js](../tests/e2e/governance.spec.js) | Governance dashboard E2E |
| [tests/e2e/writing.spec.js](../tests/e2e/writing.spec.js) | Writing studio E2E |
| [tests/e2e/local-first-workflow.spec.js](../tests/e2e/local-first-workflow.spec.js) | Local-first workflow E2E |
| [tests/e2e/error-states.spec.js](../tests/e2e/error-states.spec.js) | Error state handling E2E |
| [tests/e2e/preferences.spec.js](../tests/e2e/preferences.spec.js) | User preferences E2E |

### Test Helpers

| File | Purpose |
|---|---|
| [tests/_helpers/mockMongooseModel.js](../tests/_helpers/mockMongooseModel.js) | In-memory Mongoose model mock for dependency injection in tests |
| [tests/_helpers/mockDeepSeek.js](../tests/_helpers/mockDeepSeek.js) | DeepSeek API mock for tests |

---

## Other Directories

| Directory | Purpose |
|---|---|
| `dist/` | Vite production build output (static HTML/JS/CSS) |
| `node_modules/` | npm dependencies (gitignored) |
| `uploads/` | Uploaded PDF files (gitignored) |
| `test-results/` | Playwright test run artifacts (gitignored) |
| `.cache/` | Runtime cache files — e.g., arXiv seen-IDs cache (gitignored) |
| `.claude/` | Claude Code config: settings.json, memory, plans |
| `deploy/` | Deployment scripts and configs |
| `scripts/` | Utility scripts |
| `_backup/` | Archived/legacy files — old docs, reference AI-Researcher codebase, benchmark data (gitignored) |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React 19 + Vite 7)                            │
│  ┌─────────┐ ┌──────────┐ ┌───────┐ ┌───────────────┐  │
│  │AiCenter │ │Trackers  │ │Library│ │Writing/Foundry│  │
│  │(chat)   │ │View      │ │View   │ │/Governance    │  │
│  └────┬────┘ └────┬─────┘ └───┬───┘ └───────┬───────┘  │
│       └───────────┴────────────┴─────────────┘          │
│                        │ api.js (fetch + JWT)            │
└────────────────────────┼────────────────────────────────┘
                         │ /api/*
┌────────────────────────┼────────────────────────────────┐
│  Express 5 Server      │                                │
│  ┌─────────────────────┼──────────────────────────┐     │
│  │  Routes: chat, papers, trackers, writing,      │     │
│  │  crawlers, foundry, auth, approvals, mcp       │     │
│  └─────────────────────┼──────────────────────────┘     │
│  ┌─────────────────────┼──────────────────────────┐     │
│  │  Services:                                       │     │
│  │  aiRouter ──→ deepseek (LLM API)                │     │
│  │  contextEngine ──→ contextTiers                 │     │
│  │  standardCrawler ──→ paperSearch (6 providers)  │     │
│  │  paperSummarizer, aiTriage, paperAnalyzer       │     │
│  │  agentRunner, toolRegistry, mcpGateway          │     │
│  │  queue, cache, tokenFlow, modelMesh             │     │
│  └─────────────────────────────────────────────────┘     │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Models (Mongoose): Paper, Tracker, User,        │    │
│  │  Message, CrawlerPlugin, AgentSpec, etc.         │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────┐
│  External APIs         │                                │
│  DeepSeek  │  arXiv  │  OpenAlex  │  Semantic Scholar   │
│  Crossref  │  PubMed │  Unpaywall │  GitHub             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Worker Process (runner.js)                              │
│  Polls queue ──→ summarize_paper, analyze_paper,        │
│  run_tracker, generate_html                              │
└─────────────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────────┐
│  MongoDB                                                │
│  papers, trackers, users, messages, crawlerplugins,     │
│  queue jobs, approvals, agentspecs, etc.                │
└─────────────────────────────────────────────────────────┘
```
