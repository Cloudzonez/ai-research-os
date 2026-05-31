# Academic Radar — Agent Constitution

## What this project is

Academic Radar is a paper crawling and intelligence pipeline. The system:
1. Takes user research intent and converts it into structured search plans (via LLM)
2. Crawls multiple academic sources (arXiv, OpenAlex, Semantic Scholar, Crossref, PubMed)
3. Normalizes and deduplicates results across sources
4. Ranks papers by relevance, novelty, citation count, and recency
5. Runs an LLM reading layer to summarize, extract methods, and assess contributions
6. Stores everything in a knowledge base and presents it in an academic reader UI

Default: Chinese UI with English toggle. V1 targets hundreds to a few thousand
teachers at a single university.

## Tech stack

- **Frontend**: React 19, Vite 7, Tailwind CSS 3, Lucide icons
- **Backend**: Express 5, Mongoose 9 (MongoDB), Node.js ESM
- **AI**: DeepSeek API (`deepseek-v4-pro`) — configurable via env vars
- **Tests**: `node:test` + `node:assert/strict` (no Jest, no Mocha)
- **Package manager**: npm
- **No TypeScript compilation yet** — TS is in deps for IDE support; backend is `.js` ESM

## Project structure

```
src/                      # React frontend
  main.jsx                # Entry point
  components/
    App.jsx               # Root: auth gate, view router, global state
    views/
      TrackersView.jsx    # Tracker management (crawl config + trigger)
      LibraryView.jsx     # Paper library
      PaperDetailView.jsx # Single paper reader
      PaperReader.jsx     # Rich reading experience
    PaperHTMLView.jsx     # AI-generated paper HTML display
  utils/
    api.js                # Centralized API client (token handling, all endpoints)
    cn.js                 # Tailwind classname merge
  i18n/index.js           # zh/en copy strings
  types/                  # TypeScript interfaces for IDE support
    paper.ts, tracker.ts, crawler.ts, shared.ts, etc.

server/                   # Express backend (ESM)
  index.js                # App setup, MongoDB connect, route mounting
  config.js               # env vars (PORT, MONGO_URI, DEEPSEEK_API_KEY, etc.)
  middleware/
    auth.js               # JWT auth
  models/
    Paper.js              # Paper schema (metadata, triage, AI summary, HTML)
    Tracker.js            # Tracker/crawl configuration
    User.js
  routes/
    papers.js             # Paper CRUD, search, import
    trackers.js           # Tracker CRUD, execute crawls
  services/
    standardCrawler.js    # Multi-source crawl orchestrator
    trackerCrawl.js       # Tracker execution orchestration
    aiPaperParser.js      # AI parsing of crawled items
    paperSummarizer.js    # LLM paper summarization
    aiTriage.js           # AI triage for high-volume crawl results
    paperAnalyzer.js      # PDF text → structured summary
    contextEngine.js      # Paper retrieval + relevance ranking
    htmlRenderer.js       # Server-side HTML generation for papers
    deepseek.js           # DeepSeek API client
    queue.js              # Job queue (MongoDB-backed)
    rateLimiter.js        # Token bucket rate limiter (per-source)
    retryHandler.js       # Exponential backoff + jitter retry
    requestCache.js       # SHA-256 keyed LRU cache (per-source)
    citationSnowball.js   # BFS forward/backward citation search via S2
    ingestion/            # Source-specific API adapters (all wired with limiter+cache+retry)
      arxiv.js            # arXiv API (direct API call, ~3s)
      openalex.js         # OpenAlex API
      semanticScholar.js  # Semantic Scholar API
      github.js           # GitHub repository search
  workers/runner.js       # Queue worker process

tests/                    # Node.js test suite
  _helpers/
    mockMongooseModel.js  # In-memory mock for Mongoose models (DI pattern)
  story-2-tracker-crawl.test.js
  ai-triage.test.js
  paper-summarizer.test.js
```

## Key conventions

### Backend

- **ESM everywhere**: `import`/`export`, not `require`. Use `.js` extensions in imports.
- **Express 5**: `req.body` works without body-parser. Routes use `Router()`.
- **Mongoose**: Use `.lean()` for read queries. Models export the mongoose model directly.
- **Service dependency injection**: Services accept model classes as optional parameters
  (e.g., `{ PaperModel = Paper }` in options) so tests can inject mocks without module mocking.
- **API response shape**: `{ papers: [...] }`, `{ tracker: {...} }`, `{ success: true }`.
  Errors: `{ error: "message" }` with appropriate HTTP status.
- **Auth**: `authOptional` attaches `req.user` or `null`. `authRequired` returns 401.
- **Queue**: `enqueue(jobType, payload, opts)` — jobs stored in MongoDB, processed by worker.
- **Config**: All env vars through `config.js`. No `process.env` elsewhere.
- **No ORM magic**: Direct Mongoose operations. No abstraction layer between routes and models.

### Frontend

- **React 19 functional components** with hooks. No class components.
- **State lives in App.jsx**: papers, trackers, user. Passed down as props.
- **Centralized API client** (`src/utils/api.js`): auth token handling, all endpoints.
- **i18n**: `copy[locale]` object for all UI strings.
- **Styling**: Tailwind utility classes + reusable classes in `styles.css`.
- **Chinese first**: Default strings are in `zh`, `en` is secondary but complete.

### Tests

- **Runner**: `node:test` (`node --test tests/file.test.js`)
- **Assertions**: `node:assert/strict` (`assert.equal`, `assert.ok`, `assert.deepEqual`)
- **Mock pattern**: Use the `mockModel()` helper from `tests/_helpers/mockMongooseModel.js`.
  Inject it as a service parameter — never use module-level mocking.
- **Test files**: Named `{feature}.test.js`. Import the service function directly.

## Commands

```bash
npm install                        # Install dependencies
npm run dev                        # Vite dev server on port 5173
npm run dev:server                 # Express server on port 3001
npm run dev:all                    # Both concurrently
npm run dev:all:full               # Frontend + backend + worker
npm run build                      # Vite production build
node --test tests/token-flow.test.js  # Run a single test file
npm run test:services              # Core service tests
npm run test:backend               # All backend tests
```

The Vite dev server proxies `/api/*` to `localhost:3001`.
**Dev server binds IPv6** (`host: "::"` in vite.config.js) — access at `http://[::1]:5173` or `http://localhost:5173`.

## Environment quirks

- **Proxy interferes with CLI tools.** Set `NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost`
  before commands that make local network calls.
- **MongoDB socket file.** If MongoDB fails to start with "Failed to unlink socket
  file /tmp/mongodb-27017.sock", run `sudo rm -f /tmp/mongodb-27017.sock` first.
- **Sudo password** is `patrick` when needed for system-level operations.
- **VS Code Remote SSH.** This machine is accessed via VS Code Remote SSH. NEVER use
  `pkill` or `kill $(lsof -t -i:PORT)` to free ports — this can kill the VS Code
  server. To restart local dev servers safely, use:
  ```bash
  # Find only the specific PIDs
  lsof -i:3001 -t  # backend PID
  lsof -i:5173 -t  # frontend PID
  kill <PID> <PID>  # kill only those two
  ```
  Then restart in background so the process outlives the bash tool timeout:
  ```bash
  NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost nohup npm run dev:all > /tmp/devserver.log 2>&1 &
  ```

## Architecture constraints

1. **Modular monolith.** One Express process, one worker process. No microservices.
2. **ContextBundle before every AI call.** Always gather relevant papers before prompting
   the LLM. Never call the model with just raw user input.
3. **School is the default sharing boundary.** `sharing: "school"` is the default.
4. **Every output must trace back to sources.** No orphaned AI outputs.
5. **CPU servers, API tokens for AI.** No local GPU. All model calls go through DeepSeek API.
6. **No premature optimization for scale.** V1 is for hundreds of teachers, not millions.

## Academic Radar pipeline

```
User intent
  ↓
AI converts intent → structured search plan   (standardCrawler.suggestStandardCrawlerSpec)
  ↓
Paper API adapters                              (ingestion/*.js)
  OpenAlex / Semantic Scholar / arXiv / Crossref / PubMed
  ↓
Normalizer                                      (standardCrawler — DOI + title dedup)
  ↓
Ranking model                                   (contextEngine — relevance + citations + recency)
  ↓
LLM reading layer                               (paperSummarizer, aiTriage, aiPaperParser)
  ↓
Knowledge base                                  (Paper model → MongoDB)
  ↓
Academic Reader UI                              (PaperDetailView, PaperReader)
```

## How to build features

1. **Plan** — 1-page spec: what changes, which files, what the test proves.
2. **Define types** — add/update TypeScript interfaces in `src/types/`.
3. **Write spec test** — a `node:test` file that fails before implementation.
4. **Implement** — server route + service + model changes in one atomic commit.
5. **Verify** — run the tests: `node --test tests/{feature}.test.js`
6. **Browser test** — open `http://localhost:5173` and verify end-to-end.

Never skip the test step. The test IS the specification.

## Agent instructions

- Read `CLAUDE.md` before starting any task.
- When writing backend code, follow the service DI pattern (see `standardCrawler.js`).
- When writing tests, follow the pattern in `tests/story-2-tracker-crawl.test.js`.
- Import mock helper: `import { mockModel } from "./_helpers/mockMongooseModel.js";`
- When adding a new API route, add the corresponding client function in `src/utils/api.js`.
- When adding UI strings, add both `zh` and `en` entries in `src/i18n/index.js`.
- Never delete or rename existing API endpoints without updating the frontend API client.
- Commit messages in English, short, imperative mood.
