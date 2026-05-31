# AI-Native University Research Operating System

> An AI-native research operating system for Chinese university teachers.  
> One central chat console calls platform capabilities as tools, generates interactive UI blocks, navigates to classic pages, and runs multi-step research workflows.

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)](https://vitejs.dev/)
[![DeepSeek](https://img.shields.io/badge/AI-DeepSeek%20v4--pro-blue)](https://deepseek.com/)
[![License](https://img.shields.io/badge/license-Private-red)]()

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Features](#features)
- [Recent Fixes & Improvements](#recent-fixes--improvements)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Overview

This platform is designed for hundreds to thousands of teachers at a single Chinese university. The chat box **is** the operating surface — not a paper website with a chatbot attached.

- **Default language**: Chinese UI with English toggle
- **Architecture**: React SPA frontend + Express API backend + MongoDB
- **AI backbone**: DeepSeek API (`deepseek-v4-pro`) with streaming SSE chat

---

## Tech Stack

| Layer      | Technology                                              |
|------------|---------------------------------------------------------|
| Frontend   | React 19, Vite 7, Tailwind CSS 3, Lucide icons         |
| Backend    | Express 5, Mongoose 9 (MongoDB), Node.js ESM            |
| AI         | DeepSeek API (`deepseek-v4-pro`) — configurable via env |
| Tests      | `node:test` + `node:assert/strict` (no Jest/Mocha)      |
| E2E        | Playwright                                              |
| Package    | npm                                                     |

---

## Prerequisites

- **Node.js** ≥ 20
- **MongoDB** running locally (default: `mongodb://localhost:27017/ai_research`)
- **DeepSeek API key** (set via `.env`)
- **npm** (comes with Node.js)

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/Cloudzonez/ai-research-os.git
cd ai-research-os
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create a `.env` file in the project root:

```env
# Required
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Optional (defaults shown)
PORT=3001
MONGO_URI=mongodb://localhost:27017/ai_research
MODEL_NAME=deepseek-v4-pro
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
AUTH_SECRET=dev-secret-change-in-production
STORAGE_PATH=./uploads
OPENALEX_EMAIL=your-email@example.com

# Task-specific model routing (optional)
CHAT_MODEL=deepseek-v4-pro
CODE_MODEL=deepseek-v4-pro
CRAWLER_MODEL=deepseek-v4-pro
SUMMARY_MODEL=deepseek-v4-pro
```

### 4. Start the application

**Option A — Run frontend and backend together:**

```bash
npm run dev:all
```

**Option B — Run separately (two terminals):**

```bash
# Terminal 1: Backend API server (port 3001)
npm run dev:server

# Terminal 2: Frontend dev server (port 5173)
npm run dev
```

### 5. Open in browser

```
http://localhost:5173
```

**Demo credentials:**
- Email: `teacher@university.edu` / Password: `demo123456`
- Email: `admin@university.edu` / Password: `demo123456`

---

## Project Structure

```
ai-research-os/
├── src/                          # React frontend
│   ├── main.jsx                  # Entry point
│   ├── styles.css                # Tailwind + custom design tokens
│   ├── components/
│   │   ├── App.jsx               # Root: auth gate, view router, global state
│   │   ├── Login.jsx             # Authentication page
│   │   ├── MessageCard.jsx       # Chat message rendering
│   │   ├── ChatHistory.jsx       # Session history sidebar
│   │   ├── AuthContext.jsx       # Auth context provider
│   │   ├── LoadingStates.jsx     # Skeleton & empty state components
│   │   └── views/
│   │       └── AiCenter.jsx      # Main AI chat view with streaming
│   ├── data/                     # Static data (routes, prompts)
│   ├── i18n/                     # Internationalization (zh/en)
│   ├── types/                    # Type definitions
│   └── utils/
│       └── api.js                # API client with SSE streaming support
│
├── server/                       # Express backend
│   ├── index.js                  # Server entry point
│   ├── config.js                 # Environment configuration
│   ├── middleware/
│   │   ├── auth.js               # JWT authentication
│   │   └── approval.js           # Action logging/approval
│   ├── models/                   # Mongoose models
│   ├── routes/
│   │   ├── chat.js               # Chat endpoints (streaming SSE + REST)
│   │   ├── auth.js               # Authentication routes
│   │   ├── papers.js             # Paper library management
│   │   ├── sessions.js           # Chat session management
│   │   ├── trackers.js           # Research trackers
│   │   ├── crawlers.js           # Web crawlers
│   │   ├── writing.js            # AI writing assistant
│   │   ├── foundry.js            # App/script foundry
│   │   └── health.js             # Health check endpoint
│   ├── services/
│   │   ├── aiRouter.js           # AI intent routing & streaming
│   │   ├── deepseek.js           # DeepSeek API client
│   │   ├── researchExtractor.js  # AI-powered research intent extraction
│   │   ├── contextEngine.js      # Context building engine
│   │   └── cache.js              # Caching service
│   └── workers/                  # Background job workers
│
├── tests/                        # Test suite
├── docs/                         # Documentation
├── deploy/                       # Deployment scripts
├── vite.config.js                # Vite config with API proxy
├── tailwind.config.js            # Tailwind configuration
└── package.json                  # Dependencies & scripts
```

---

## Environment Variables

| Variable            | Default                                      | Description                        |
|---------------------|----------------------------------------------|------------------------------------|
| `DEEPSEEK_API_KEY`  | *(required)*                                 | DeepSeek API authentication key    |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1`                | DeepSeek API base URL              |
| `MODEL_NAME`        | `deepseek-v4-pro`                            | Default AI model                   |
| `MONGO_URI`         | `mongodb://localhost:27017/ai_research`      | MongoDB connection string          |
| `PORT`              | `3001`                                       | Backend server port                |
| `AUTH_SECRET`       | `dev-secret-change-in-production`            | JWT signing secret                 |
| `STORAGE_PATH`      | `./uploads`                                  | File upload directory              |
| `OPENALEX_EMAIL`    | *(optional)*                                 | Email for OpenAlex API polite pool |
| `CHAT_MODEL`        | Same as `MODEL_NAME`                         | Model for chat tasks               |
| `CODE_MODEL`        | `deepseek-v4-pro`                            | Model for code generation          |
| `CRAWLER_MODEL`     | Same as `CODE_MODEL`                         | Model for crawler generation       |
| `SUMMARY_MODEL`     | Same as `MODEL_NAME`                         | Model for summarization            |

---

## Available Scripts

| Command                | Description                                          |
|------------------------|------------------------------------------------------|
| `npm run dev`          | Start Vite frontend dev server                       |
| `npm run dev:server`   | Start Express backend server                         |
| `npm run dev:all`      | Start both frontend and backend concurrently         |
| `npm run dev:all:full` | Start frontend, backend, and background worker       |
| `npm run build`        | Build production frontend bundle                     |
| `npm run preview`      | Preview production build locally                     |
| `npm run test:pure`    | Run unit tests (no external services needed)         |
| `npm run test:e2e`     | Run Playwright end-to-end tests                      |
| `npm run worker`       | Start background job worker                          |

---

## Features

### Core
- **Central AI Chat Console** — Streaming SSE-based chat with real-time token display
- **Bilingual UI** — Chinese default with instant English toggle
- **JWT Authentication** — User registration, login, role-based access
- **Chat Sessions** — Persistent conversation history with rename, delete, mark, share

### Research Tools
- **Paper Library** — Upload PDFs, search OpenAlex, save/organize papers
- **Research Trackers** — AI-generated keyword trackers monitoring arXiv, OpenAlex, Semantic Scholar
- **Standard Crawlers** — AI-generated web crawlers for academic sources
- **AI Writing Assistant** — Draft generation for research papers

### Platform
- **Context Engine** — Builds context bundles from user's paper library for grounded AI responses
- **TokenFlow** — Token usage tracking and quota management
- **MCP Tool Layer** — Model Context Protocol gateway
- **App Foundry** — Generate custom mini-apps and scripts
- **Admin Panel** — User management and system statistics

---

## Recent Fixes & Improvements

### Bug Fixes

1. **Login page blank screen** (`src/components/Login.jsx`)
   - **Issue**: The `Login` component used `useState` for form state (email, password, mode, etc.) but never imported it from React, causing a runtime crash and a blank white page.
   - **Fix**: Added `import { useState } from "react"` at the top of the file.

2. **Duplicate chat messages** (`src/components/views/AiCenter.jsx`)
   - **Issue**: The same user query could produce two separate AI responses due to race conditions — when no session existed, `onNewChat()` was called which cleared messages mid-stream, and the submit function could be triggered multiple times.
   - **Fix**: 
     - Added a `submittingRef` guard to prevent double-submit of `handleSubmitText`.
     - Added a `doneHandled` flag to prevent processing duplicate SSE `done` events.
     - Removed the `onNewChat()` call during message submission (falls back to `"default"` session instead).

3. **Smart quote spacing in AI responses** (`src/components/MessageCard.jsx`, `src/components/views/AiCenter.jsx`)
   - **Issue**: The DeepSeek model returned Unicode smart quotes (`'` `'` `"` `"`) that got split across streaming tokens, causing visible spacing artifacts like `"you' d"`, `"I' ve"`, `"I' ll"`.
   - **Fix**: Added `cleanDisplayText()` and extended `cleanStreamText()` functions that normalize smart quotes to plain ASCII apostrophes/quotes and remove errant spaces around them.

### UI Improvements

4. **Removed verbose chat metadata sections** (`src/components/MessageCard.jsx`)
   - **Change**: Removed the "AI-selected route" panel (showing workflow steps like "Upload PDFs and extract text", "Deduplicate and set sharing" with an "Open workspace" button) and the "Context built" panel (showing tokens/artifacts/allowed percentages) from every assistant message.
   - **Result**: Cleaner chat interface — assistant messages now show only the AI text response and any searched papers from OpenAlex.

### New Features

5. **AI-powered research intent extraction** (`server/services/researchExtractor.js`)
   - **What**: A new service that replaces brittle regex-based detection of research queries with a DeepSeek LLM call that returns structured JSON.
   - **Extracts**: `main_topic`, `keywords`, `filters` (year range, authors, field, publication type), `search_query`, `sort_by`, `max_results`.
   - **Graceful fallback**: Uses in-memory caching for repeated queries and falls back to regex extraction if the AI call times out or fails.
   - **Integration**: Wired into `aiRouter.js` via `extractResearchIntent()` replacing the old regex intent detection.

---

## Testing

### Unit Tests (no external services)

```bash
npm run test:pure
```

### End-to-End Tests

```bash
npm run test:e2e
```

### Specific Test Suites

```bash
npm run test:trackers     # Tracker crawl tests
npm run test:crawlers     # Standard crawler tests
npm run test:pipeline     # AI crawler pipeline tests
```

---

## Deployment

See [deploy/setup.sh](deploy/setup.sh) and [deploy/remote.example.env](deploy/remote.example.env) for production deployment configuration.

```bash
# Build for production
npm run build

# Start with PM2
pm2 start ecosystem.config.cjs
```

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System architecture overview
- [Build Plan](docs/BUILD_PLAN.md) — Product context and implementation plan
- [User Stories](docs/USER_STORIES.md) — Feature requirements
- [Standard Crawler Architecture](docs/STANDARD_CRAWLER_ARCHITECTURE.md) — Crawler system design
- [File Structure Graph](docs/FILE_STRUCTURE_GRAPH.md) — Visual project structure

---

## Contributing

1. Follow the existing code patterns (ESM imports, functional React components, Tailwind utility classes)
2. Tests use `node:test` + `node:assert/strict` — no Jest or Mocha
3. Backend is `.js` ESM (no TypeScript compilation)
4. Run `npm run test:pure` before committing
