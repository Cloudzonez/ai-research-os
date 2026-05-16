# Architecture Notes

## Product principle

The platform is not a traditional paper website with a chatbot attached. The
chat box is the operating console. The React frontend exposes research
capabilities as tool-like actions, and the AI decides whether to answer inline,
run a workflow, render an interactive block, or navigate to a classic workspace.

## V1 modules

- **React Research Workspace**: responsive Chinese-default UI with English
  switching, chat-first operation, and classic navigation.
- **AI Command Router**: classifies teacher requests into answer, workflow,
  tool call, generated block, or navigation.
- **Context Engine**: builds task-scoped context bundles from permitted papers,
  chats, notes, trackers, drafts, and school-shared memory.
- **TokenFlow Engine**: estimates cost, chooses model, caches stable outputs,
  enforces quotas, and logs usage.
- **Crawler Sandbox**: lets teachers generate and test crawler plugins before
  shared reuse.
- **Research Memory Graph**: links papers, summaries, claims, methods, datasets,
  notes, chats, and writing projects.
- **MCP-Compatible Tool Layer**: exposes internal actions as tools/resources for
  the platform AI and approved external clients.

## Server-side evolution

The current React implementation should attach to a modular monolith with
separate workers:

- Web/API process for auth, UI, permissions, and action orchestration.
- Queue workers for crawling, PDF parsing, embeddings, summaries, and tracker
  schedules.
- Object storage for PDFs and generated artifacts.
- Relational database for users, schools, permissions, papers, trackers, and
  audit logs.
- Vector index for task-scoped retrieval.
- Sandbox runner for AI-generated crawler plugins.

## Deployment target

Remote server: `47.120.47.165`.

The first backend should keep the same UX contract: every action available from
a normal page must also be invokable from the central chat console.
