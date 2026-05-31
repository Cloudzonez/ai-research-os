# ADR 001: Discovery & Search Architecture

**Status**: Proposed  
**Date**: 2026-05-31  
**Deciders**: Development Team  
**Context**: Extending AI Research OS with comprehensive discovery and search capabilities

---

## Context and Problem Statement

The current AI Research OS has basic paper search through OpenAlex, arXiv, and Semantic Scholar, but lacks:
- Natural language query understanding
- Semantic/vector search capabilities
- Multi-source federation with intelligent deduplication
- Advanced filtering by methodology, datasets, code availability
- Citation graph exploration
- Research monitoring and alerts

We need to design a scalable, extensible search architecture that:
1. Supports 10K papers initially, scaling to 100K+
2. Handles 100 queries/day with <2s latency
3. Works within $50/month API budget
4. Integrates seamlessly with existing Node.js/MongoDB stack

---

## Decision Drivers

- **Minimize infrastructure changes**: Prefer solutions using existing MongoDB
- **Cost efficiency**: Stay within $50/month budget
- **Developer experience**: Use familiar Node.js patterns
- **Extensibility**: Easy to add new search sources
- **Performance**: Sub-2-second query latency
- **Reliability**: Graceful degradation when sources fail

---

## Considered Options

### Option 1: MongoDB Atlas Vector Search ✅ CHOSEN
**Pros**:
- Uses existing MongoDB infrastructure
- No new database to manage
- Native integration with Mongoose
- Supports hybrid search (BM25 + vector)
- Included in M10+ Atlas clusters ($57/month)

**Cons**:
- Requires Atlas (not self-hosted MongoDB)
- Limited to cosine similarity
- Index build time (~10 minutes for 10K papers)

### Option 2: Qdrant (Dedicated Vector DB)
**Pros**:
- Purpose-built for vector search
- Better performance at scale
- More similarity metrics
- Self-hosted option available

**Cons**:
- New infrastructure to manage
- Additional deployment complexity
- Learning curve for team
- Extra costs for cloud hosting

### Option 3: pgvector (PostgreSQL Extension)
**Pros**:
- Mature, battle-tested
- Good performance
- SQL familiarity

**Cons**:
- Requires adding PostgreSQL
- Data duplication (MongoDB + Postgres)
- Migration complexity
- Extra infrastructure costs

### Option 4: Skip Vector Search (BM25 Only)
**Pros**:
- No new infrastructure
- Zero additional cost
- Simple implementation

**Cons**:
- No semantic search capability
- Limited relevance ranking
- Misses key user requirement

---

## Decision Outcome

**Chosen option**: MongoDB Atlas Vector Search

**Rationale**:
1. **Minimal infrastructure change**: Uses existing MongoDB
2. **Cost effective**: Included in current Atlas plan
3. **Good enough performance**: Handles 10K-100K papers well
4. **Team familiarity**: Mongoose integration, no new query language
5. **Hybrid search**: Combines keyword + semantic search

---

## Architecture Decisions

### 1. SearchProvider Interface Pattern

**Decision**: Use adapter pattern with base `SearchProvider` class

**Rationale**:
- Easy to add new sources (PubMed, CORE, etc.)
- Consistent normalization across sources
- Testable in isolation
- Graceful degradation

**Implementation**:
```javascript
class SearchProvider {
  async search(query) { /* ... */ }
  async getPaper(id) { /* ... */ }
  async getCitations(id, options) { /* ... */ }
  normalize(rawPaper) { /* ... */ }
}
```

### 2. Deduplication Strategy

**Decision**: Multi-stage deduplication (DOI → Fuzzy Title → Embedding)

**Rationale**:
- DOI is authoritative but not always present
- Fuzzy title matching catches near-duplicates
- Embedding similarity for edge cases
- 95% threshold balances precision/recall

**Stages**:
1. **DOI matching** (exact, O(1) with Map)
2. **Fuzzy title** (Levenshtein, 95% threshold)
3. **Embedding similarity** (cosine, 92% threshold) - Phase 4

### 3. Query Parsing Strategy

**Decision**: LLM-based parsing with regex fallback

**Rationale**:
- LLM handles complex natural language
- Structured output (JSON) for consistency
- Regex fallback ensures reliability
- Caching reduces API costs

**Example**:
```
Input: "find RCTs on drug X in mice since 2020"
LLM Output: {
  mainTopic: "drug X",
  filters: { studyType: "rct", population: "mice", yearFrom: 2020 }
}
```

### 4. Ranking Algorithm

**Decision**: Reciprocal Rank Fusion (RRF) for multi-source ranking

**Rationale**:
- Source-agnostic (no score normalization needed)
- Proven effective in meta-search
- Simple to implement
- Handles missing scores gracefully

**Formula**: `score = Σ(1 / (k + rank))` where k=60

### 5. Caching Strategy

**Decision**: Redis with source-specific TTLs

**Rationale**:
- Free APIs: 5-minute TTL (respect rate limits)
- Paid APIs: 1-hour TTL (reduce costs)
- Embeddings: 30-day TTL (expensive to regenerate)
- Query parses: 1-hour TTL (stable results)

### 6. Embedding Model

**Decision**: OpenAI text-embedding-3-large

**Rationale**:
- High quality (1536 dimensions)
- Cost effective ($0.13/1M tokens)
- Proven in production
- Easy API integration

**Alternatives considered**:
- DeepSeek embeddings (not available yet)
- BGE-large (self-hosted, more complex)
- Sentence-Transformers (lower quality)

### 7. Federation Timeout Strategy

**Decision**: 15-second timeout per source, continue on failure

**Rationale**:
- User experience: 2-second target, 15s max
- Reliability: Don't fail entire search if one source is down
- Parallel execution: All sources queried simultaneously
- Logging: Track failures for monitoring

---

## Consequences

### Positive
- ✅ Minimal infrastructure changes
- ✅ Cost-effective solution
- ✅ Extensible architecture
- ✅ Graceful degradation
- ✅ Team can maintain easily

### Negative
- ⚠️ Requires MongoDB Atlas (not self-hosted)
- ⚠️ Vector index build time (~10 min)
- ⚠️ OpenAI API dependency for embeddings
- ⚠️ Redis required for caching

### Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenAI API outage | No new embeddings | Cache embeddings permanently, batch process |
| MongoDB Atlas costs | Budget overrun | Monitor usage, optimize queries, consider self-hosted Qdrant later |
| Search source rate limits | Failed queries | Implement exponential backoff, cache aggressively |
| Deduplication false positives | Missing papers | Tune thresholds, add manual review UI |

---

## Implementation Notes

### Phase 1 (Week 1): Foundation
- Update Paper schema
- Create SearchProvider interface
- Refactor existing adapters

### Phase 2 (Week 1-2): Query Parser
- Implement LLM-based parser
- Add regex fallback
- Integrate with AI router

### Phase 3 (Week 2): Federation
- Build federation manager
- Implement RRF ranking
- Add deduplication

### Phase 4 (Week 2-3): Vector Search
- Set up MongoDB Atlas index
- Implement embedding service
- Add semantic search

### Phase 5 (Week 3): Advanced Filters
- Metadata extraction
- Code/data detection
- Filter API

---

## References

- [MongoDB Atlas Vector Search Docs](https://www.mongodb.com/docs/atlas/atlas-vector-search/)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [Reciprocal Rank Fusion Paper](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)
- [Semantic Scholar API](https://api.semanticscholar.org/)
- [OpenAlex API](https://docs.openalex.org/)

---

## Approval

- [ ] Technical Lead
- [ ] Product Owner
- [ ] DevOps Team

**Next Review**: After Phase 3 completion (Week 2)