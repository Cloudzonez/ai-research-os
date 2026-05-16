# AI-Native University Research Operating System

This repository contains a local-first React implementation for a Chinese-default,
bilingual university research platform. The frontend uses Vite, React, Tailwind
CSS, and lucide icons.

## What is implemented

- Central chat console for research commands.
- Chinese default UI with English switching.
- Responsive desktop, tablet, and mobile layout.
- Simulated AI command routing for trackers, PDF intake, writing, and crawler
  generation.
- Interactive chat blocks for context bundles, workflow routes, paper summaries,
  crawler plans, and writing drafts.
- Classic navigation for teachers who prefer normal pages.
- Paper library with school/private/project/university sharing concepts.
- TokenFlow, MCP tool layer, crawler sandbox, and remote deployment target panel.

See [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) for the captured product context
and staged implementation plan.

## Run locally

Install dependencies:

```bash
npm install
```

Start the React development server:

```bash
npm run dev -- --port 5173
```

Then open:

```text
http://localhost:5173
```

Build production assets:

```bash
npm run build
```

## Remote target

The planned server-side deployment target is:

```text
47.120.47.165
```

Local validation should come first. A backend can attach real LLM APIs,
database storage, PDF parsing, crawler execution, vector retrieval, MCP access,
and authentication behind the same frontend interaction model.
