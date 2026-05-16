# User Stories — Vertical Slices

Each story is a complete vertical slice: UI → API → Service → Model → Test.
The spec test is written FIRST, fails, then implementation makes it pass.

---

## Story 1: PDF Upload → AI Parse → Structured Display

**As a** teacher,
**I want to** upload a PDF paper and have the AI extract its title, abstract,
contributions, methods, and limitations,
**so that** I can quickly understand papers without reading them in full.

### Acceptance criteria

1. Teacher selects a PDF file → file is sent to server → stored on disk
2. Server extracts full text using pdf-parse → stores in Paper.text
3. A summarization job is enqueued → worker picks it up → calls DeepSeek
4. DeepSeek returns structured JSON with: title, abstract, contributions,
   methods, limitations, datasets
5. Paper record is updated with parsed fields → status changes to "summarized"
6. Frontend library shows the paper with all extracted fields
7. If PDF text extraction fails → paper status is "error" with a message
8. Duplicate PDFs (by text fingerprint) are rejected, existing record returned

### Spec test file: `tests/story-1-pdf-pipeline.test.js`

Tests to write:
- `POST /api/papers/upload` with a real PDF → returns paper with status "parsed"
- After worker processes the job → paper status is "summarized" with summary
- Duplicate upload → returns existing paper (not a new one)
- Corrupt PDF → status "error"
- `GET /api/papers/:id` → returns full paper with all AI-extracted fields
- Frontend `api.uploadPapers()` → calls correct endpoint with base64 data

### Files to touch

- `tests/story-1-pdf-pipeline.test.js` (new — spec test)
- `server/routes/papers.js` (already exists, verify correctness)
- `server/models/Paper.js` (already exists, verify schema)
- `server/services/paperAnalyzer.js` (already exists, verify AI call + parsing)
- `server/workers/runner.js` (already exists, verify job processing)
- `server/services/storage.js` (already exists, verify put/get)
- `src/utils/api.js` (already exists, verify uploadPapers)

### Implementation plan (Plan mode before coding)

1. Read existing `paperAnalyzer.js`, `papers.js` upload route, `workers/runner.js`
2. Write spec test that exercises the full pipeline
3. Identify gaps between current implementation and acceptance criteria
4. Fill gaps in service/route/worker code
5. Run spec test → pass

---

## Story 2: Create Tracker → Crawl Sources → Show Results

**As a** teacher,
**I want to** tell the AI "track multi-agent reinforcement learning papers"
and get a tracker that automatically crawls arXiv + OpenAlex on a schedule,
**so that** I stay current on my research area without manual searching.

### Acceptance criteria

1. Teacher types a research topic in chat → AI creates a Tracker with
   keywords, sources, and cadence
2. Tracker appears in the trackers list with status "idle"
3. A crawl job is enqueued → worker executes the standard crawler
4. Standard crawler queries arXiv + OpenAlex → deduplicates → stores papers
5. Tracker status updates to "completed" with papers count
6. Frontend tracker detail shows the discovered papers
7. Errors from individual sources are captured individually
   (e.g., "arXiv: timeout" but "OpenAlex: 12 papers")
8. Teacher can trigger a manual re-crawl

### Spec test file: `tests/story-2-tracker-crawl.test.js`

Tests to write:
- `POST /api/trackers/generate` with a topic → returns tracker with keywords
- Tracker crawl job processes → new papers stored → tracker.papers updated
- Papers from multiple sources are deduplicated by DOI/title
- Source-level errors don't block other sources (partial success)
- `GET /api/trackers/:id` → includes last crawl results and errors
- Manual crawl trigger → `POST /api/trackers/:id/crawl`

### Files to touch

- `tests/story-2-tracker-crawl.test.js` (new — spec test)
- `server/routes/trackers.js` (already exists, verify generate + crawl endpoints)
- `server/services/trackerCrawl.js` (already exists, verify orchestration)
- `server/services/standardCrawler.js` (already exists, verify multi-source + dedup)
- `server/services/ingestion/arxiv.js` (already exists)
- `server/services/ingestion/openalex.js` (already exists)
- `server/models/Tracker.js` (already exists)
- `src/components/views/TrackersView.jsx` (already exists)

### Implementation plan

1. Read existing trackerCrawl.js, standardCrawler.js, trackers.js route
2. Write spec test for the full crawl pipeline
3. Identify gaps (dedup logic, partial failure handling, manual trigger)
4. Fill gaps
5. Run spec test → pass

---

## Story 3: Context-Aware AI Chat with Evidence Display

**As a** teacher,
**I want to** ask "summarize the papers about multi-agent RL that I uploaded"
and have the AI use only my permitted papers to answer,
with the response showing which papers were used as evidence,
**so that** I can trust the AI's answers and verify sources.

### Acceptance criteria

1. Teacher sends a research question in chat
2. Server builds a ContextBundle from permitted papers matching the query
3. The ContextBundle is appended to the prompt sent to DeepSeek
4. DeepSeek's response references specific papers from the context
5. The response includes a list of papers used ("evidence display")
6. Private papers (sharing="private") are NOT included unless owned by the user
7. Project papers are included if user belongs to that project
8. School/university papers are always included
9. Token budget is checked before making the AI call
10. The AI action is logged with tokens used, context size, and model

### Spec test file: `tests/story-3-context-chat.test.js`

Tests to write:
- Chat with a question about "reinforcement learning" → context bundle includes
  matching school-shared papers, excludes private papers of other users
- AI response includes source attribution
- Token budget exceeded → call blocked or requires approval
- Empty paper library → context bundle has 0 papers, AI still responds
- Context bundle is included in the AI action audit log
- Frontend chat renders evidence blocks inline

### Files to touch

- `tests/story-3-context-chat.test.js` (new — spec test)
- `server/services/contextEngine.js` (already exists, verify permission filtering is correct)
- `server/services/tokenFlow.js` (already exists, verify budget check integration)
- `server/routes/chat.js` (already exists, verify context → AI → response flow)
- `server/services/aiRouter.js` (already exists)
- `server/models/AIAction.js` (already exists, verify fields match AIAction type)

### Implementation plan

1. Read existing contextEngine.js, tokenFlow.js, chat.js route, aiRouter.js
2. Write spec test for context-aware chat with permission filtering
3. Verify permission filtering logic: private < project < school < university
4. Ensure audit logging captures context metadata
5. Verify frontend renders evidence display blocks
6. Run spec test → pass
