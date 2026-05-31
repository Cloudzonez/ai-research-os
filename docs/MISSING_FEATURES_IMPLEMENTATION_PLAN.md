# Missing Discovery & Search Features - Implementation Plan

**Status**: Planning Phase  
**Target Completion**: 6 phases, ~40 hours development time  
**Priority**: High - Completes Discovery & Search module to 100%

---

## Executive Summary

This plan addresses the 6 missing features from the Discovery & Search module:
1. Seminal/foundational papers detection
2. Paper relationship extraction (contradict/replicate/extend)
3. Grey literature search
4. Patent search integration
5. Additional academic sources (PubMed, SSRN, PhilPapers, CORE)
6. Google Scholar integration

**Current Implementation**: 68% (13/19 features)  
**Target**: 100% (19/19 features)

---

## Phase 8: Seminal Papers Detection

**Goal**: Identify foundational/seminal papers in a research area using citation age analysis and PageRank

### 8.1 Citation Age Analysis Service

**File**: `server/services/search/seminalPaperDetector.js`

```javascript
/**
 * Detect seminal papers using multiple signals:
 * 1. Citation velocity (citations per year since publication)
 * 2. Citation age distribution (cited by recent papers)
 * 3. Citation network centrality (PageRank)
 * 4. Cross-field citations (cited across multiple domains)
 */

export async function detectSeminalPapers(topic, options = {}) {
  // 1. Get papers on topic with citation data
  // 2. Calculate citation velocity score
  // 3. Analyze citation age distribution
  // 4. Compute PageRank on citation graph
  // 5. Detect cross-field citations
  // 6. Combine scores with weighted formula
}

export function calculateCitationVelocity(paper) {
  const age = new Date().getFullYear() - paper.year;
  return paper.citedByCount / Math.max(age, 1);
}

export function calculateCitationAgeScore(paper, citingPapers) {
  // Papers cited by recent work score higher
  const recentCitations = citingPapers.filter(
    p => new Date().getFullYear() - p.year <= 3
  );
  return recentCitations.length / citingPapers.length;
}

export async function calculatePageRank(papers, options = {}) {
  // Implement PageRank algorithm on citation graph
  // Higher PageRank = more central/influential
}
```

**Algorithm**:
```
Seminal Score = 
  0.3 * Citation Velocity +
  0.25 * Citation Age Score +
  0.25 * PageRank Score +
  0.2 * Cross-field Score
```

### 8.2 Database Schema Updates

**File**: `server/models/Paper.js`

Add fields:
```javascript
citationVelocity: Number,
citationAgeScore: Number,
pageRankScore: Number,
crossFieldScore: Number,
seminalScore: Number,
isSeminal: Boolean,
```

### 8.3 API Endpoint

**File**: `server/routes/search.js`

```javascript
router.get("/api/search/seminal", async (req, res) => {
  const { topic, minScore = 0.7 } = req.query;
  const seminalPapers = await detectSeminalPapers(topic, { minScore });
  res.json(seminalPapers);
});
```

### 8.4 Background Worker

**File**: `server/workers/calculateSeminalScores.js`

Periodic job to update seminal scores for all papers.

**Effort**: 8 hours  
**Priority**: Medium  
**Dependencies**: Citation graph data from Semantic Scholar

---

## Phase 9: Paper Relationship Extraction

**Goal**: Detect papers that contradict, replicate, or extend other papers using NLP

### 9.1 Relationship Extraction Service

**File**: `server/services/search/relationshipExtractor.js`

```javascript
/**
 * Extract relationships between papers using:
 * 1. Citation context analysis (what citing paper says)
 * 2. LLM-based relationship classification
 * 3. Claim comparison (contradiction detection)
 * 4. Methodology similarity (replication detection)
 */

const RELATIONSHIP_TYPES = {
  CONTRADICTS: "contradicts",
  REPLICATES: "replicates", 
  EXTENDS: "extends",
  SUPPORTS: "supports",
  REVIEWS: "reviews",
  APPLIES: "applies",
};

export async function extractRelationships(paperA, paperB) {
  // 1. Get citation context if B cites A
  // 2. Compare claims using LLM
  // 3. Compare methodologies
  // 4. Classify relationship type
}

export async function findRelatedPapers(paperId, relationshipType) {
  // Find papers with specific relationship to target paper
}
```

### 9.2 LLM Relationship Classifier

**Prompt Template**:
```javascript
const RELATIONSHIP_PROMPT = `Analyze the relationship between these two papers:

Paper A: {titleA}
Abstract A: {abstractA}

Paper B: {titleB}
Abstract B: {abstractB}

Citation context (if available): {citationContext}

Classify the relationship as one of:
- contradicts: Paper B contradicts findings/claims of Paper A
- replicates: Paper B replicates methodology/experiments of Paper A
- extends: Paper B extends/builds upon Paper A's work
- supports: Paper B provides supporting evidence for Paper A
- reviews: Paper B reviews/surveys Paper A
- applies: Paper B applies Paper A's methods to new domain

Return JSON: {"relationship": "type", "confidence": 0-1, "evidence": "brief explanation"}`;
```

### 9.3 Claim Comparison

Use existing `evidenceCards` from papers to compare claims:

```javascript
export async function compareClaimsForContradiction(paperA, paperB) {
  const claimsA = paperA.evidenceCards.map(c => c.claim);
  const claimsB = paperB.evidenceCards.map(c => c.claim);
  
  // Use LLM to detect contradictions
  const contradictions = [];
  for (const claimA of claimsA) {
    for (const claimB of claimsB) {
      const result = await detectContradiction(claimA, claimB);
      if (result.isContradiction) {
        contradictions.push(result);
      }
    }
  }
  return contradictions;
}
```

### 9.4 Database Schema

**File**: `server/models/PaperRelationship.js` (new model)

```javascript
const relationshipSchema = new mongoose.Schema({
  sourcePaperId: { type: ObjectId, ref: "Paper", required: true },
  targetPaperId: { type: ObjectId, ref: "Paper", required: true },
  relationshipType: { 
    type: String, 
    enum: ["contradicts", "replicates", "extends", "supports", "reviews", "applies"],
    required: true 
  },
  confidence: { type: Number, min: 0, max: 1 },
  evidence: String,
  citationContext: String,
  extractedAt: Date,
});
```

### 9.5 API Endpoints

```javascript
// Find papers that contradict paper X
GET /api/papers/:id/relationships?type=contradicts

// Find papers that replicate paper X
GET /api/papers/:id/relationships?type=replicates

// Find papers that extend paper X
GET /api/papers/:id/relationships?type=extends
```

**Effort**: 12 hours  
**Priority**: High  
**Dependencies**: LLM API, citation context data

---

## Phase 10: Grey Literature Integration

**Goal**: Search theses, preprints, reports, government documents

### 10.1 Grey Literature Providers

#### 10.1.1 BASE (Bielefeld Academic Search Engine)

**File**: `server/services/ingestion/base.js`

```javascript
export class BASEProvider extends SearchProvider {
  constructor() {
    super({ name: "base", timeout: 15000 });
    this.baseUrl = "https://api.base-search.net/cgi-bin/BaseHttpSearchInterface.fcgi";
  }

  async search(query) {
    // BASE API supports:
    // - 240M+ documents
    // - Theses, dissertations, reports
    // - Open access focus
  }
}
```

**API**: Free, no key required  
**Docs**: https://www.base-search.net/about/en/about_develop.php

#### 10.1.2 CORE (COnnecting REpositories)

**File**: `server/services/ingestion/core.js`

```javascript
export class COREProvider extends SearchProvider {
  constructor() {
    super({ name: "core", timeout: 15000 });
    this.apiKey = process.env.CORE_API_KEY;
    this.baseUrl = "https://api.core.ac.uk/v3";
  }

  async search(query) {
    // CORE API provides:
    // - 200M+ open access papers
    // - Repository metadata
    // - Full text when available
  }
}
```

**API**: Free tier 10K requests/month  
**Docs**: https://core.ac.uk/services/api

#### 10.1.3 OpenGrey

**File**: `server/services/ingestion/opengrey.js`

```javascript
export class OpenGreyProvider extends SearchProvider {
  constructor() {
    super({ name: "opengrey", timeout: 15000 });
    this.baseUrl = "http://www.opengrey.eu/api";
  }

  async search(query) {
    // OpenGrey specializes in:
    // - European grey literature
    // - Technical reports
    // - Conference papers
    // - Theses
  }
}
```

**API**: Free, OAI-PMH protocol  
**Docs**: http://www.opengrey.eu/

#### 10.1.4 ProQuest Dissertations & Theses

**File**: `server/services/ingestion/proquest.js`

```javascript
export class ProQuestProvider extends SearchProvider {
  constructor() {
    super({ name: "proquest", timeout: 15000 });
    this.apiKey = process.env.PROQUEST_API_KEY;
    this.baseUrl = "https://api.proquest.com/v1";
  }

  async search(query) {
    // ProQuest provides:
    // - 5M+ dissertations/theses
    // - Global coverage
    // - Full text for many
  }
}
```

**API**: Requires institutional access or paid API key  
**Docs**: https://about.proquest.com/en/products-services/pqdtglobal/

### 10.2 Grey Literature Type Detection

Add to `metadataExtractor.js`:

```javascript
export function detectGreyLiteratureType(paper) {
  const types = [];
  
  if (/thesis|dissertation|phd|master/i.test(paper.title)) {
    types.push("thesis");
  }
  if (/technical report|working paper/i.test(paper.title)) {
    types.push("report");
  }
  if (/preprint|arxiv|biorxiv|medrxiv/i.test(paper.source)) {
    types.push("preprint");
  }
  if (/government|policy|white paper/i.test(paper.title)) {
    types.push("government");
  }
  
  return types;
}
```

### 10.3 Schema Updates

Add to `Paper` model:
```javascript
greyLiteratureType: [String], // ["thesis", "report", "preprint", "government"]
institutionName: String,
degreeType: String, // "PhD", "Masters", etc.
```

**Effort**: 10 hours  
**Priority**: Medium  
**Dependencies**: API keys for CORE, ProQuest

---

## Phase 11: Patent Search Integration

**Goal**: Search patents alongside academic papers for applied research

### 11.1 Patent Providers

#### 11.1.1 USPTO (United States Patent Office)

**File**: `server/services/ingestion/uspto.js`

```javascript
export class USPTOProvider extends SearchProvider {
  constructor() {
    super({ name: "uspto", timeout: 20000 });
    this.baseUrl = "https://developer.uspto.gov/ibd-api/v1";
  }

  async search(query) {
    // USPTO API provides:
    // - US patents and applications
    // - Full text search
    // - Classification codes
    // - Citation data
  }

  normalize(rawPatent) {
    return {
      title: rawPatent.title,
      abstract: rawPatent.abstract,
      authors: rawPatent.inventors,
      year: new Date(rawPatent.publicationDate).getFullYear(),
      itemType: "patent",
      patentNumber: rawPatent.patentNumber,
      patentOffice: "USPTO",
      applicationDate: rawPatent.applicationDate,
      publicationDate: rawPatent.publicationDate,
      assignee: rawPatent.assignee,
      classifications: rawPatent.ipcCodes,
      url: `https://patents.google.com/patent/${rawPatent.patentNumber}`,
    };
  }
}
```

**API**: Free, no key required  
**Docs**: https://developer.uspto.gov/api-catalog

#### 11.1.2 EPO (European Patent Office)

**File**: `server/services/ingestion/epo.js`

```javascript
export class EPOProvider extends SearchProvider {
  constructor() {
    super({ name: "epo", timeout: 20000 });
    this.apiKey = process.env.EPO_API_KEY;
    this.baseUrl = "https://ops.epo.org/3.2/rest-services";
  }

  async search(query) {
    // EPO OPS API provides:
    // - European patents
    // - Patent families
    // - Legal status
    // - Citations
  }
}
```

**API**: Free tier 4GB/week  
**Docs**: https://www.epo.org/searching-for-patents/data/web-services/ops.html

#### 11.1.3 Google Patents

**File**: `server/services/ingestion/googlePatents.js`

```javascript
export class GooglePatentsProvider extends SearchProvider {
  constructor() {
    super({ name: "google_patents", timeout: 20000 });
    this.baseUrl = "https://patents.google.com";
  }

  async search(query) {
    // Google Patents provides:
    // - Global patent coverage
    // - Prior art search
    // - Patent families
    // - Full text search
    // Note: No official API, may need scraping with rate limits
  }
}
```

**API**: No official API, use Public Data on BigQuery or scraping  
**Docs**: https://cloud.google.com/blog/topics/public-datasets/google-patents-public-datasets-connecting-public-paid-and-private-patent-data

### 11.2 Patent-Specific Schema

**File**: `server/models/Patent.js` (new model, extends Paper)

```javascript
const patentSchema = new mongoose.Schema({
  ...paperSchema.obj, // Inherit from Paper
  
  // Patent-specific fields
  patentNumber: { type: String, required: true, unique: true },
  patentOffice: { type: String, enum: ["USPTO", "EPO", "JPO", "WIPO"] },
  applicationNumber: String,
  applicationDate: Date,
  publicationDate: Date,
  grantDate: Date,
  inventors: [String],
  assignee: String, // Company/institution
  classifications: {
    ipc: [String], // International Patent Classification
    cpc: [String], // Cooperative Patent Classification
    uspc: [String], // US Patent Classification
  },
  claims: [String],
  legalStatus: String,
  patentFamily: [String], // Related patents
  priorArt: [{ type: ObjectId, ref: "Paper" }],
});
```

### 11.3 Patent Search Features

```javascript
// Find patents related to paper
GET /api/papers/:id/related-patents

// Find papers cited by patent (prior art)
GET /api/patents/:id/prior-art

// Search patents by classification
GET /api/patents/search?ipc=G06N3/08

// Find patent families
GET /api/patents/:id/family
```

**Effort**: 10 hours  
**Priority**: Low (specialized use case)  
**Dependencies**: API keys for EPO

---

## Phase 12: Additional Academic Sources

**Goal**: Add PubMed, SSRN, PhilPapers, CORE to federation

### 12.1 PubMed/PubMed Central

**File**: `server/services/ingestion/pubmed.js`

```javascript
export class PubMedProvider extends SearchProvider {
  constructor() {
    super({ name: "pubmed", timeout: 15000 });
    this.baseUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
    this.apiKey = process.env.PUBMED_API_KEY; // Optional, increases rate limit
  }

  async search(query) {
    // PubMed E-utilities API:
    // 1. ESearch - search for PMIDs
    // 2. ESummary - get metadata
    // 3. EFetch - get full records
    
    const searchUrl = `${this.baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const pmids = searchData.esearchresult.idlist;
    
    // Fetch details for each PMID
    const summaryUrl = `${this.baseUrl}/esummary.fcgi?db=pubmed&id=${pmids.join(",")}&retmode=json`;
    const summaryRes = await fetch(summaryUrl);
    const summaryData = await summaryRes.json();
    
    return this.normalizePubMedResults(summaryData);
  }

  normalize(pubmedArticle) {
    return {
      title: pubmedArticle.title,
      authors: pubmedArticle.authors.map(a => a.name),
      abstract: pubmedArticle.abstract,
      year: new Date(pubmedArticle.pubdate).getFullYear(),
      doi: pubmedArticle.elocationid?.replace("doi: ", ""),
      source: "pubmed",
      externalIds: {
        pubmed: pubmedArticle.uid,
        pmc: pubmedArticle.pmcid,
        doi: pubmedArticle.elocationid,
      },
      venue: pubmedArticle.fulljournalname,
      venueType: "journal",
      url: `https://pubmed.ncbi.nlm.nih.gov/${pubmedArticle.uid}/`,
    };
  }
}
```

**API**: Free, 3 requests/second (10/sec with API key)  
**Docs**: https://www.ncbi.nlm.nih.gov/books/NBK25501/

### 12.2 SSRN (Social Science Research Network)

**File**: `server/services/ingestion/ssrn.js`

```javascript
export class SSRNProvider extends SearchProvider {
  constructor() {
    super({ name: "ssrn", timeout: 15000 });
    this.baseUrl = "https://api.ssrn.com/v1";
    this.apiKey = process.env.SSRN_API_KEY;
  }

  async search(query) {
    // SSRN API provides:
    // - Social science preprints
    // - Working papers
    // - Conference papers
    // - Download counts
  }

  normalize(ssrnPaper) {
    return {
      title: ssrnPaper.title,
      authors: ssrnPaper.authors,
      abstract: ssrnPaper.abstract,
      year: new Date(ssrnPaper.postDate).getFullYear(),
      source: "ssrn",
      externalIds: {
        ssrn: ssrnPaper.id,
      },
      venueType: "preprint",
      url: `https://papers.ssrn.com/sol3/papers.cfm?abstract_id=${ssrnPaper.id}`,
      downloadCount: ssrnPaper.downloads,
    };
  }
}
```

**API**: Requires API key (contact SSRN)  
**Docs**: https://www.ssrn.com/index.cfm/en/ssrn-api/

### 12.3 PhilPapers

**File**: `server/services/ingestion/philpapers.js`

```javascript
export class PhilPapersProvider extends SearchProvider {
  constructor() {
    super({ name: "philpapers", timeout: 15000 });
    this.baseUrl = "https://philpapers.org/api";
  }

  async search(query) {
    // PhilPapers API provides:
    // - Philosophy papers
    // - Categorized by topic
    // - Citation data
    // - Open access links
  }

  normalize(philPaper) {
    return {
      title: philPaper.title,
      authors: philPaper.authors,
      abstract: philPaper.abstract,
      year: philPaper.year,
      source: "philpapers",
      externalIds: {
        philpapers: philPaper.id,
      },
      venue: philPaper.venue,
      categories: philPaper.categories,
      url: `https://philpapers.org/rec/${philPaper.id}`,
    };
  }
}
```

**API**: Free, no key required  
**Docs**: https://philpapers.org/help/api.html

### 12.4 Update Federation Manager

**File**: `server/services/search/federationManager.js`

```javascript
import { pubmedProvider } from "../ingestion/pubmed.js";
import { ssrnProvider } from "../ingestion/ssrn.js";
import { philpapersProvider } from "../ingestion/philpapers.js";
import { coreProvider } from "../ingestion/core.js";

const PROVIDERS = {
  // Existing
  openalex: openAlexProvider,
  arxiv: arxivProvider,
  semanticScholar: semanticScholarProvider,
  
  // New
  pubmed: pubmedProvider,
  ssrn: ssrnProvider,
  philpapers: philpapersProvider,
  core: coreProvider,
};
```

**Effort**: 8 hours  
**Priority**: High  
**Dependencies**: API keys for SSRN

---

## Phase 13: Google Scholar Integration

**Goal**: Integrate Google Scholar with rate limiting and proxy rotation

### 13.1 Google Scholar Provider

**File**: `server/services/ingestion/googleScholar.js`

```javascript
import { RateLimiter } from "../rateLimiter.js";
import { ProxyRotator } from "../proxyRotator.js";

export class GoogleScholarProvider extends SearchProvider {
  constructor() {
    super({ name: "google_scholar", timeout: 20000 });
    this.baseUrl = "https://scholar.google.com";
    
    // Rate limiting: 1 request per 5 seconds
    this.rateLimiter = new RateLimiter({
      maxRequests: 1,
      perMilliseconds: 5000,
    });
    
    // Proxy rotation to avoid IP bans
    this.proxyRotator = new ProxyRotator({
      proxies: process.env.PROXY_LIST?.split(",") || [],
      rotateAfter: 10, // Rotate after 10 requests
    });
  }

  async search(query, options = {}) {
    await this.rateLimiter.wait();
    
    const proxy = this.proxyRotator.getNext();
    const searchUrl = `${this.baseUrl}/scholar?q=${encodeURIComponent(query.searchQuery)}`;
    
    try {
      // Use puppeteer or cheerio for scraping
      const html = await this.fetchWithProxy(searchUrl, proxy);
      const results = this.parseScholarHTML(html);
      return results.map((r, i) => this.normalize(r, i));
    } catch (error) {
      if (error.message.includes("CAPTCHA")) {
        console.warn("Google Scholar CAPTCHA detected, rotating proxy");
        this.proxyRotator.markBad(proxy);
        throw new Error("CAPTCHA detected, please try again later");
      }
      throw error;
    }
  }

  parseScholarHTML(html) {
    // Parse Google Scholar HTML
    // Extract: title, authors, year, venue, citations, PDF link
    // Use cheerio or similar
  }

  normalize(scholarResult, sourceRank) {
    return {
      title: scholarResult.title,
      authors: scholarResult.authors,
      abstract: scholarResult.snippet,
      year: scholarResult.year,
      venue: scholarResult.venue,
      citedByCount: scholarResult.citedBy,
      source: "google_scholar",
      url: scholarResult.link,
      pdfUrl: scholarResult.pdfLink,
      sourceRank,
    };
  }
}
```

### 13.2 Rate Limiter Service

**File**: `server/services/rateLimiter.js`

```javascript
export class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 1;
    this.perMilliseconds = options.perMilliseconds || 1000;
    this.queue = [];
    this.timestamps = [];
  }

  async wait() {
    const now = Date.now();
    
    // Remove old timestamps
    this.timestamps = this.timestamps.filter(
      t => now - t < this.perMilliseconds
    );
    
    // If at limit, wait
    if (this.timestamps.length >= this.maxRequests) {
      const oldestTimestamp = this.timestamps[0];
      const waitTime = this.perMilliseconds - (now - oldestTimestamp);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.wait(); // Recursive check
    }
    
    // Record this request
    this.timestamps.push(now);
  }
}
```

### 13.3 Proxy Rotator Service

**File**: `server/services/proxyRotator.js`

```javascript
export class ProxyRotator {
  constructor(options = {}) {
    this.proxies = options.proxies || [];
    this.rotateAfter = options.rotateAfter || 10;
    this.currentIndex = 0;
    this.requestCount = 0;
    this.badProxies = new Set();
  }

  getNext() {
    if (this.proxies.length === 0) {
      return null; // No proxy
    }
    
    // Rotate if needed
    if (this.requestCount >= this.rotateAfter) {
      this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
      this.requestCount = 0;
    }
    
    this.requestCount++;
    
    // Skip bad proxies
    let proxy = this.proxies[this.currentIndex];
    while (this.badProxies.has(proxy)) {
      this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
      proxy = this.proxies[this.currentIndex];
    }
    
    return proxy;
  }

  markBad(proxy) {
    this.badProxies.add(proxy);
  }
}
```

### 13.4 Environment Configuration

Add to `.env`:
```bash
# Google Scholar
PROXY_LIST=http://proxy1.com:8080,http://proxy2.com:8080
GOOGLE_SCHOLAR_ENABLED=true
GOOGLE_SCHOLAR_RATE_LIMIT=5000 # ms between requests
```

### 13.5 Fallback Strategy

```javascript
export async function searchWithFallback(query, options = {}) {
  const providers = [
    "semanticScholar",
    "openalex",
    "arxiv",
    "pubmed",
    "google_scholar", // Last resort due to rate limits
  ];
  
  for (const providerName of providers) {
    try {
      const results = await PROVIDERS[providerName].search(query);
      if (results.length > 0) {
        return { provider: providerName, results };
      }
    } catch (error) {
      console.warn(`Provider ${providerName} failed:`, error.message);
      continue;
    }
  }
  
  throw new Error("All providers failed");
}
```

**Effort**: 6 hours  
**Priority**: Low (high risk of IP bans)  
**Dependencies**: Proxy service, puppeteer/cheerio

---

## Implementation Timeline

### Week 1-2: Foundation (18 hours)
- [ ] Phase 8: Seminal Papers Detection (8h)
- [ ] Phase 12: PubMed + SSRN + PhilPapers (8h)
- [ ] Testing & Documentation (2h)

### Week 3-4: Advanced Features (22 hours)
- [ ] Phase 9: Relationship Extraction (12h)
- [ ] Phase 10: Grey Literature (10h)

### Week 5-6: Specialized Sources (16 hours)
- [ ] Phase 11: Patent Search (10h)
- [ ] Phase 13: Google Scholar (6h)

**Total Effort**: ~56 hours (7 weeks part-time)

---

## Testing Strategy

### Unit Tests

Create test files for each new service:
- `tests/seminal-paper-detector.test.js`
- `tests/relationship-extractor.test.js`
- `tests/pubmed-provider.test.js`
- `tests/ssrn-provider.test.js`
- `tests/philpapers-provider.test.js`
- `tests/base-provider.test.js`
- `tests/core-provider.test.js`
- `tests/uspto-provider.test.js`
- `tests/epo-provider.test.js`
- `tests/google-scholar-provider.test.js`
- `tests/rate-limiter.test.js`
- `tests/proxy-rotator.test.js`

### Integration Tests

- Test federated search with all 13 providers
- Test relationship extraction pipeline
- Test seminal paper detection algorithm
- Test rate limiting and proxy rotation

### E2E Tests

Add to `tests/e2e/`:
- `advanced-search.spec.js` - Test all new search features
- `patent-search.spec.js` - Test patent integration
- `grey-literature.spec.js` - Test grey literature sources

---

## Risk Assessment

### High Risk
1. **Google Scholar**: High risk of IP bans, CAPTCHA challenges
   - Mitigation: Use as last resort, implement robust proxy rotation
   
2. **API Rate Limits**: Multiple APIs have strict limits
   - Mitigation: Implement caching, rate limiting, fallback strategies

### Medium Risk
3. **LLM Costs**: Relationship extraction requires many LLM calls
   - Mitigation: Cache results, batch processing, use cheaper models

4. **Patent API Access**: Some require institutional access
   - Mitigation: Start with free USPTO, add EPO later

### Low Risk
5. **Grey Literature Quality**: Variable metadata quality
   - Mitigation: Robust normalization, validation

---

## Success Metrics

### Quantitative
- **Coverage**: 100% of requested features implemented (19/19)
- **Provider Count**: 13+ search providers (currently 3)
- **Test Coverage**: 95%+ for new code
- **Response Time**: <3s for federated search (10 providers)
- **Accuracy**: 80%+ for relationship classification

### Qualitative
- Users can find seminal papers in their field
- Users can discover contradictory/replicating studies
- Users can search grey literature and patents
- System handles rate limits gracefully
- No IP bans from Google Scholar

---

## Dependencies

### External APIs
- ✅ Semantic Scholar (free, no key)
- ✅ OpenAlex (free, no key)
- ✅ arXiv (free, no key)
- ⚠️ PubMed (free, optional key for higher limits)
- ⚠️ SSRN (requires API key)
- ✅ PhilPapers (free, no key)
- ✅ BASE (free, no key)
- ⚠️ CORE (free tier 10K/month)
- ⚠️ ProQuest (requires institutional access)
- ✅ USPTO (free, no key)
- ⚠️ EPO (free tier 4GB/week)
- ⚠️ Google Scholar (no official API, scraping)

### Infrastructure
- Proxy service for Google Scholar
- Increased MongoDB storage for relationships
- Background workers for seminal score calculation
- LLM API credits for relationship extraction

---

## Next Steps

1. **Review & Approve Plan**: Get stakeholder approval
2. **Acquire API Keys**: Register for SSRN, CORE, EPO
3. **Set Up Proxies**: Configure proxy service for Google Scholar
4. **Start Phase 8**: Begin with seminal paper detection
5. **Iterative Development**: Implement one phase at a time
6. **Continuous Testing**: Write tests alongside implementation
7. **Documentation**: Update API docs and user guides

---

## Conclusion

This plan provides a comprehensive roadmap to complete the Discovery & Search module, bringing it from 68% to 100% implementation. The phased approach allows for incremental delivery and testing, while the risk assessment ensures we're prepared for challenges.

**Recommended Priority Order**:
1. Phase 12 (PubMed, SSRN, PhilPapers) - High impact, low risk
2. Phase 8 (Seminal Papers) - High value for researchers
3. Phase 9 (Relationships) - Unique differentiator
4. Phase 10 (Grey Literature) - Fills important gap
5. Phase 11 (Patents) - Specialized use case
6. Phase 13 (Google Scholar) - High risk, use as fallback

Let's proceed with implementation! 🚀