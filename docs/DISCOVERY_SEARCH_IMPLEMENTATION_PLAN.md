# Discovery & Search Module - Implementation Plan

> **Project**: AI Research OS - Discovery & Search Enhancement  
> **Date**: 2026-05-31  
> **Status**: Planning Phase  
> **Target**: MVP in 3 phases, ~4-6 weeks

---

## Executive Summary

This plan extends the existing AI Research OS with a comprehensive Discovery & Search module that enables:
1. **Natural-language paper search** with LLM-powered query understanding
2. **Multi-source federated search** across OpenAlex, arXiv, Semantic Scholar, PubMed, and more
3. **Advanced filtering** by methodology, datasets, code availability, and publication metadata
4. **Semantic search** using MongoDB Atlas Vector Search with OpenAI embeddings
5. **Citation intelligence** and research tracking (Phase 2)

**MVP Priorities** (based on user input):
1. Natural-language search with LLM parsing
2. Multi-source federation with deduplication
3. Advanced filters (methodology/code/data)

**Technical Decisions**:
- Vector DB: MongoDB Atlas Vector Search (uses existing MongoDB)
- Embeddings: OpenAI text-embedding-3-large ($0.13/1M tokens)
- Budget: $50/month for APIs
- Scale: 10K papers, 100 queries/day, 20 concurrent users

---

## Current State Analysis

### Existing Infrastructure ✅
- **Backend**: Node.js ESM, Express 5, Mongoose (MongoDB)
- **Frontend**: React 19, Vite 7, Tailwind CSS
- **AI**: DeepSeek API (deepseek-v4-pro) configured
- **Search Adapters**: OpenAlex, arXiv, Semantic Scholar already implemented
- **Paper Model**: Basic schema with title, authors, abstract, DOI, year, tags
- **Deduplication**: Simple DOI/title/text fingerprint matching

### Gaps to Address 🔧
- No unified SearchProvider interface
- No semantic/vector search capability
- Limited query understanding (regex-based)
- No citation graph or relationship tracking
- No advanced metadata extraction (methodology, datasets, code)
- No monitoring/alerting system

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Search Input │  │ Filter Panel │  │ Results Grid │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              API Layer (Express Routes)                      │
│  POST /api/search/query                                      │
│  GET  /api/search/similar/:paperId                           │
│  POST /api/search/federated                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│           Search Orchestrator (Core Logic)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. Query Parser (LLM) → Structured Intent            │   │
│  │ 2. Federation Manager → Parallel Source Queries      │   │
│  │ 3. Deduplicator → Merge & Rank Results               │   │
│  │ 4. Filter Engine → Apply Advanced Filters            │   │
│  │ 5. Embedding Service → Semantic Search               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  OpenAlex    │  │    arXiv     │  │   Semantic   │
│   Adapter    │  │   Adapter    │  │   Scholar    │
└──────────────┘  └──────────────┘  └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Data Layer                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   MongoDB    │  │  Redis Cache │  │ Vector Index │      │
│  │   (Papers)   │  │  (Queries)   │  │  (Embeddings)│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

## Phase 1: Foundation & Architecture (Week 1)

### 1.1 Paper Schema Extensions

**File**: `server/models/Paper.js`

Add these fields to the existing schema:

```javascript
{
  // Vector search
  embedding: { type: [Number], default: null },
  embeddingModel: { type: String, default: null },
  embeddedAt: { type: Date, default: null },
  
  // Citation intelligence
  citedByCount: { type: Number, default: 0 },
  referencesCount: { type: Number, default: 0 },
  influentialCitationCount: { type: Number, default: 0 },
  
  // Advanced metadata
  studyType: {
    type: String,
    enum: ["rct", "cohort", "case_study", "meta_analysis", "review", 
           "survey", "experimental", "theoretical", "unknown", null],
    default: null
  },
  sampleSize: { type: Number, default: null },
  population: { type: String, default: null },
  
  datasets: [{ 
    name: String, 
    url: String,
    description: String 
  }],
  
  codeAvailable: { type: Boolean, default: false },
  codeUrls: [String],
  dataAvailable: { type: Boolean, default: false },
  dataUrls: [String],
  
  venue: { type: String, default: null },
  venueType: { 
    type: String, 
    enum: ["journal", "conference", "preprint", "workshop", 
           "thesis", "book", "unknown", null],
    default: null 
  },
  
  // Multi-source tracking
  externalIds: {
    openAlex: String,
    arxiv: String,
    semanticScholar: String,
    pubmed: String,
    doi: String
  },
  
  // Search metadata
  searchRelevanceScore: { type: Number, default: null }
}
```

Add indexes:
```javascript
paperSchema.index({ "externalIds.doi": 1 });
paperSchema.index({ studyType: 1, year: 1 });
paperSchema.index({ codeAvailable: 1, dataAvailable: 1 });
paperSchema.index({ citedByCount: -1 });
```

### 1.2 Configuration Updates

**File**: `server/config.js`

```javascript
export const config = {
  // ... existing config ...
  
  // Discovery & Search
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-large",
  embeddingDimensions: 1536,
  
  semanticScholarApiKey: process.env.SEMANTIC_SCHOLAR_API_KEY || "",
  pubmedEmail: process.env.PUBMED_EMAIL || config.openAlexEmail,
  
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  
  searchCacheTtl: parseInt(process.env.SEARCH_CACHE_TTL) || 300,
  maxConcurrentSources: parseInt(process.env.MAX_CONCURRENT_SOURCES) || 5,
  searchTimeout: parseInt(process.env.SEARCH_TIMEOUT) || 15000,
  
  titleSimilarityThreshold: parseFloat(process.env.TITLE_SIMILARITY_THRESHOLD) || 0.95,
  embeddingSimilarityThreshold: parseFloat(process.env.EMBEDDING_SIMILARITY_THRESHOLD) || 0.92,
};
```

### 1.3 SearchProvider Interface

**File**: `server/services/search/SearchProvider.js` (new)

```javascript
/**
 * Base interface for all search providers
 */
export class SearchProvider {
  constructor(config = {}) {
    this.name = "base";
    this.config = config;
  }

  async search(query) {
    throw new Error("search() must be implemented");
  }

  async getPaper(id) {
    throw new Error("getPaper() must be implemented");
  }

  async getCitations(id, options = {}) {
    throw new Error("getCitations() must be implemented");
  }

  normalize(rawPaper) {
    throw new Error("normalize() must be implemented");
  }

  async isAvailable() {
    return true;
  }
}
```

---

## Phase 2: Natural-Language Query Parser (Week 1-2)

### 2.1 Query Parser Service

**File**: `server/services/search/queryParser.js` (new)

Uses DeepSeek to parse natural language into structured search intent.

**Key features**:
- Extracts main topic, keywords, filters
- Identifies study type, population, date ranges
- Detects code/data requirements
- Caches parsed queries (1 hour TTL)
- Fallback to regex if LLM fails

**Example**:
```javascript
Input: "find RCTs on drug X in mice since 2020 with code"
Output: {
  mainTopic: "drug X",
  keywords: ["drug X", "RCT", "mice"],
  filters: {
    studyType: "rct",
    population: "mice",
    yearFrom: 2020,
    hasCode: true
  },
  searchQuery: "drug X randomized controlled trial mice",
  sortBy: "relevance",
  maxResults: 20
}
```

### 2.2 Integration with AI Router

**File**: `server/services/aiRouter.js` (update)

Add search intent detection:
```javascript
if (/search|find|papers|research|literature/i.test(text)) {
  const intent = await parseQuery(text, { locale });
  return { kind: "search", intent, confidence: 0.9 };
}
```

---

## Phase 3: Multi-Source Federation (Week 2)

### 3.1 Refactor Existing Adapters

Update `openalex.js`, `arxiv.js`, `semanticScholar.js` to extend `SearchProvider`.

### 3.2 Federation Manager

**File**: `server/services/search/federationManager.js` (new)

**Features**:
- Parallel queries to all sources (Promise.all)
- 15-second timeout per source
- Graceful degradation (continue if one source fails)
- Multi-stage deduplication:
  1. DOI matching
  2. Fuzzy title matching (95% threshold)
  3. Embedding similarity (Phase 4)
- Reciprocal Rank Fusion (RRF) for ranking
- Redis caching (5-minute TTL)

### 3.3 Search API Routes

**File**: `server/routes/search.js` (new)

```javascript
POST /api/search/query
  - Natural language search
  - Returns: { query, results, metadata }

GET /api/search/similar/:paperId
  - Find similar papers (Phase 4)

POST /api/search/federated
  - Direct federated search with structured query
```

---

## Phase 4: MongoDB Atlas Vector Search (Week 2-3)

### 4.1 Vector Search Index Setup

**MongoDB Atlas Configuration**:
```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "embedding": {
        "type": "knnVector",
        "dimensions": 1536,
        "similarity": "cosine"
      },
      "title": { "type": "string" },
      "abstract": { "type": "string" },
      "year": { "type": "number" },
      "citedByCount": { "type": "number" }
    }
  }
}
```

### 4.2 Embedding Service

**File**: `server/services/search/embeddingService.js` (new)

- OpenAI text-embedding-3-large API
- Batch processing (100 texts per request)
- Permanent caching (30 days)
- Cost: ~$0.13 per 1M tokens

### 4.3 Semantic Search Service

**File**: `server/services/search/semanticSearch.js` (new)

**Hybrid search** (BM25 + Vector):
- 70% vector similarity
- 30% keyword matching
- Filters applied at search time
- Returns top-k with relevance scores

### 4.4 Background Embedding Job

**File**: `server/workers/embedPapers.js` (new)

```bash
npm run embed:papers
```

Processes 1000 papers at a time, generates embeddings for title + abstract.

---

## Phase 5: Advanced Filters (Week 3)

### 5.1 Metadata Extractor

**File**: `server/services/search/metadataExtractor.js` (new)

Uses DeepSeek to extract from abstracts:
- Study type (RCT, cohort, meta-analysis, etc.)
- Sample size
- Population (mice, humans, in-silico)
- Datasets mentioned
- Code/data availability

### 5.2 Code & Data Detector

**File**: `server/services/search/codeDataDetector.js` (new)

Regex patterns for:
- GitHub/GitLab/Bitbucket URLs
- Zenodo/Figshare/OSF links
- Dataset mentions (ImageNet, MIMIC, etc.)

### 5.3 Filter API

**File**: `server/routes/search.js` (update)

```javascript
POST /api/search/filter
  - Apply filters to existing results
  - Filters: studyType, year range, hasCode, hasData, minCitations
```

---

## Phase 6: Citation Intelligence (Phase 2 - Week 4)

### 6.1 Citation Graph

**File**: `server/services/search/citationGraph.js` (new)

- Build citation relationships (forward/backward)
- BFS/DFS traversal with depth limits
- PageRank for influence scoring

### 6.2 "More Like This" Feature

Combines:
- Embedding similarity (60%)
- Co-citation analysis (20%)
- Bibliographic coupling (20%)

---

## Phase 7: Monitoring & Alerts (Phase 2 - Week 5)

### 7.1 Author/Venue Tracking

**File**: `server/models/Subscription.js` (new)

Track:
- Author ORCID/Semantic Scholar IDs
- Journal/conference ISSNs
- Keyword alerts

### 7.2 Alert Service

**File**: `server/services/alertService.js` (new)

- Cron job (daily/weekly)
- Email/push notifications
- Digest format

---

## File Structure

```
server/
├── models/
│   └── Paper.js (update schema)
├── routes/
│   └── search.js (new)
├── services/
│   ├── search/
│   │   ├── SearchProvider.js (new)
│   │   ├── queryParser.js (new)
│   │   ├── federationManager.js (new)
│   │   ├── embeddingService.js (new)
│   │   ├── semanticSearch.js (new)
│   │   ├── metadataExtractor.js (new)
│   │   ├── codeDataDetector.js (new)
│   │   ├── citationGraph.js (new - Phase 2)
│   │   └── deduplicator.js (new)
│   └── ingestion/
│       ├── openalex.js (refactor)
│       ├── arxiv.js (refactor)
│       └── semanticScholar.js (refactor)
├── workers/
│   └── embedPapers.js (new)
└── config.js (update)

docs/
├── DISCOVERY_SEARCH_IMPLEMENTATION_PLAN.md (this file)
├── MONGODB_ATLAS_VECTOR_SETUP.md (new)
└── adr/
    └── 001-discovery-search-architecture.md (new)
```

---

## Testing Strategy

### Unit Tests
```bash
npm run test:search
```

Test files:
- `tests/query-parser.test.js`
- `tests/federation-manager.test.js`
- `tests/deduplication.test.js`
- `tests/metadata-extractor.test.js`

### Integration Tests
- End-to-end search flow
- Multi-source federation
- Deduplication accuracy

### Performance Tests
- Query latency (<2s for federated search)
- Embedding generation throughput
- Cache hit rates

---

## Deployment Checklist

### Environment Variables
```env
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-large
SEMANTIC_SCHOLAR_API_KEY=optional
REDIS_URL=redis://localhost:6379
SEARCH_CACHE_TTL=300
```

### MongoDB Atlas Setup
1. Enable Atlas Search
2. Create vector search index
3. Wait for index build (~10 minutes)

### Redis Setup
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

### Initial Data Migration
```bash
npm run embed:papers
```

---

## Cost Estimates

### Monthly Costs (10K papers, 100 queries/day)

| Service | Usage | Cost |
|---------|-------|------|
| OpenAI Embeddings | 10K papers × 500 tokens | $0.65 |
| OpenAI Embeddings | 100 queries/day × 30 days | $0.20 |
| Semantic Scholar | Free tier | $0 |
| OpenAlex | Free | $0 |
| arXiv | Free | $0 |
| Redis | Self-hosted | $0 |
| MongoDB Atlas | M10 cluster | $57/month |
| **Total** | | **~$58/month** |

Within $50/month budget if using existing MongoDB cluster.

---

## Success Metrics

### MVP Success Criteria
- [ ] Natural language queries work 90%+ of time
- [ ] Federated search returns results in <2 seconds
- [ ] Deduplication accuracy >95%
- [ ] Semantic search finds relevant papers (user feedback)
- [ ] Advanced filters work correctly

### Performance Targets
- Query latency: <2s (p95)
- Cache hit rate: >60%
- Embedding generation: <5s per paper
- Deduplication accuracy: >95%

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Set up development environment** (Redis, MongoDB Atlas)
3. **Start Phase 1** (schema updates, interfaces)
4. **Implement incrementally** (one phase at a time)
5. **Test thoroughly** before moving to next phase

---

## Questions & Decisions Needed

1. ✅ Vector DB choice → MongoDB Atlas Vector Search
2. ✅ Embedding provider → OpenAI text-embedding-3-large
3. ✅ MVP priorities → NL search, federation, filters
4. ✅ Budget → $50/month
5. ✅ Scale → 10K papers, 100 queries/day

**Ready to proceed with implementation!**