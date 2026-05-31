export class RateLimiter {
  constructor(options = {}) {
    this.maxTokens = options.maxTokens ?? 10;
    this.refillRate = options.refillRate ?? 1;
    this.refillInterval = options.refillInterval ?? 1000;
    this.tokens = this.maxTokens;
    this.waiting = [];
    this._refillTimer = null;
    this._destroyed = false;

    if (this.refillRate > 0) {
      this._refillTimer = setInterval(() => {
        if (this._destroyed) return;
        const added = this.refillRate * (this.refillInterval / 1000);
        this.tokens = Math.min(this.maxTokens, this.tokens + added);
        this._drain();
      }, this.refillInterval);
      if (this._refillTimer.unref) this._refillTimer.unref();
    }
  }

  async acquire() {
    if (this._destroyed) throw new Error("RateLimiter destroyed");
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release() {
    this.tokens = Math.min(this.maxTokens, this.tokens + 1);
    this._drain();
  }

  _drain() {
    while (this.waiting.length > 0 && this.tokens >= 1) {
      const resolve = this.waiting.shift();
      this.tokens -= 1;
      resolve();
    }
  }

  stats() {
    return {
      available: Math.floor(this.tokens * 100) / 100,
      max: this.maxTokens,
      waiting: this.waiting.length,
      refillRate: this.refillRate,
    };
  }

  destroy() {
    this._destroyed = true;
    if (this._refillTimer) {
      clearInterval(this._refillTimer);
      this._refillTimer = null;
    }
    for (const resolve of this.waiting) {
      resolve();
    }
    this.waiting = [];
  }
}

export default { RateLimiter };
