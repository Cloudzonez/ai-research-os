# AI-Native University Research Operating System

> An AI-native research operating system for Chinese university teachers.  
> One central chat console calls platform capabilities as tools, generates interactive UI blocks, navigates to classic pages, and runs multi-step research workflows.

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)](https://vitejs.dev/)
[![DeepSeek](https://img.shields.io/badge/AI-DeepSeek%20v4--pro-blue)](https://deepseek.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/license-Private-red)]()

---

## 🎯 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Discovery & Search Module](#discovery--search-module)
- [Recent Fixes & Improvements](#recent-fixes--improvements)
- [Testing](#testing)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## 🌟 Overview

This platform is designed for hundreds to thousands of teachers at a single Chinese university. The chat box **is** the operating surface — not a paper website with a chatbot attached.

### Design Philosophy

- **Default language**: Chinese UI with English toggle
- **Architecture**: React SPA frontend + Express API backend + MongoDB
- **AI backbone**: DeepSeek API (`deepseek-v4-pro`) with streaming SSE chat
- **Research-first**: Built specifically for academic research workflows

### What Makes This Different

- **AI-Native**: Every feature is designed around conversational AI interaction
- **Research-Focused**: Deep integration with 10+ academic databases (500M+ papers)
- **Context-Aware**: Intelligent context engine builds grounded responses from your library
- **Multi-Modal**: Generates apps, scripts, crawlers, and research workflows on demand

---

## 🚀 Key Features

### 🤖 AI Chat Console
- **Streaming SSE-based chat** with real-time token display
- **Intent routing** - AI automatically selects the right tool for each task
- **Context-aware responses** - Grounds answers in your paper library
- **Multi-turn conversations** - Maintains context across sessions

### 📚 Discovery & Search (NEW - 100% Complete)
- **10 Academic Search Providers**: OpenAlex, arXiv, Semantic Scholar, PubMed, PhilPapers, CORE, BASE, OpenGrey, USPTO, Google Scholar
- **500M+ Papers**: Access to the world's largest open academic databases
- **Seminal Paper Detection**: PageRank-based citation velocity analysis
- **Paper Relationships**: AI extracts contradicts, replicates, extends, supports, reviews, applies
- **Grey Literature**: 240M+ theses, reports, preprints from BASE and OpenGrey
- **Patent Search**: USPTO integration for technology research
- **Smart Query Parsing**: Natural language to structured search queries
- **Semantic Search**: Vector embeddings for conceptual similarity
- **Federation Manager**: Orchestrates searches across all providers

### 📖 Research Tools
- **Paper Library** - Upload PDFs, search databases, organize collections
- **Research Trackers** - AI-generated keyword monitors for arXiv, OpenAlex, Semantic Scholar
- **Standard Crawlers** - AI-generated web crawlers for academic sources
- **AI Writing Assistant** - Draft generation for research papers
- **Citation Graph** - Visualize paper relationships and influence

### 🛠️ Platform Capabilities
- **Context Engine** - Builds context bundles from your library for grounded AI
- **TokenFlow** - Token usage tracking and quota management
- **MCP Tool Layer** - Model Context Protocol gateway for extensibility
- **App Foundry** - Generate custom mini-apps and scripts
- **Admin Panel** - User management and system statistics
- **Rate Limiting** - Token bucket algorithm for API protection
- **Proxy Rotation** - Automatic proxy management for web scraping

### 🌐 User Experience
- **Bilingual UI** - Chinese default with instant English toggle
- **JWT Authentication** - Secure user registration and role-based access
- **Chat Sessions** - Persistent history with rename, delete, mark, share
- **Responsive Design** - Works on desktop, tablet, and mobile

---

## 🛠️ Tech Stack

| Layer      | Technology                                              |
|------------|---------------------------------------------------------|
| Frontend   | React 19, Vite 7, Tailwind CSS 3, Lucide icons         |
| Backend    | Express 5, Mongoose 9 (MongoDB), Node.js ESM            |
| AI         | DeepSeek API (`deepseek-v4-pro`) — configurable via env |
| Search     | 10 providers: OpenAlex, arXiv, Semantic Scholar, etc.   |
| Tests      | `node:test` + `node:assert/strict` (no Jest/Mocha)      |
| E2E        | Playwright                                              |
| Package    | npm                                                     |
| Deployment | PM2, Nginx (optional)                                   |

---

## 📋 Prerequisites

- **Node.js** ≥ 20
- **MongoDB** running locally (default: `mongodb://localhost:27017/ai_research`)
- **DeepSeek API key** (set via `.env`)
- **npm** (comes with Node.js)

---

## ⚡ Quick Start

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

Create a `.env` file in the project root (see `.env.example`):

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
OPENALEX_EMAIL=research@example.com

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

## 📁 Project Structure

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
│   │       ├── AiCenter.jsx      # Main AI chat view with streaming
│   │       ├── LibraryView.jsx   # Paper library management
│   │       ├── TrackersView.jsx  # Research trackers
│   │       ├── WritingView.jsx   # AI writing assistant
│   │       ├── FoundryView.jsx   # App/script generator
│   │       └── AdminDashboardView.jsx  # Admin panel
│   ├── data/                     # Static data (routes, prompts)
│   ├── i18n/                     # Internationalization (zh/en)
│   ├── types/                    # TypeScript type definitions
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
│   │   ├── User.js               # User accounts
│   │   ├── Paper.js              # Research papers
│   │   ├── PaperRelationship.js  # Paper-to-paper relationships
│   │   ├── Patent.js             # Patent records
│   │   ├── ChatSession.js        # Chat conversations
│   │   ├── Tracker.js            # Research trackers
│   │   ├── Subscription.js       # Alert subscriptions
│   │   └── ...                   # Other models
│   ├── routes/
│   │   ├── chat.js               # Chat endpoints (streaming SSE + REST)
│   │   ├── auth.js               # Authentication routes
│   │   ├── papers.js             # Paper library management
│   │   ├── search.js             # Discovery & search endpoints
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
│   │   ├── cache.js              # Caching service
│   │   ├── rateLimiter.js        # Rate limiting (token bucket)
│   │   ├── proxyRotator.js       # Proxy rotation service
│   │   ├── ingestion/            # Search provider integrations
│   │   │   ├── base.js           # Base provider class
│   │   │   ├── core.js           # CORE provider
│   │   │   ├── arxiv.js          # arXiv provider
│   │   │   ├── openalex.js       # OpenAlex provider
│   │   │   ├── semanticScholar.js # Semantic Scholar provider
│   │   │   ├── pubmed.js         # PubMed provider
│   │   │   ├── philpapers.js     # PhilPapers provider
│   │   │   ├── opengrey.js       # OpenGrey provider
│   │   │   ├── uspto.js          # USPTO provider
│   │   │   └── googleScholar.js  # Google Scholar provider
│   │   └── search/               # Search infrastructure
│   │       ├── SearchProvider.js # Base search provider class
│   │       ├── federationManager.js # Multi-provider orchestration
│   │       ├── queryParser.js    # Natural language query parsing
│   │       ├── semanticSearch.js # Vector-based semantic search
│   │       ├── citationGraph.js  # Citation network analysis
│   │       ├── seminalPaperDetector.js # PageRank-based detection
│   │       ├── relationshipExtractor.js # Paper relationship extraction
│   │       ├── metadataExtractor.js # Paper metadata extraction
│   │       ├── codeDataDetector.js # Code/data availability detection
│   │       └── embeddingService.js # Vector embedding generation
│   └── workers/
│       ├── runner.js             # Background job worker
│       └── embedPapers.js        # Paper embedding worker
│
├── tests/                        # Test suite
│   ├── *-pure.test.js            # Unit tests (no external services)
│   ├── *-live.test.js            # Integration tests (require services)
│   ├── routes/                   # Route tests
│   └── e2e/                      # End-to-end tests (Playwright)
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md           # System architecture
│   ├── BUILD_PLAN.md             # Product context
│   ├── USER_STORIES.md           # Feature requirements
│   ├── COMPREHENSIVE_PROJECT_AUDIT.md # Complete project analysis
│   ├── CRITICAL_FIXES_COMPLETED.md # Bug fix documentation
│   ├── ALL_PHASES_COMPLETE.md    # Implementation summary
│   └── adr/                      # Architecture decision records
│
├── deploy/                       # Deployment scripts
│   ├── setup.sh                  # Production setup script
│   └── remote.example.env        # Production environment template
│
├── vite.config.js                # Vite config with API proxy
├── tailwind.config.js            # Tailwind configuration
├── ecosystem.config.cjs          # PM2 configuration
└── package.json                  # Dependencies & scripts
```

---

## 🔧 Environment Variables

| Variable            | Default                                      | Description                        |
|---------------------|----------------------------------------------|------------------------------------|
| `DEEPSEEK_API_KEY`  | *(required)*                                 | DeepSeek API authentication key    |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1`                | DeepSeek API base URL              |
| `MODEL_NAME`        | `deepseek-v4-pro`                            | Default AI model                   |
| `MONGO_URI`         | `mongodb://localhost:27017/ai_research`      | MongoDB connection string          |
| `PORT`              | `3001`                                       | Backend server port                |
| `AUTH_SECRET`       | `dev-secret-change-in-production`            | JWT signing secret                 |
| `STORAGE_PATH`      | `./uploads`                                  | File upload directory              |
| `OPENALEX_EMAIL`    | `research@example.com`                       | Email for OpenAlex API polite pool |
| `CHAT_MODEL`        | Same as `MODEL_NAME`                         | Model for chat tasks               |
| `CODE_MODEL`        | `deepseek-v4-pro`                            | Model for code generation          |
| `CRAWLER_MODEL`     | Same as `CODE_MODEL`                         | Model for crawler generation       |
| `SUMMARY_MODEL`     | Same as `MODEL_NAME`                         | Model for summarization            |

---

## 📜 Available Scripts

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

## 🔍 Discovery & Search Module

### Overview

The Discovery & Search module provides comprehensive access to 500M+ academic papers, patents, and grey literature through 10 integrated providers.

### Search Providers

| Provider          | Coverage                    | Type              | Status |
|-------------------|-----------------------------|-------------------|--------|
| OpenAlex          | 250M+ papers                | Academic          | ✅     |
| arXiv             | 2.4M+ preprints             | Preprints         | ✅     |
| Semantic Scholar  | 200M+ papers                | Academic          | ✅     |
| PubMed            | 36M+ biomedical papers      | Biomedical        | ✅     |
| PhilPapers        | 2.9M+ philosophy papers     | Philosophy        | ✅     |
| CORE              | 240M+ open access papers    | Open Access       | ✅     |
| BASE              | 240M+ documents             | Grey Literature   | ✅     |
| OpenGrey          | 1M+ grey literature         | Grey Literature   | ✅     |
| USPTO             | 11M+ patents                | Patents           | ✅     |
| Google Scholar    | Comprehensive               | Academic (scrape) | ✅     |

### Key Features

#### 1. Federated Search
- **Single Query, Multiple Sources**: Search across all providers simultaneously
- **Result Deduplication**: Intelligent merging of results from multiple sources
- **Relevance Ranking**: Combined scoring across providers

#### 2. Seminal Paper Detection
- **PageRank Algorithm**: Citation network analysis
- **Citation Velocity**: Tracks citation growth over time
- **Influence Metrics**: Identifies highly influential papers

#### 3. Paper Relationships
- **AI-Powered Extraction**: LLM analyzes paper content to identify relationships
- **Relationship Types**: contradicts, replicates, extends, supports, reviews, applies
- **Citation Graph**: Visualizes paper connections

#### 4. Semantic Search
- **Vector Embeddings**: DeepSeek-generated embeddings for papers
- **Conceptual Similarity**: Find papers by meaning, not just keywords
- **MongoDB Atlas Vector Search**: Efficient similarity queries

#### 5. Smart Query Parsing
- **Natural Language**: "Find recent papers on transformer models"
- **Structured Extraction**: Converts to filters, keywords, date ranges
- **AI-Powered**: Uses DeepSeek for intent understanding

### API Endpoints

```javascript
// Search across all providers
POST /api/search/federated
{
  "query": "machine learning transformers",
  "filters": { "year": { "min": 2020 } },
  "limit": 50
}

// Semantic search
POST /api/search/semantic
{
  "query": "attention mechanisms in neural networks",
  "limit": 20
}

// Find seminal papers
POST /api/search/seminal
{
  "topic": "deep learning",
  "minCitations": 100
}

// Extract paper relationships
POST /api/search/relationships
{
  "paperId": "arxiv:2103.14030"
}
```

### Configuration

```env
# OpenAlex (required for polite pool)
OPENALEX_EMAIL=your-email@example.com

# Rate limiting (optional)
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60000

# Proxy rotation (optional)
PROXY_LIST=http://proxy1:8080,http://proxy2:8080
```

---

## 🔧 Recent Fixes & Improvements

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

## 🧪 Testing

### Unit Tests (no external services)

```bash
npm run test:pure
```

Runs all `*-pure.test.js` files that don't require external services.

### End-to-End Tests

```bash
npm run test:e2e
```

Runs Playwright tests for full user workflows.

### Specific Test Suites

```bash
npm run test:trackers     # Tracker crawl tests
npm run test:crawlers     # Standard crawler tests
npm run test:pipeline     # AI crawler pipeline tests
```

### Test Coverage

- **Unit Tests**: 50+ test files covering services, models, and utilities
- **Integration Tests**: API endpoint tests with mock data
- **E2E Tests**: Full user workflows (login, search, chat, library)
- **Coverage**: ~75% code coverage (target: 80%)

---

## 🚀 Deployment

### Production Build

```bash
# Build frontend
npm run build

# Start with PM2
pm2 start ecosystem.config.cjs

# Or use the deployment script
cd deploy
./setup.sh
```

### Environment Setup

1. Copy `.env.example` to `.env`
2. Set production values for all variables
3. Ensure MongoDB is running and accessible
4. Configure Nginx reverse proxy (optional)

### PM2 Configuration

The `ecosystem.config.cjs` file includes:
- Backend server process
- Background worker process
- Auto-restart on failure
- Log rotation

### Monitoring

```bash
# View logs
pm2 logs

# Monitor processes
pm2 monit

# Check status
pm2 status
```

See [deploy/setup.sh](deploy/setup.sh) and [deploy/remote.example.env](deploy/remote.example.env) for detailed production deployment configuration.

---

## 📚 Documentation

### Core Documentation
- [Architecture](docs/ARCHITECTURE.md) — System architecture overview
- [Build Plan](docs/BUILD_PLAN.md) — Product context and implementation plan
- [User Stories](docs/USER_STORIES.md) — Feature requirements
- [Standard Crawler Architecture](docs/STANDARD_CRAWLER_ARCHITECTURE.md) — Crawler system design

### Implementation Guides
- [Discovery & Search Complete](docs/DISCOVERY_SEARCH_COMPLETE.md) — Search module implementation
- [All Phases Complete](docs/ALL_PHASES_COMPLETE.md) — Complete implementation summary
- [MongoDB Atlas Vector Setup](docs/MONGODB_ATLAS_VECTOR_SETUP.md) — Vector search configuration

### Analysis & Reports
- [Comprehensive Project Audit](docs/COMPREHENSIVE_PROJECT_AUDIT.md) — Complete project analysis
- [Critical Fixes Completed](docs/CRITICAL_FIXES_COMPLETED.md) — Bug fix documentation
- [Test Coverage Analysis](docs/TEST_COVERAGE_ANALYSIS.md) — Testing status

### Architecture Decision Records
- [ADR 001: Discovery & Search Architecture](docs/adr/001-discovery-search-architecture.md)

---

## 🤝 Contributing

### Code Style

1. **Follow existing patterns**
   - ESM imports (`import`/`export`)
   - Functional React components
   - Tailwind utility classes
   - Async/await for promises

2. **Testing**
   - Use `node:test` + `node:assert/strict` (no Jest or Mocha)
   - Write unit tests for new services
   - Add E2E tests for new user workflows

3. **Backend**
   - Backend is `.js` ESM (no TypeScript compilation)
   - Use Mongoose for database models
   - Follow RESTful API conventions

4. **Frontend**
   - Use React hooks (no class components)
   - Keep components small and focused
   - Use Tailwind for styling (no CSS modules)

### Development Workflow

1. Create a feature branch
2. Make your changes
3. Run tests: `npm run test:pure`
4. Commit with descriptive message
5. Push and create pull request

### Commit Message Format

```
feat: Add new feature
fix: Fix bug in component
docs: Update documentation
test: Add tests for service
refactor: Refactor code structure
```

---

## 📄 License

Private - All rights reserved

---

## 🙏 Acknowledgments

- **DeepSeek** - AI model provider
- **OpenAlex** - Open academic graph
- **Semantic Scholar** - Academic search API
- **arXiv** - Preprint repository
- **MongoDB** - Database platform

---

## 📞 Support

For issues, questions, or contributions, please contact the development team.

**Project Repository**: https://github.com/Cloudzonez/ai-research-os

---

**Built with ❤️ for academic research**
