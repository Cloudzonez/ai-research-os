# AI Research OS — Agent Constitution

## What this project is

An AI-native research operating system for Chinese university teachers. One central
chat console can call website capabilities as tools, generate interactive UI blocks,
navigate to classic pages, and run multi-step research workflows.

**Not** a paper website with a chatbot attached. The chat box IS the operating surface.

Default: Chinese UI with English toggle. V1 targets hundreds to a few thousand
teachers at a single university.

## Tech stack

- **Frontend**: React 19, Vite 7, Tailwind CSS 3, Lucide icons
- **Backend**: Express 5, Mongoose 9 (MongoDB), Node.js ESM
- **AI**: DeepSeek API (`deepseek-v4-pro`) — configurable via env vars
- **Tests**: `node:test` + `node:assert/strict` (no Jest, no Mocha)
- **E2E**: Playwright
- **Package manager**: npm
- **No TypeScript compilation yet** — TS is in deps for IDE support; backend is `.js` ESM

## Project structure

```
src/                      # React frontend
  main.jsx                # Entry point
  components/
    App.jsx               # Root: auth gate, view router, global state
    views/
      AiCenter.jsx        # Chat console
      TrackersView.jsx    # Research tracker management
      LibraryView.jsx     # Paper library with upload
      WritingView.jsx     # Writing/draft workspace
      GovernanceView.jsx  # Admin: token usage, audit, MCP, sandbox
      FoundryView.jsx     # Code/app/crawler generation
    Navigation.jsx        # Left sidebar nav
    ContextPanel.jsx      # Right rail: context display
    Header.jsx, Toast.jsx, ErrorBoundary.jsx, etc.
  utils/
    api.js                # Centralized API client (token handling, all endpoints)
    cn.js                 # Tailwind classname merge
  i18n/index.js           # zh/en copy strings
  data/                   # Static data (route templates, quick prompts)
  styles.css              # Tailwind layers + reusable button classes

server/                   # Express backend (ESM)
  index.js                # App setup, MongoDB connect, route mounting
  config.js               # env vars (PORT, MONGO_URI, DEEPSEEK_API_KEY, etc.)
  middleware/
    auth.js               # JWT auth: authRequired, adminRequired, authOptional
    approval.js           # High-risk action approval gate
  models/                 # Mongoose schemas
    User.js, Paper.js, Tracker.js, CrawlerPlugin.js, AIAction.js, etc.
  routes/                 # Express routers
    auth.js, chat.js, papers.js, trackers.js, crawlers.js, writing.js, etc.
  services/               # Business logic (NOT tied to Express req/res)
    contextEngine.js      # buildContextBundle — paper retrieval + relevance ranking
    tokenFlow.js          # Budget check, usage recording, stats
    deepseek.js           # DeepSeek API client
    aiRouter.js           # Command classification + tool dispatch
    paperAnalyzer.js      # PDF text → structured summary via AI
    standardCrawler.js    # Multi-source crawler (arXiv, OpenAlex, Semantic Scholar)
    trackerCrawl.js       # Tracker execution orchestration
    sandbox.js            # Code execution sandbox
    queue.js              # Job queue (MongoDB-backed)
    storage.js            # File storage (local disk for now)
    ingestion/            # Source-specific connectors
      arxiv.js, openalex.js, semanticScholar.js, github.js
  workers/runner.js       # Queue worker process

tests/                    # Node.js test suite
  _helpers/
    mockMongooseModel.js  # In-memory mock for Mongoose models (DI pattern)
  context-engine.test.js, token-flow.test.js, etc.
  e2e/                    # Playwright tests
  routes/                 # Route-level integration tests

docs/                     # Architecture and planning documents
  ARCHITECTURE.md, BUILD_PLAN.md, NEW_RESEARCH_AI_PLAN.md, etc.
```

## Key conventions

### Backend

- **ESM everywhere**: `import`/`export`, not `require`. Use `.js` extensions in imports.
- **Express 5**: `req.body` works without body-parser. Routes use `Router()`.
- **Mongoose**: Use `.lean()` for read queries. Models export the mongoose model directly.
- **Service dependency injection**: Services accept model classes as optional parameters
  (e.g., `{ UserModel = User }` in options) so tests can inject mocks without module mocking.
- **API response shape**: `{ papers: [...] }`, `{ tracker: {...} }`, `{ success: true }`.
  Errors: `{ error: "message" }` with appropriate HTTP status.
- **Auth**: `authOptional` attaches `req.user` or `null`. `authRequired` returns 401.
  `adminRequired` returns 403.
- **Queue**: `enqueue(jobType, payload, opts)` — jobs stored in MongoDB, processed by worker.
- **Config**: All env vars through `config.js`. No `process.env` elsewhere.
- **No ORM magic**: Direct Mongoose operations. No abstraction layer between routes and models.

### Frontend

- **React 19 functional components** with hooks. No class components.
- **State lives in App.jsx**: papers, trackers, messages, user. Passed down as props.
  Views don't fetch their own data.
- **Centralized API client** (`src/utils/api.js`): auth token handling, all endpoints.
- **i18n**: `copy[locale]` object for all UI strings. `t` passed as prop or from context.
- **Styling**: Tailwind utility classes + a few reusable classes in `styles.css`.
- **Chinese first**: Default strings are in `zh`, `en` is secondary but complete.

### Tests

- **Runner**: `node:test` (`node --test tests/file.test.js`)
- **Assertions**: `node:assert/strict` (`assert.equal`, `assert.ok`, `assert.deepEqual`)
- **Mock pattern**: Use the `mockModel()` helper from `tests/_helpers/mockMongooseModel.js`.
  It returns an in-memory object with `findById`, `findOne`, `create`, `find`, etc.
  Inject it as a service parameter — never use module-level mocking.
- **Test files**: Named `{service-name}.test.js`. Import the service function directly.
- **Spec reference**: Each test file has a comment linking to the ARCHITECTURE.md or BUILD_PLAN.md section.
- **Running tests**: `npm run test:services`, `npm run test:backend`, or individual:
  `node --test tests/token-flow.test.js`

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

## Architecture constraints (DO NOT VIOLATE)

1. **Modular monolith, not microservices.** One Express process, one worker process.
   Don't introduce service meshes, RPC frameworks, or separate deployables.
2. **ContextBundle before every AI call.** Always run `buildContextBundle` to gather
   permitted papers/artifacts before sending a prompt to DeepSeek. Never call the model
   with just the user's raw input.
3. **School is the default sharing boundary.** `sharing: "school"` is the default.
   Private, project, and university scopes exist but school is the norm.
4. **Low-risk actions auto-execute; high-risk need approval.** Broad sharing, deletion,
   publishing, expensive model calls (>50K tokens), and crawler deployment require approval.
5. **Every chart/conclusion must trace back to data, code, and literature.**
   No orphaned AI outputs.
6. **Chinese-first, English-complete.** All UI copy must exist in both languages.
7. **CPU servers, API tokens for AI.** No local GPU. All model calls go through DeepSeek API.
8. **No premature optimization for scale.** V1 is for hundreds of teachers, not millions.
9. **Always keep the dev server running and hot-reloading.** After every feature or fix,
   run `npm run dev:all` (frontend + backend concurrently). Vite proxies `/api` to
   Express on port 3001, so the user only ever hits port 5173. If the server is already
   running, kill the old processes first. The user must be able to test their change
   immediately in the browser at `http://localhost:5173`.

## How to build features (the workflow)

For every non-trivial change, follow this sequence:

1. **Plan** — 1-page spec: what changes, which files, what the test proves.
2. **Define types** — add/update TypeScript interfaces in `src/types/`.
3. **Write spec test** — a `node:test` file that fails before implementation.
4. **Implement** — server route + service + model changes in one atomic commit.
5. **Restart dev server** — run `npm run dev:all` so the change is hot-reloaded and
   testable immediately at `http://localhost:5173`. If a dev server is already running,
   kill it first (`pkill -f "vite"` and `pkill -f "node server"`).
6. **Verify** — run the tests: `node --test tests/{feature}.test.js`
7. **Browser test** — open `http://localhost:5173` and verify the feature works
   end-to-end in the browser. For UI changes, test both Chinese and English.
8. **Review** — spawn a fresh agent to review the diff for consistency and correctness.

Never skip the test step. The test IS the specification. Never skip the browser
verification. What passes unit tests can still be broken in the browser.

## Agent instructions

- Read `CLAUDE.md` before starting any task. This file is your operating manual.
- **After every code change**, restart the dev server with `npm run dev:all` so the
  user sees the update immediately at `http://localhost:5173`. Kill any existing dev
  server processes first (`pkill -f "vite"`; `pkill -f "node server/index.js"`).
- The user only ever opens `http://localhost:5173` — Vite proxies `/api` to Express
  on port 3001. Never tell the user to open port 3001 directly.
- Read `docs/ARCHITECTURE.md` for high-level design rationale.
- Read `docs/BUILD_PLAN.md` for the phased implementation roadmap.
- When writing backend code, follow the service DI pattern seen in `tokenFlow.js` and `contextEngine.js`.
- When writing tests, follow the pattern in `tests/context-engine.test.js` and `tests/token-flow.test.js`.
- Import mock helper: `import { mockModel } from "./_helpers/mockMongooseModel.js";`
- When adding a new API route, add the corresponding client function in `src/utils/api.js`.
- When adding UI strings, add both `zh` and `en` entries in `src/i18n/index.js`.
- Never delete or rename existing API endpoints without updating the frontend API client.
- Commit messages in English, short, imperative mood. One commit per feature slice.
