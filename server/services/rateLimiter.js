export class RateLimiter {
  #requestsPerSecond;
  #intervalMs;
  #burstCapacity;
  #tokens;
  #lastRefill;
  #intervalHandle;
  #pendingRequests;

  constructor({ requestsPerSecond, burstCapacity, debug = false }) {
    this.#requestsPerSecond = requestsPerSecond;
    this.#intervalMs = 1000 / requestsPerSecond;
    this.#burstCapacity = burstCapacity || requestsPerSecond;
    this.#tokens = this.#burstCapacity;
    this.#lastRefill = Date.now();
    this.#pendingRequests = [];

    this.#intervalHandle = setInterval(() => this.#processPending(), Math.min(this.#intervalMs, 100));
    if (this.#intervalHandle.unref) this.#intervalHandle.unref();
  }

  #refillTokens() {
    const now = Date.now();
    const elapsed = now - this.#lastRefill;
    if (elapsed >= this.#intervalMs) {
      const tokensToAdd = Math.floor(elapsed / this.#intervalMs);
      this.#tokens = Math.min(this.#burstCapacity, this.#tokens + tokensToAdd);
      this.#lastRefill = now;
    }
  }

  async waitForPermission() {
    this.#refillTokens();
    if (this.#tokens > 0) {
      this.#tokens--;
      return;
    }
    return new Promise((resolve) => {
      this.#pendingRequests.push({ resolve, timestamp: Date.now() });
    });
  }

  #processPending() {
    this.#refillTokens();
    while (this.#tokens > 0 && this.#pendingRequests.length > 0) {
      const req = this.#pendingRequests.shift();
      if (req) {
        this.#tokens--;
        req.resolve();
      }
    }
  }

  getStatus() {
    this.#refillTokens();
    return {
      availableTokens: this.#tokens,
      maxTokens: this.#burstCapacity,
      requestsPerSecond: this.#requestsPerSecond,
      pending: this.#pendingRequests.length,
    };
  }

  dispose() {
    clearInterval(this.#intervalHandle);
    this.#pendingRequests.forEach((r) => r.resolve());
    this.#pendingRequests.length = 0;
  }
}

const instances = new Map();

export function getRateLimiter(name, rps = 1) {
  if (!instances.has(name)) {
    instances.set(name, new RateLimiter({ requestsPerSecond: rps, burstCapacity: Math.max(2, rps) }));
  }
  return instances.get(name);
}

export function disposeAllLimiters() {
  for (const limiter of instances.values()) limiter.dispose();
  instances.clear();
}

export default { RateLimiter, getRateLimiter, disposeAllLimiters };
