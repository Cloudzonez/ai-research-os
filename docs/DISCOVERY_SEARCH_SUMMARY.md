# Discovery & Search Module - Executive Summary

> **TL;DR**: Comprehensive plan to add advanced paper discovery and search to AI Research OS using natural language queries, multi-source federation, semantic search, and intelligent filtering.

---

## What We're Building

A powerful research paper discovery system that lets users:

1. **Search naturally**: "Find RCTs on drug X in mice since 2020 with code"
2. **Search everywhere**: Parallel queries across OpenAlex, arXiv, Semantic Scholar, PubMed
3. **Find similar papers**: Semantic search using AI embeddings
4. **Filter intelligently**: By methodology, datasets, code/data availability
5. **Track research**: Monitor authors, venues, keywords (Phase 2)

---

## Key Features (MVP)

### 1. Natural Language Search
- **Input**: "find papers showing transformers improve NLP tasks"
- **Output**: Structured query with filters, keywords, date ranges
- **Tech**: DeepSeek LLM parses query → structured JSON
- **Fallback**: Regex-based parsing if LLM fails

### 2. Multi-Source Federation
- **Sources**: OpenAlex, arXiv, Semantic Scholar (+ PubMed, CORE later)
- **Parallel**: All sources queried simultaneously (15s timeout)
- **Deduplication**: DOI → Fuzzy title (95%) → Embedding similarity (92%)
- **Ranking**: Reciprocal Rank Fusion (RRF) combines source rankings

### 3. Semantic Search
- **Tech**: MongoDB Atlas Vector Search + OpenAI embeddings
- **Hybrid**: 70% vector similarity + 30% keyword matching
- **Similar papers**: Find papers like a given paper
- **Cost**: ~$0.65 for 10K papers, $0.12/month for queries

### 4. Advanced Filters
- **Study type**: RCT, cohort, meta-analysis, review, experimental
- **Population**: Mice, humans, in-silico, cell culture
- **Code/Data**: GitHub links, Zenodo, Figshare, OSF
- **Datasets**: ImageNet, MIMIC, COCO, etc.
- **Citations**: Minimum citation count, year range

---

## Architecture at a Glance

```
User Query → Query Parser (LLM) → Federation Manager
                                         ↓
                    ┌────────────────────┼────────────────────┐
                    ↓                    ↓                    ↓
                OpenAlex              arXiv           Semantic Scholar
                    ↓                    ↓                    ↓
                    └────────────────────┼────────────────────┘
                                         ↓
                              Deduplicator (DOI/Title/Embedding)
                                         ↓
                              Ranker (RRF) + Filters
                                         ↓
                              MongoDB (Save) + Cache (Redis)
                                         ↓
                              Results to User
```

---

## Technical Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| **Vector DB** | MongoDB Atlas Vector Search | Uses existing MongoDB, no new infra |
| **Embeddings** | OpenAI text-embedding-3-large | High quality, cost-effective |
| **Query Parser** | DeepSeek LLM | Already integrated, good at structured output |
| **Cache** | Redis | Fast, simple, handles rate limits |
| **Dedup** | Levenshtein + Cosine | Multi-stage, high accuracy |
| **Ranking** | Reciprocal Rank Fusion | Source-agnostic, proven effective |

---

## Implementation Timeline

### Phase 1: Foundation (Week 1)
- ✅ Update Paper schema (embeddings, metadata fields)
- ✅ Create SearchProvider interface
- ✅ Update config for OpenAI, Redis
- ✅ Write ADR and setup docs

### Phase 2: Query Parser (Week 1-2)
- Implement LLM-based query parser
- Add regex fallback
- Integrate with AI router
- Cache parsed queries

### Phase 3: Federation (Week 2)
- Refactor existing adapters (OpenAlex, arXiv, Semantic Scholar)
- Build federation manager
- Implement deduplication
- Add RRF ranking
- Create search API routes

### Phase 4: Vector Search (Week 2-3)
- Set up MongoDB Atlas vector index
- Implement embedding service
- Build semantic search
- Create background embedding job
- Add "similar papers" feature

### Phase 5: Advanced Filters (Week 3)
- Metadata extractor (study type, population, sample size)
- Code/data detector (GitHub, Zenodo, datasets)
- Filter API endpoints
- Enrich existing papers

### Phase 6: Citation Graph (Week 4 - Phase 2)
- Build citation relationships
- Implement graph traversal
- Add PageRank scoring
- "More like this" with co-citation

### Phase 7: Monitoring (Week 5 - Phase 2)
- Author/venue subscriptions
- Alert service (email/push)
- Digest generation
- Cron jobs

---

## Cost Breakdown

### Monthly Costs (10K papers, 100 queries/day)

| Item | Cost |
|------|------|
| MongoDB Atlas M10 | $57 |
| OpenAI Embeddings (initial) | $0.65 one-time |
| OpenAI Embeddings (queries) | $0.12/month |
| Semantic Scholar API | Free |
| OpenAlex API | Free |
| arXiv API | Free |
| Redis (self-hosted) | $0 |
| **Total** | **~$58/month** |

✅ Within $50/month budget if using existing MongoDB cluster

---

## Success Metrics

### MVP Success Criteria
- [ ] Natural language queries work 90%+ of time
- [ ] Federated search returns results in <2 seconds
- [ ] Deduplication accuracy >95%
- [ ] Semantic search finds relevant papers
- [ ] Advanced filters work correctly

### Performance Targets
- Query latency: <2s (p95)
- Cache hit rate: >60%
- Embedding generation: <5s per paper
- Deduplication accuracy: >95%

---

## Files Created/Modified

### New Files (Phase 1-5)
```
server/services/search/
├── SearchProvider.js          # Base interface
├── queryParser.js             # LLM query parser
├── federationManager.js       # Multi-source orchestrator
├── embeddingService.js        # OpenAI embeddings
├── semanticSearch.js          # Vector search
├── metadataExtractor.js       # Study type, population
├── codeDataDetector.js        # GitHub, datasets
└── deduplicator.js            # DOI/title/embedding dedup

server/routes/
└── search.js                  # Search API endpoints

server/workers/
└── embedPapers.js             # Background embedding job

docs/
├── DISCOVERY_SEARCH_IMPLEMENTATION_PLAN.md
├── DISCOVERY_SEARCH_SUMMARY.md (this file)
├── MONGODB_ATLAS_VECTOR_SETUP.md
└── adr/
    └── 001-discovery-search-architecture.md
```

### Modified Files
```
server/models/Paper.js         # Add embedding, metadata fields
server/config.js               # Add OpenAI, Redis config
server/services/aiRouter.js    # Add search intent detection
server/services/ingestion/
├── openalex.js                # Extend SearchProvider
├── arxiv.js                   # Extend SearchProvider
└── semanticScholar.js         # Extend SearchProvider
```

---

## Next Steps

### For Product Owner
1. **Review** this plan and ADR
2. **Approve** MVP scope and timeline
3. **Confirm** budget allocation ($58/month)
4. **Prioritize** Phase 2 features (citation graph vs. alerts)

### For Development Team
1. **Set up environment**:
   - MongoDB Atlas M10+ cluster
   - Redis instance
   - OpenAI API key
2. **Start Phase 1**:
   - Update Paper schema
   - Create SearchProvider interface
   - Update config files
3. **Test incrementally**:
   - Unit tests for each service
   - Integration tests for federation
   - E2E tests for search flow

### For DevOps
1. **Provision infrastructure**:
   - MongoDB Atlas cluster (M10)
   - Redis instance (Docker or managed)
2. **Set up monitoring**:
   - Query latency metrics
   - API usage tracking
   - Error rate alerts
3. **Configure secrets**:
   - OpenAI API key
   - Semantic Scholar API key (optional)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| OpenAI API outage | Cache embeddings permanently, batch process |
| MongoDB Atlas costs exceed budget | Monitor usage, optimize queries, consider Qdrant later |
| Search source rate limits | Exponential backoff, aggressive caching |
| Deduplication false positives | Tune thresholds, add manual review UI |
| Low search quality | Collect user feedback, tune ranking weights |

---

## Questions?

**Technical questions**: See [`DISCOVERY_SEARCH_IMPLEMENTATION_PLAN.md`](./DISCOVERY_SEARCH_IMPLEMENTATION_PLAN.md)

**MongoDB setup**: See [`MONGODB_ATLAS_VECTOR_SETUP.md`](./MONGODB_ATLAS_VECTOR_SETUP.md)

**Architecture decisions**: See [`adr/001-discovery-search-architecture.md`](./adr/001-discovery-search-architecture.md)

---

## Approval Sign-off

- [ ] Product Owner: _____________________ Date: _____
- [ ] Technical Lead: _____________________ Date: _____
- [ ] DevOps Lead: _____________________ Date: _____

**Ready to start implementation!** 🚀