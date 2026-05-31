import { createHash } from "node:crypto";
import { LRUCache } from "lru-cache";

export class RequestCache {
  #cache;
  #hits = 0;
  #misses = 0;

  constructor({ maxSize = 100, ttlMs = 3600000 } = {}) {
    this.#cache = new LRUCache({
      max: maxSize,
      ttl: ttlMs,
      updateAgeOnGet: true,
    });
  }

  generateKey(platform, query, opts = {}) {
    const data = JSON.stringify({
      platform,
      query: String(query).toLowerCase().trim(),
      options: opts || {},
    });
    return createHash("sha256").update(data).digest("hex");
  }

  get(key) {
    const value = this.#cache.get(key);
    if (value !== undefined) {
      this.#hits++;
      return value;
    }
    this.#misses++;
    return undefined;
  }

  set(key, value) {
    this.#cache.set(key, value);
  }

  has(key) {
    return this.#cache.has(key);
  }

  delete(key) {
    return this.#cache.delete(key);
  }

  clear() {
    this.#cache.clear();
    this.#hits = 0;
    this.#misses = 0;
  }

  getStats() {
    const total = this.#hits + this.#misses;
    return {
      size: this.#cache.size,
      maxSize: this.#cache.max,
      hits: this.#hits,
      misses: this.#misses,
      hitRate: total > 0 ? this.#hits / total : 0,
    };
  }
}

const caches = new Map();

export function getRequestCache(name, options) {
  if (!caches.has(name)) {
    caches.set(name, new RequestCache(options));
  }
  return caches.get(name);
}

export function clearAllCaches() {
  for (const cache of caches.values()) cache.clear();
}

export default { RequestCache, getRequestCache, clearAllCaches };
