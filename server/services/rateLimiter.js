/**
 * Rate limiter for API requests
 * Implements token bucket algorithm
 */
export class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 1;
    this.perMilliseconds = options.perMilliseconds || 1000;
    this.queue = [];
    this.timestamps = [];
  }

  /**
   * Wait until rate limit allows next request
   * @returns {Promise<void>}
   */
  async wait() {
    const now = Date.now();
    
    // Remove old timestamps outside the window
    this.timestamps = this.timestamps.filter(
      t => now - t < this.perMilliseconds
    );
    
    // If at limit, wait
    if (this.timestamps.length >= this.maxRequests) {
      const oldestTimestamp = this.timestamps[0];
      const waitTime = this.perMilliseconds - (now - oldestTimestamp) + 10; // +10ms buffer
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.wait(); // Recursive check after waiting
    }
    
    // Record this request
    this.timestamps.push(now);
  }

  /**
   * Check if request can proceed without waiting
   * @returns {boolean}
   */
  canProceed() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(
      t => now - t < this.perMilliseconds
    );
    return this.timestamps.length < this.maxRequests;
  }

  /**
   * Get current rate limit status
   * @returns {Object}
   */
  getStatus() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(
      t => now - t < this.perMilliseconds
    );
    
    return {
      current: this.timestamps.length,
      max: this.maxRequests,
      window: this.perMilliseconds,
      available: this.maxRequests - this.timestamps.length,
    };
  }

  /**
   * Reset rate limiter
   */
  reset() {
    this.timestamps = [];
  }
}

export default RateLimiter;

// Made with Bob
