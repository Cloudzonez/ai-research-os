/**
 * Proxy rotation service for avoiding IP bans
 * Supports HTTP/HTTPS/SOCKS proxies
 */
export class ProxyRotator {
  constructor(options = {}) {
    this.proxies = options.proxies || [];
    this.currentIndex = 0;
    this.failedProxies = new Set();
    this.proxyStats = new Map();
    this.maxFailures = options.maxFailures || 3;
    this.resetInterval = options.resetInterval || 3600000; // 1 hour
    
    // Initialize stats for each proxy
    this.proxies.forEach(proxy => {
      this.proxyStats.set(proxy, {
        requests: 0,
        failures: 0,
        lastUsed: null,
        lastFailed: null,
      });
    });
    
    // Periodically reset failed proxies
    if (this.resetInterval > 0) {
      this.resetTimer = setInterval(() => {
        this.resetFailedProxies();
      }, this.resetInterval);
    }
  }

  /**
   * Get next available proxy
   * @returns {string|null} Proxy URL or null if none available
   */
  getNext() {
    if (this.proxies.length === 0) {
      return null;
    }
    
    // Find next working proxy
    let attempts = 0;
    while (attempts < this.proxies.length) {
      const proxy = this.proxies[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
      
      if (!this.failedProxies.has(proxy)) {
        const stats = this.proxyStats.get(proxy);
        stats.requests++;
        stats.lastUsed = Date.now();
        return proxy;
      }
      
      attempts++;
    }
    
    // All proxies failed, return null
    return null;
  }

  /**
   * Mark proxy as failed
   * @param {string} proxy - Proxy URL
   */
  markFailed(proxy) {
    const stats = this.proxyStats.get(proxy);
    if (!stats) return;
    
    stats.failures++;
    stats.lastFailed = Date.now();
    
    if (stats.failures >= this.maxFailures) {
      this.failedProxies.add(proxy);
      console.warn(`Proxy ${proxy} marked as failed after ${stats.failures} failures`);
    }
  }

  /**
   * Mark proxy as successful
   * @param {string} proxy - Proxy URL
   */
  markSuccess(proxy) {
    const stats = this.proxyStats.get(proxy);
    if (!stats) return;
    
    // Reset failure count on success
    stats.failures = 0;
    
    // Remove from failed set if present
    if (this.failedProxies.has(proxy)) {
      this.failedProxies.delete(proxy);
      console.log(`Proxy ${proxy} restored after successful request`);
    }
  }

  /**
   * Reset all failed proxies
   */
  resetFailedProxies() {
    const now = Date.now();
    const resetThreshold = 1800000; // 30 minutes
    
    for (const proxy of this.failedProxies) {
      const stats = this.proxyStats.get(proxy);
      if (stats && stats.lastFailed && (now - stats.lastFailed) > resetThreshold) {
        this.failedProxies.delete(proxy);
        stats.failures = 0;
        console.log(`Proxy ${proxy} reset after cooldown period`);
      }
    }
  }

  /**
   * Get proxy statistics
   * @returns {Array<Object>}
   */
  getStats() {
    return Array.from(this.proxyStats.entries()).map(([proxy, stats]) => ({
      proxy,
      ...stats,
      failed: this.failedProxies.has(proxy),
    }));
  }

  /**
   * Get count of available proxies
   * @returns {number}
   */
  getAvailableCount() {
    return this.proxies.length - this.failedProxies.size;
  }

  /**
   * Add new proxy
   * @param {string} proxy - Proxy URL
   */
  addProxy(proxy) {
    if (!this.proxies.includes(proxy)) {
      this.proxies.push(proxy);
      this.proxyStats.set(proxy, {
        requests: 0,
        failures: 0,
        lastUsed: null,
        lastFailed: null,
      });
    }
  }

  /**
   * Remove proxy
   * @param {string} proxy - Proxy URL
   */
  removeProxy(proxy) {
    const index = this.proxies.indexOf(proxy);
    if (index > -1) {
      this.proxies.splice(index, 1);
      this.proxyStats.delete(proxy);
      this.failedProxies.delete(proxy);
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.resetTimer) {
      clearInterval(this.resetTimer);
    }
  }
}

export default ProxyRotator;

// Made with Bob
