import cache from "../cache.js";
import { RateLimiter } from "./rateLimiter.js";
import { withRetry, DEFAULT_RETRY_CONFIG } from "./retryHandler.js";
import { getActiveDebugLog } from "../trackerDebugLog.js";

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
    if (cached !== undefined) {
      const debugLog = getActiveDebugLog();
      if (debugLog) debugLog.detail(`[paperSearch/${this.name}] cache HIT`, { key: cacheKey });
      return cached;
    }

    const debugLog = getActiveDebugLog();
    if (debugLog) debugLog.begin(`[paperSearch/${this.name}] HTTP request`, { path: path.slice(0, 120) });
    await this.rateLimiter.acquire();

    try {
      const t0 = Date.now();
      const result = await withRetry(() => this._doFetch(path, init), this.retryConfig);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      if (debugLog) debugLog.end(`[paperSearch/${this.name}] done`, { elapsedSec: elapsed });
      this.cache.set(cacheKey, result, this.cacheTtlMs);
      return result;
    } catch (err) {
      if (debugLog) debugLog.end(`[paperSearch/${this.name}] ERROR`, { error: err.message });
      throw err;
    }
  }

  async _doFetch(path, init) {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    const headers = { ...this.defaultHeaders, ...init.headers };
    const timeoutMs = init.timeoutMs ?? this.retryConfig.timeoutMs;

    const debugLog = getActiveDebugLog();
    const t0 = Date.now();
    const res = await fetch(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      if (debugLog) debugLog.error(`[paperSearch/${this.name}] HTTP ${res.status}`, { url: url.slice(0, 120), statusText: res.statusText });
      const err = new Error(`${this.name} API ${res.status}: ${res.statusText}`);
      err.status = res.status;
      err.headers = res.headers;
      err.response = res;
      throw err;
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    if (debugLog) debugLog.detail(`[paperSearch/${this.name}] HTTP OK`, { status: res.status, elapsedSec: elapsed });
    return res.json();
  }

  async _fetchText(path, init = {}) {
    const cacheKey = this._cacheKey("fetchText", path);
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      const debugLog = getActiveDebugLog();
      if (debugLog) debugLog.detail(`[paperSearch/${this.name}] cache HIT (text)`, { key: cacheKey });
      return cached;
    }

    const debugLog = getActiveDebugLog();
    if (debugLog) debugLog.begin(`[paperSearch/${this.name}] HTTP request (text)`, { path: path.slice(0, 120) });
    await this.rateLimiter.acquire();

    try {
      const t0 = Date.now();
      const result = await withRetry(() => this._doFetchText(path, init), this.retryConfig);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      if (debugLog) debugLog.end(`[paperSearch/${this.name}] done`, { elapsedSec: elapsed, bytes: result.length });
      this.cache.set(cacheKey, result, this.cacheTtlMs);
      return result;
    } catch (err) {
      if (debugLog) debugLog.end(`[paperSearch/${this.name}] ERROR`, { error: err.message });
      throw err;
    }
  }

  async _doFetchText(path, init) {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    const headers = { ...this.defaultHeaders, ...init.headers };
    const timeoutMs = init.timeoutMs ?? this.retryConfig.timeoutMs;

    const debugLog = getActiveDebugLog();
    const t0 = Date.now();
    const res = await fetch(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      if (debugLog) debugLog.error(`[paperSearch/${this.name}] HTTP ${res.status} (text)`, { url: url.slice(0, 120), statusText: res.statusText });
      const err = new Error(`${this.name} API ${res.status}: ${res.statusText}`);
      err.status = res.status;
      err.headers = res.headers;
      throw err;
    }

    const text = await res.text();
    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    if (debugLog) debugLog.detail(`[paperSearch/${this.name}] HTTP OK (text)`, { status: res.status, bytes: text.length, elapsedSec: elapsed });
    return text;
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
