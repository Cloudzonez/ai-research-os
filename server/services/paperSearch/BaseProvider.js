import cache from "../cache.js";
import { RateLimiter } from "./rateLimiter.js";
import { withRetry, DEFAULT_RETRY_CONFIG } from "./retryHandler.js";

export class BaseProvider {
  constructor(options = {}) {
    this.name = options.name || "base";
    this.baseUrl = options.baseUrl || "";
    this.rateLimiter = options.rateLimiter || new RateLimiter({ maxTokens: 1, refillRate: 1 });
    this.cache = options.cache || cache;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
    this.defaultHeaders = options.headers || {};
    this.cacheTtlMs = options.cacheTtlMs ?? 300000;
    this.defaultParams = options.params || {};
  }

  async search(_params) {
    throw new Error(`search() not implemented for ${this.name}`);
  }

  async getPaper(_id) {
    throw new Error(`getPaper() not implemented for ${this.name}`);
  }

  async getCitations(_id) {
    return [];
  }

  async getReferences(_id) {
    return [];
  }

  async _fetch(path, init = {}) {
    const cacheKey = this._cacheKey("fetch", path + JSON.stringify(init));
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached;

    await this.rateLimiter.acquire();

    try {
      const result = await withRetry(() => this._doFetch(path, init), this.retryConfig);
      this.cache.set(cacheKey, result, this.cacheTtlMs);
      return result;
    } catch (err) {
      throw err;
    }
  }

  async _doFetch(path, init) {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    const headers = { ...this.defaultHeaders, ...init.headers };
    const timeoutMs = init.timeoutMs ?? this.retryConfig.timeoutMs;

    const res = await fetch(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const err = new Error(`${this.name} API ${res.status}: ${res.statusText}`);
      err.status = res.status;
      err.headers = res.headers;
      err.response = res;
      throw err;
    }

    return res.json();
  }

  async _fetchText(path, init = {}) {
    const cacheKey = this._cacheKey("fetchText", path);
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached;

    await this.rateLimiter.acquire();

    try {
      const result = await withRetry(() => this._doFetchText(path, init), this.retryConfig);
      this.cache.set(cacheKey, result, this.cacheTtlMs);
      return result;
    } catch (err) {
      throw err;
    }
  }

  async _doFetchText(path, init) {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    const headers = { ...this.defaultHeaders, ...init.headers };
    const timeoutMs = init.timeoutMs ?? this.retryConfig.timeoutMs;

    const res = await fetch(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const err = new Error(`${this.name} API ${res.status}: ${res.statusText}`);
      err.status = res.status;
      err.headers = res.headers;
      throw err;
    }

    return res.text();
  }

  _cacheKey(prefix, key) {
    return `papersearch:${this.name}:${prefix}:${hashKey(key)}`;
  }

  destroy() {
    this.rateLimiter.destroy();
  }
}

function hashKey(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return String(hash);
}

export default { BaseProvider };
