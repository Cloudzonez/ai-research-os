# MongoDB Atlas Vector Search Setup Guide

> Quick reference for setting up vector search in MongoDB Atlas

---

## Prerequisites

- MongoDB Atlas cluster (M10 or higher)
- Atlas Search enabled on your cluster
- Papers collection with embedding field

---

## Step 1: Create Vector Search Index

### Via Atlas UI

1. Navigate to your cluster in Atlas
2. Click **Search** tab
3. Click **Create Search Index**
4. Choose **JSON Editor**
5. Select database: `ai_research`
6. Select collection: `papers`
7. Paste this configuration:

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
      "title": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "abstract": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "year": {
        "type": "number"
      },
      "citedByCount": {
        "type": "number"
      },
      "studyType": {
        "type": "string"
      },
      "codeAvailable": {
        "type": "boolean"
      },
      "dataAvailable": {
        "type": "boolean"
      }
    }
  }
}
```

8. Name the index: `paper_vector_search`
9. Click **Create Search Index**
10. Wait for index to build (5-10 minutes for 10K papers)

### Via MongoDB Shell

```javascript
db.papers.createSearchIndex(
  "paper_vector_search",
  {
    mappings: {
      dynamic: false,
      fields: {
        embedding: {
          type: "knnVector",
          dimensions: 1536,
          similarity: "cosine"
        },
        title: { type: "string" },
        abstract: { type: "string" },
        year: { type: "number" },
        citedByCount: { type: "number" }
      }
    }
  }
);
```

---

## Step 2: Test Vector Search

### Pure Vector Search

```javascript
const queryEmbedding = await generateEmbedding("machine learning transformers");

const results = await Paper.aggregate([
  {
    $search: {
      index: "paper_vector_search",
      knnBeta: {
        vector: queryEmbedding,
        path: "embedding",
        k: 20
      }
    }
  },
  {
    $project: {
      title: 1,
      abstract: 1,
      year: 1,
      score: { $meta: "searchScore" }
    }
  },
  {
    $limit: 10
  }
]);
```

### Vector Search with Filters

```javascript
const results = await Paper.aggregate([
  {
    $search: {
      index: "paper_vector_search",
      knnBeta: {
        vector: queryEmbedding,
        path: "embedding",
        k: 50,
        filter: {
          compound: {
            must: [
              { range: { path: "year", gte: 2020 } },
              { equals: { path: "codeAvailable", value: true } }
            ]
          }
        }
      }
    }
  },
  {
    $limit: 10
  }
]);
```

### Hybrid Search (BM25 + Vector)

```javascript
const results = await Paper.aggregate([
  {
    $search: {
      index: "paper_vector_search",
      compound: {
        should: [
          {
            text: {
              query: "machine learning",
              path: ["title", "abstract"],
              score: { boost: { value: 0.3 } }
            }
          },
          {
            knnBeta: {
              vector: queryEmbedding,
              path: "embedding",
              k: 20,
              score: { boost: { value: 0.7 } }
            }
          }
        ],
        minimumShouldMatch: 1
      }
    }
  },
  {
    $limit: 10
  }
]);
```

---

## Step 3: Generate Embeddings for Existing Papers

### Run Embedding Job

```bash
# Generate embeddings for all papers without embeddings
npm run embed:papers
```

### Manual Embedding

```javascript
import Paper from "./server/models/Paper.js";
import { generateEmbedding } from "./server/services/search/embeddingService.js";

const paper = await Paper.findById("...");
const text = `${paper.title} ${paper.abstract}`.slice(0, 8000);
const embedding = await generateEmbedding(text);

paper.embedding = embedding;
paper.embeddingModel = "text-embedding-3-large";
paper.embeddedAt = new Date();
await paper.save();
```

---

## Step 4: Monitor Index Status

### Check Index Build Progress

```javascript
// Via MongoDB Shell
db.papers.getSearchIndexes("paper_vector_search");
```

### Expected Output

```json
[
  {
    "id": "...",
    "name": "paper_vector_search",
    "status": "READY",
    "queryable": true,
    "latestDefinition": { ... }
  }
]
```

**Status values**:
- `BUILDING`: Index is being built
- `READY`: Index is ready for queries
- `FAILED`: Index build failed (check logs)

---

## Step 5: Performance Tuning

### Index Size Estimation

For 10K papers with 1536-dim embeddings:
- Storage: ~60 MB (10K × 1536 × 4 bytes)
- RAM: ~120 MB (with overhead)
- Build time: ~5-10 minutes

### Query Performance

Expected latency:
- Pure vector search: 50-200ms
- Hybrid search: 100-300ms
- With filters: 150-400ms

### Optimization Tips

1. **Limit k parameter**: Don't fetch more than needed
   ```javascript
   k: 20  // Good
   k: 1000  // Bad (slow)
   ```

2. **Use filters early**: Apply filters in knnBeta, not after
   ```javascript
   // Good
   knnBeta: { vector, path, k: 20, filter: { year: { $gte: 2020 } } }
   
   // Bad
   knnBeta: { vector, path, k: 100 }
   // Then filter in $match stage
   ```

3. **Project only needed fields**: Reduce data transfer
   ```javascript
   $project: { title: 1, year: 1, score: { $meta: "searchScore" } }
   ```

4. **Cache query embeddings**: Don't regenerate for same query
   ```javascript
   const cacheKey = `embedding:${query}`;
   let embedding = await getCache(cacheKey);
   if (!embedding) {
     embedding = await generateEmbedding(query);
     await setCache(cacheKey, embedding, 3600);
   }
   ```

---

## Troubleshooting

### Index Not Building

**Symptom**: Index stuck in `BUILDING` status

**Solutions**:
1. Check cluster tier (must be M10+)
2. Verify embedding field exists and has correct type
3. Check Atlas Search is enabled
4. Wait longer (can take 10+ minutes for large collections)

### Low Search Quality

**Symptom**: Irrelevant results returned

**Solutions**:
1. Verify embeddings are generated correctly
2. Check embedding dimensions match (1536)
3. Tune hybrid search weights (vector vs. keyword)
4. Add more context to query (longer text = better embedding)

### High Latency

**Symptom**: Queries take >1 second

**Solutions**:
1. Reduce k parameter
2. Add filters to narrow search space
3. Use projection to limit returned fields
4. Check cluster resources (upgrade if needed)
5. Enable query caching

### Out of Memory

**Symptom**: Index build fails with OOM error

**Solutions**:
1. Upgrade cluster tier (more RAM)
2. Reduce embedding dimensions (not recommended)
3. Process papers in batches
4. Remove unused indexes

---

## Cost Considerations

### MongoDB Atlas Pricing

| Cluster Tier | RAM | Storage | Vector Search | Monthly Cost |
|--------------|-----|---------|---------------|--------------|
| M10 | 2 GB | 10 GB | ✅ Yes | $57 |
| M20 | 4 GB | 20 GB | ✅ Yes | $140 |
| M30 | 8 GB | 40 GB | ✅ Yes | $280 |

**Recommendation**: Start with M10, upgrade if needed

### Embedding Costs (OpenAI)

| Operation | Tokens | Cost |
|-----------|--------|------|
| 10K papers (initial) | ~5M tokens | $0.65 |
| 100 queries/day | ~3K tokens/day | $0.01/day |
| Monthly (queries) | ~90K tokens | $0.12 |

**Total monthly**: ~$58 (Atlas M10 + embeddings)

---

## References

- [MongoDB Atlas Vector Search Docs](https://www.mongodb.com/docs/atlas/atlas-vector-search/)
- [Atlas Search Operators](https://www.mongodb.com/docs/atlas/atlas-search/operators-and-collectors/)
- [kNN Search Tutorial](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-tutorial/)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)

---

## Quick Commands

```bash
# Generate embeddings for all papers
npm run embed:papers

# Test vector search
node -e "
import('./server/services/search/semanticSearch.js').then(async ({ semanticSearch }) => {
  const results = await semanticSearch('machine learning', { maxResults: 5 });
  console.log(results);
  process.exit(0);
});
"

# Check index status
mongosh "mongodb+srv://..." --eval "db.papers.getSearchIndexes('paper_vector_search')"