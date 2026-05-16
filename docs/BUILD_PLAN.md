# AI Research OS Context And Build Plan

## Project Context

This project is a university AI-empowered research platform for Chinese
university teachers across computer science, mathematics, and other schools. The
main goal is to make research work easier for ordinary teachers by using AI
tokens to remove workflow friction wherever it appears.

The system is not intended to be a normal paper website with a small chatbot. It
should become an AI-native research operating system: one central chat console
can call website capabilities as tools, generate interactive UI blocks, navigate
to classic pages, and run multi-step research workflows.

Default assumptions:

- Chinese is the default language; English is fully supported.
- Teachers can work through the central chat box or through traditional pages.
- The university has CPU servers but no local GPU purchase.
- LLM capability mainly comes from API tokens.
- Local testing comes first; the planned remote server is `47.120.47.165`.
- The first production design should be a scalable modular monolith, not
  microservices-first.
- V1 targets a university pilot: hundreds to a few thousand teachers.

## Product Requirements Captured

- Paper crawlers collect papers from open sources and later approved sources.
- Teachers can upload PDF papers.
- Papers, summaries, notes, chats, prompts, workflows, boards, crawlers, and
  draft fragments can be shared and reused.
- Default sharing is school-level, with private, project, and university-wide
  options.
- The system stores teacher interactions and research artifacts as institutional
  research memory.
- Every AI feature should build a task-scoped context bundle from permitted
  relevant material before calling model APIs.
- Capable teachers should be able to ask AI to create crawler plugins.
- AI-generated crawler code must run in a sandbox before shared reuse.
- The UI must be responsive and friendly to ordinary teachers.
- External MCP-style access should eventually be supported for approved clients.

## Current Implementation State

The current repository contains a React frontend implementation:

- Vite + React + Tailwind CSS + lucide icons.
- Chinese-default UI with English toggle.
- Responsive shell with left navigation, center workspace, and right context
  rail.
- Central AI chat console with simulated command routing.
- Interactive chat blocks for route selection, task context, papers, and actions.
- Classic workspaces for trackers, library, writing, and governance.
- PDF upload UI with simulated parsing queue.
- Tracker creation simulation.
- Writing draft simulation.
- Governance panels for TokenFlow, MCP tools, crawler sandbox, audit, and remote
  deployment target.

Important files:

- `src/main.jsx`: main React app and current simulated product logic.
- `src/styles.css`: Tailwind layers and reusable button classes.
- `tailwind.config.js`: Tailwind content paths and theme extensions.
- `docs/ARCHITECTURE.md`: high-level architecture notes.
- `deploy/remote.example.env`: remote deployment target placeholder.

## Build Plan

### Phase 1: Frontend Product Foundation

Replace simulated state with clean frontend domain modules while keeping the
current UI contract.

- Split `src/main.jsx` into components, domain data, i18n copy, and workflow
  helpers.
- Add route-like state for `ai`, `trackers`, `library`, `writing`, and
  `governance`.
- Keep Chinese default and English switching across all UI text.
- Preserve dual UX: chat-first operation plus classic pages.
- Improve empty/loading/error states for all workspaces.
- Add local mock API layer so the frontend can later switch to real backend
  endpoints without rewriting components.

### Phase 2: Backend Modular Monolith

Add a real server behind the React frontend.

- Use one web/API service for auth, permissions, AI action orchestration, and
  frontend API endpoints.
- Add relational storage for users, schools, papers, trackers, artifacts,
  permissions, AI actions, and audit logs.
- Add object storage for uploaded PDFs and generated files.
- Add job queue workers for PDF parsing, crawler runs, summaries, embeddings,
  and scheduled tracker updates.
- Add a vector retrieval layer for task-scoped context bundles.
- Keep all low-risk actions automatic and require approval for high-risk actions:
  broad sharing, deletion, publishing, expensive AI calls, and crawler deployment.

### Phase 3: Real Paper And PDF Pipeline

Turn the paper library from UI simulation into useful research infrastructure.

- Implement PDF upload persistence.
- Extract PDF text and metadata.
- Deduplicate papers by DOI, title similarity, source ID, and PDF fingerprint.
- Support open-source ingestion first: arXiv, OpenAlex, Semantic Scholar,
  Crossref, PubMed, and manual import.
- Store paper summaries, structured contribution, method, limitation, datasets,
  citations, teacher notes, and reusable tags.
- Add permission-aware reuse of paper artifacts across school, project, private,
  and university scopes.

### Phase 4: Context Engine And TokenFlow

Make every AI call context-aware and cost-controlled.

- Implement `build_context_bundle` with permission checks, relevance ranking,
  token budgeting, source attribution, and audit logging.
- Route model calls by task type, cost, privacy level, user quota, and cache
  availability.
- Cache stable outputs such as paper summaries, embeddings, extracted claims,
  comparison tables, and generated boards.
- Show users which papers, notes, chats, and artifacts were used in each AI
  response.
- Add department/user quotas and admin monitoring.

### Phase 5: Chat Tool Runtime And MCP Layer

Make the chat console the true operating surface.

- Define action APIs such as `create_tracker`, `upload_paper_pdf`,
  `summarize_paper`, `compare_papers`, `generate_research_board`,
  `draft_paper_section`, `build_context_bundle`, `generate_crawler_plugin`, and
  `navigate_to_workspace`.
- Expose those actions internally to the AI command router.
- Add MCP-compatible tools/resources/prompts for internal agent use.
- Add external MCP access later with authentication, permissions, quotas, and
  audit logs.
- Render AI results as interactive blocks: paper lists, boards, tables, PDF
  readers, forms, and draft editors.

### Phase 6: Crawler Agent Sandbox

Support teacher-facing crawler generation safely.

- Define a `CrawlerPlugin` interface for source config, parser, tests, schedule,
  logs, owner, and sharing scope.
- Let AI generate crawler plugins from teacher requests.
- Run generated code only in a sandbox with network, filesystem, timeout, and
  rate-limit controls.
- Require sandbox tests before shared reuse.
- Store successful crawler plugins for reuse by teachers and departments.

### Phase 7: Deployment To Remote Server

Deploy only after the local frontend and first backend API are verified.

- Build production frontend with `npm run build`.
- Prepare server environment for `47.120.47.165`.
- Start with a single server deployment: reverse proxy, web/API process, worker
  process, database, object storage path, and logs.
- Add process supervision and health checks.
- Add backup strategy before storing real teacher PDFs or drafts.
- Do not enable broad external MCP access until auth, quotas, permissions, and
  audit logs are production-ready.

## Key Data Types To Implement

- `User`: teacher/admin identity, school, language preference, quota, roles.
- `School`: department/school boundary for default sharing and admin reporting.
- `Paper`: metadata, source IDs, PDF/text references, summaries, tags,
  permissions, and reuse status.
- `Tracker`: research interest definition, sources, ranking rules, schedule,
  board layout, and subscribers.
- `ResearchArtifact`: note, summary, chat insight, claim, method, dataset, board,
  prompt, workflow, or draft fragment.
- `ContextBundle`: selected context, permission proof, relevance score, token
  size, and source attribution.
- `AIAction`: request, tool calls, model, context used, token cost, approval
  state, output, and audit log.
- `CrawlerPlugin`: generated source connector, parser, tests, sandbox logs, and
  sharing scope.
- `WritingProject`: topic, selected papers, outline, draft sections, citation
  map, and revision history.

## Acceptance Criteria

- A teacher can ask the chat to track a research direction and receive an
  interactive tracker board.
- A teacher can upload a PDF and see extracted metadata, summary, and sharing
  controls.
- A teacher can ask a follow-up question and the AI response shows which allowed
  context was used.
- A teacher can generate related-work text from selected papers and notes.
- A capable teacher can ask AI to create a crawler plugin, run it in sandbox, and
  submit it for reuse.
- Admins can inspect token usage, AI actions, crawler runs, and sharing/audit
  events.
- The app works in Chinese by default, supports English switching, and remains
  usable on desktop, tablet, and mobile.

## Local Commands

```bash
npm install
npm run dev -- --port 5173
npm run build
python3 scripts/update_file_structure_graph.py
```
