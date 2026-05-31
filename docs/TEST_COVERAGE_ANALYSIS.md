# Test Coverage Analysis
**Generated**: 2026-05-31  
**Project**: AI Research OS

## Executive Summary

### Overall Status: ⚠️ PARTIALLY COVERED

- **Total Test Files**: 28
- **Total Source Files**: ~70
- **Coverage**: ~60% (estimated)
- **Missing Tests**: 6 new modules from Discovery & Search

---

## ✅ Well-Tested Modules (Existing Tests)

### Core Services (8 tests)
| Test File | Source File | Status |
|-----------|-------------|--------|
| `cache-service.test.js` | `services/cache.js` | ✅ Covered |
| `queue-service.test.js` | `services/queue.js` | ✅ Covered |
| `storage-service.test.js` | `services/storage.js` | ✅ Covered |
| `paper-analyzer.test.js` | `services/paperAnalyzer.js` | ✅ Covered |
| `context-engine.test.js` | `services/contextEngine.js` | ✅ Covered |
| `token-flow.test.js` | `services/tokenFlow.js` | ✅ Covered |
| `text-chunker.test.js` | `services/textChunker.js` | ✅ Covered |
| `context-tiers.test.js` | `services/contextTiers.js` | ✅ Covered |

### Orchestrators (3 tests)
| Test File | Source File | Status |
|-----------|-------------|--------|
| `tool-registry.test.js` | `services/toolRegistry.js` | ✅ Covered |
| `mcp-gateway.test.js` | `services/mcpGateway.js` | ✅ Covered |
| `agent-runner.test.js` | `services/agentRunner.js` | ✅ Covered |

### Crawlers & Ingestion (4 tests)
| Test File | Source File | Status |
|-----------|-------------|--------|
| `standard-crawler.test.js` | `services/standardCrawler.js` | ✅ Covered |
| `connector-parser.test.js` | `services/crawlerFactory.js` | ✅ Covered |
| `tracker-crawl.test.js` | `services/trackerCrawl.js` | ✅ Covered |
| `live-standard-crawler.test.js` | `services/standardCrawler.js` | ✅ Covered (live) |

### Pure Logic (5 tests)
| Test File | Source File | Status |
|-----------|-------------|--------|
| `deepseek-parse.test.js` | `services/deepseek.js` | ✅ Covered |
| `model-mesh.test.js` | `services/modelMesh.js` | ✅ Covered |
| `sandbox-validate.test.js` | `services/sandbox.js` | ✅ Covered |
| `approval-pure.test.js` | `middleware/approval.js` | ✅ Covered |
| `context-escalation.test.js` | `services/contextEngine.js` | ✅ Covered |

### Middleware (1 test)
| Test File | Source File | Status |
|-----------|-------------|--------|
| `auth-middleware.test.js` | `middleware/auth.js` | ✅ Covered |

### Workers (1 test)
| Test File | Source File | Status |
|-----------|-------------|--------|
| `worker-runner.test.js` | `workers/runner.js` | ✅ Covered |

### Integration Tests (3 tests)
| Test File | Coverage | Status |
|-----------|----------|--------|
| `story-1-pdf-pipeline.test.js` | PDF upload → parse → save | ✅ Covered |
| `story-2-tracker-crawl.test.js` | Tracker → crawl → store | ✅ Covered |
| `story-3-context-chat.test.js` | Context → chat → response | ✅ Covered |

### E2E Tests (8 tests)
| Test File | Coverage | Status |
|-----------|----------|--------|
| `e2e/login.spec.js` | User authentication flow | ✅ Covered |
| `e2e/paper-library.spec.js` | Paper management UI | ✅ Covered |
| `e2e/foundry.spec.js` | Foundry features | ✅ Covered |
| `e2e/governance.spec.js` | Governance workflows | ✅ Covered |
| `e2e/writing.spec.js` | Writing assistant | ✅ Covered |
| `e2e/preferences.spec.js` | User preferences | ✅ Covered |
| `e2e/error-states.spec.js` | Error handling | ✅ Covered |
| `e2e/local-first-workflow.spec.js` | Local-first features | ✅ Covered |

---

## ⚠️ NEW MODULES - Tests Exist (Discovery & Search)

### Search Module (2 tests) ✅
| Test File | Source File | Status |
|-----------|-------------|--------|
| `query-parser.test.js` | `services/search/queryParser.js` | ✅ **CREATED** |
| `federation-manager.test.js` | `services/search/federationManager.js` | ✅ **CREATED** |

**Test Coverage**:
- ✅ Query parsing with LLM
- ✅ Fallback parsing
- ✅ Multi-source federation
- ✅ Deduplication
- ✅ RRF ranking
- ✅ Provider health checks

---

## ❌ MISSING TESTS (Need to Create)

### Search Module - Missing Tests (6 files)

#### 1. `embeddingService.js` ❌
**Priority**: HIGH  
**Complexity**: Medium  
**Why Needed**: Critical for semantic search

**Suggested Tests**:
```javascript
// tests/embedding-service.test.js
- should generate embeddings for text
- should handle batch embedding requests
- should cache embeddings
- should handle OpenAI API errors
- should respect rate limits
```

#### 2. `semanticSearch.js` ❌
**Priority**: HIGH  
**Complexity**: High  
**Why Needed**: Core vector search functionality

**Suggested Tests**:
```javascript
// tests/semantic-search.test.js
- should perform vector similarity search
- should combine with keyword search (hybrid)
- should handle empty results
- should respect maxResults parameter
- should filter by metadata
```

#### 3. `citationGraph.js` ❌
**Priority**: MEDIUM  
**Complexity**: High  
**Why Needed**: Citation intelligence features

**Suggested Tests**:
```javascript
// tests/citation-graph.test.js
- should build citation graph
- should find "more like this" papers
- should calculate co-citation scores
- should calculate bibliographic coupling
- should handle papers with no citations
```

#### 4. `metadataExtractor.js` ❌
**Priority**: MEDIUM  
**Complexity**: Medium  
**Why Needed**: Advanced filtering

**Suggested Tests**:
```javascript
// tests/metadata-extractor.test.js
- should extract study type from abstract
- should extract population from text
- should extract sample size
- should handle missing metadata
- should cache extraction results
```

#### 5. `codeDataDetector.js` ❌
**Priority**: LOW  
**Complexity**: Low  
**Why Needed**: Code/data availability detection

**Suggested Tests**:
```javascript
// tests/code-data-detector.test.js
- should detect GitHub URLs
- should detect dataset mentions
- should extract dataset names
- should handle papers without code/data
- should detect multiple datasets
```

#### 6. `alertService.js` ❌
**Priority**: MEDIUM  
**Complexity**: Medium  
**Why Needed**: Subscription monitoring

**Suggested Tests**:
```javascript
// tests/alert-service.test.js
- should check subscriptions
- should generate alerts for new papers
- should respect subscription filters
- should handle multiple subscriptions
- should not duplicate alerts
```

### Routes - Missing Tests (1 file)

#### 7. `routes/search.js` ❌
**Priority**: HIGH  
**Complexity**: Medium  
**Why Needed**: API endpoint testing

**Suggested Tests**:
```javascript
// tests/routes/search.test.js
- POST /api/search/query should return results
- POST /api/search/semantic should perform vector search
- GET /api/search/providers should list providers
- GET /api/search/health should check provider health
- should handle authentication
- should validate request parameters
```

### Models - Missing Tests (1 file)

#### 8. `models/Subscription.js` ❌
**Priority**: LOW  
**Complexity**: Low  
**Why Needed**: Data model validation

**Suggested Tests**:
```javascript
// tests/subscription-model.test.js
- should create subscription with valid data
- should validate required fields
- should validate subscription type
- should validate filters
- should handle duplicate subscriptions
```

### Workers - Missing Tests (1 file)

#### 9. `workers/embedPapers.js` ❌
**Priority**: MEDIUM  
**Complexity**: Medium  
**Why Needed**: Background job testing

**Suggested Tests**:
```javascript
// tests/embed-papers-worker.test.js
- should generate embeddings for papers without them
- should batch process papers
- should handle API errors gracefully
- should update paper records
- should log progress
```

---

## 📊 Test Coverage Summary

### By Priority

| Priority | Missing Tests | Files |
|----------|---------------|-------|
| **HIGH** | 3 | `embeddingService.js`, `semanticSearch.js`, `routes/search.js` |
| **MEDIUM** | 4 | `citationGraph.js`, `metadataExtractor.js`, `alertService.js`, `workers/embedPapers.js` |
| **LOW** | 2 | `codeDataDetector.js`, `models/Subscription.js` |
| **Total** | **9** | **9 files** |

### By Module

| Module | Total Files | Tested | Missing | Coverage |
|--------|-------------|--------|---------|----------|
| Core Services | 15 | 8 | 0 | 100% ✅ |
| Search Services | 8 | 2 | 6 | 25% ⚠️ |
| Orchestrators | 3 | 3 | 0 | 100% ✅ |
| Crawlers | 4 | 4 | 0 | 100% ✅ |
| Middleware | 2 | 2 | 0 | 100% ✅ |
| Routes | 10 | 0 | 1 | 0% ❌ |
| Models | 14 | 0 | 1 | 0% ❌ |
| Workers | 2 | 1 | 1 | 50% ⚠️ |

---

## 🎯 Recommendations

### Immediate Actions (This Week)

1. **Create HIGH priority tests** (3 files):
   - `tests/embedding-service.test.js`
   - `tests/semantic-search.test.js`
   - `tests/routes/search.test.js`

2. **Run existing tests** to ensure they pass:
   ```bash
   npm run test:backend
   npm run test:search
   ```

### Short-term Actions (Next 2 Weeks)

3. **Create MEDIUM priority tests** (4 files):
   - `tests/citation-graph.test.js`
   - `tests/metadata-extractor.test.js`
   - `tests/alert-service.test.js`
   - `tests/embed-papers-worker.test.js`

4. **Set up CI/CD** to run tests automatically

### Long-term Actions (Next Month)

5. **Create LOW priority tests** (2 files):
   - `tests/code-data-detector.test.js`
   - `tests/subscription-model.test.js`

6. **Add integration tests** for Discovery & Search:
   - `tests/story-4-discovery-search.test.js`

7. **Increase E2E coverage**:
   - `tests/e2e/search-discovery.spec.js`

---

## 🔧 Test Creation Template

### For New Service Tests

```javascript
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { functionName } from "../server/services/moduleName.js";

// Mock dependencies
const mockCache = new Map();

before(async () => {
  // Setup mocks
  global.getCache = async (key) => mockCache.get(key);
  global.setCache = async (key, value) => mockCache.set(key, value);
});

after(async () => {
  // Cleanup
  mockCache.clear();
});

describe("Module Name", () => {
  describe("functionName", () => {
    it("should do something", async () => {
      const result = await functionName("input");
      assert.ok(result);
    });
  });
});
```

---

## 📈 Test Metrics

### Current State
- **Total Tests**: ~50+ test cases
- **Test Files**: 28
- **Coverage**: ~60% (estimated)
- **Passing**: Unknown (tests running)

### Target State
- **Total Tests**: ~80+ test cases
- **Test Files**: 37 (28 + 9 new)
- **Coverage**: ~85%
- **Passing**: 100%

---

## 🚀 Running Tests

### All Tests
```bash
npm run test:backend
```

### By Category
```bash
npm run test:search        # Search & Discovery
npm run test:services      # Core services
npm run test:pure          # Pure logic
npm run test:e2e           # End-to-end
```

### Single Test
```bash
node --test tests/query-parser.test.js
```

---

## 📝 Notes

1. **Existing tests are comprehensive** for core functionality
2. **New Discovery & Search module** has partial coverage (2/8 files)
3. **Priority should be** on testing critical search features
4. **Integration tests** would benefit from Discovery & Search scenarios
5. **E2E tests** should include search UI workflows

---

## ✅ Action Items

- [ ] Create `tests/embedding-service.test.js`
- [ ] Create `tests/semantic-search.test.js`
- [ ] Create `tests/routes/search.test.js`
- [ ] Create `tests/citation-graph.test.js`
- [ ] Create `tests/metadata-extractor.test.js`
- [ ] Create `tests/alert-service.test.js`
- [ ] Create `tests/embed-papers-worker.test.js`
- [ ] Create `tests/code-data-detector.test.js`
- [ ] Create `tests/subscription-model.test.js`
- [ ] Run all tests and verify they pass
- [ ] Set up CI/CD pipeline
- [ ] Add test coverage reporting

---

**Last Updated**: 2026-05-31  
**Status**: Tests running, analysis based on file structure