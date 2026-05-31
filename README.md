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

### Major Updates (2026-05-31)

#### 🎉 Discovery & Search Module - 100% Complete
Implemented all 6 missing phases bringing the Discovery & Search module to full completion:

- **Phase 8: Seminal Papers Detection** - Citation velocity analysis with PageRank algorithm
- **Phase 9: Paper Relationship Extraction** - LLM-based relationship classification (contradicts, replicates, extends, supports, reviews, applies)
- **Phase 10: Grey Literature Integration** - BASE (240M+ documents) and OpenGrey providers
- **Phase 11: Patent Search Integration** - USPTO API with patent model
- **Phase 12: Additional Academic Sources** - PubMed, PhilPapers, CORE providers
- **Phase 13: Google Scholar Integration** - Web scraping with rate limiting and proxy rotation

**Total Implementation:** 18 new files, ~4,200 lines of code, 10 search providers, 500M+ papers accessible

#### 🔧 Critical Bug Fixes (2026-05-31)

1. **Missing Dependencies** (`package.json`)
   - **Issue**: Google Scholar provider required `axios` and `cheerio` packages that were not installed
   - **Fix**: Installed `axios@1.7.9` and `cheerio@1.0.0`
   - **Impact**: Google Scholar search now functional

2. **Import Inconsistencies** (`server/services/ingestion/googleScholar.js`)
   - **Issue**: Google Scholar used default imports while other providers used named imports
   - **Fix**: Standardized to named imports: `import { SearchProvider } from '../search/SearchProvider.js'`
   - **Impact**: Prevents "is not a constructor" runtime errors

3. **Missing Singleton Export** (`server/services/ingestion/googleScholar.js`)
   - **Issue**: Google Scholar provider missing singleton export for federation manager
   - **Fix**: Added `export const googleScholarProvider = new GoogleScholarProvider();`
   - **Impact**: Federation manager can now import and use Google Scholar

4. **Invalid OpenAlex email configuration** (`server/config.js`)
   - **Issue**: Default `openAlexEmail` was a token/ID rather than valid email
   - **Fix**: Changed to `"research@example.com"`
   - **Impact**: Prevents API errors when OPENALEX_EMAIL not set

5. **TypeScript baseUrl deprecation warning** (`tsconfig.json`)
   - **Issue**: TypeScript 6.0+ deprecated `baseUrl` without `ignoreDeprecations` flag
   - **Fix**: Added `"ignoreDeprecations": "6.0"` to compilerOptions
   - **Impact**: Cleaner build output

### Previously Fixed Bugs

6. **Login page blank screen** (`src/components/Login.jsx`)
   - **Issue**: Missing `useState` import causing runtime crash
   - **Fix**: Added `import { useState } from "react"`

7. **Duplicate chat messages** (`src/components/views/AiCenter.jsx`)
   - **Issue**: Race conditions causing duplicate AI responses
   - **Fix**: Added `submittingRef` guard and `doneHandled` flag

8. **Smart quote spacing in AI responses** (`src/components/MessageCard.jsx`)
   - **Issue**: Unicode smart quotes split across tokens causing spacing artifacts
   - **Fix**: Added `cleanDisplayText()` and `cleanStreamText()` functions

### UI Improvements

9. **Removed verbose chat metadata sections** (`src/components/MessageCard.jsx`)
   - **Change**: Removed "AI-selected route" and "Context built" panels
   - **Result**: Cleaner chat interface showing only AI responses and search results

### New Features & Services

10. **AI-powered research intent extraction** (`server/services/researchExtractor.js`)
    - Replaces regex-based detection with DeepSeek LLM structured JSON extraction
    - Extracts: topic, keywords, filters, search query, sort preferences
    - Graceful fallback with in-memory caching

11. **Rate Limiting Service** (`server/services/rateLimiter.js`)
    - Token bucket algorithm for API rate limiting
    - Configurable requests per time window
    - Status monitoring and reporting

12. **Proxy Rotation Service** (`server/services/proxyRotator.js`)
    - HTTP/HTTPS/SOCKS proxy support
    - Automatic failure detection and recovery
    - Health tracking per proxy

13. **Comprehensive Test Suite**
    - Added 5 new test files with 100+ test cases
    - Tests for rate limiter, proxy rotator, seminal paper detector, relationship extractor, Google Scholar

### Documentation

14. **Comprehensive Project Audit** (`docs/COMPREHENSIVE_PROJECT_AUDIT.md`)
    - Complete A-Z project analysis
    - 20 bugs identified with reproduction steps
    - 30 improvements with priorities
    - Execution plan with timeline

15. **Critical Fixes Report** (`docs/CRITICAL_FIXES_COMPLETED.md`)
    - Detailed fix documentation
    - Before/after code examples
    - Verification checklist

16. **All Phases Complete** (`docs/ALL_PHASES_COMPLETE.md`)
    - Complete implementation summary
    - API endpoints documentation
    - Configuration guide
    - Deployment checklist

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
