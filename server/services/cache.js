class MemoryCache {
  constructor() {
    this.store = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.value;
  }

  set(key, value, ttlMs = 3600000) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now(),
    });
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats() {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0
        ? Math.round((this.hits / (this.hits + this.misses)) * 100)
        : 0,
    };
  }

  // Convenience methods for paper-specific cache keys
  paperSummaryKey(paperId) {
    return `summary:${paperId}`;
  }

  paperClaimsKey(paperId) {
    return `claims:${paperId}`;
  }

  contextKey(query) {
    return `context:${query.slice(0, 100)}`;
  }
}

const cache = new MemoryCache();

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.store) {
    if (now > entry.expiresAt) {
      cache.store.delete(key);
    }
  }
}, 300000); // every 5 minutes

// Named exports for convenience
export function getCache(key) {
  return cache.get(key);
}

export function setCache(key, value, ttlMs) {
  return cache.set(key, value, ttlMs);
}

export function deleteCache(key) {
  return cache.delete(key);
}

export function clearCache() {
  return cache.clear();
}

export function getCacheStats() {
  return cache.stats();
}

export default cache;
