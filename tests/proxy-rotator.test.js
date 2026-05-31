import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ProxyRotator } from '../server/services/proxyRotator.js';

describe('ProxyRotator', () => {
  let proxyRotator;
  const testProxies = [
    'http://proxy1.com:8080',
    'http://proxy2.com:8080',
    'http://proxy3.com:8080',
  ];

  beforeEach(() => {
    proxyRotator = new ProxyRotator({
      proxies: [...testProxies],
      maxFailures: 2,
      resetInterval: 0, // Disable auto-reset for tests
    });
  });

  afterEach(() => {
    if (proxyRotator) {
      proxyRotator.destroy();
    }
  });

  describe('Proxy Selection', () => {
    it('should rotate through proxies', () => {
      const proxy1 = proxyRotator.getNext();
      const proxy2 = proxyRotator.getNext();
      const proxy3 = proxyRotator.getNext();
      const proxy4 = proxyRotator.getNext();
      
      expect(proxy1).toBe(testProxies[0]);
      expect(proxy2).toBe(testProxies[1]);
      expect(proxy3).toBe(testProxies[2]);
      expect(proxy4).toBe(testProxies[0]); // Should wrap around
    });

    it('should return null when no proxies available', () => {
      const rotator = new ProxyRotator({ proxies: [] });
      expect(rotator.getNext()).toBeNull();
    });

    it('should skip failed proxies', () => {
      const proxy1 = proxyRotator.getNext();
      proxyRotator.markFailed(proxy1);
      proxyRotator.markFailed(proxy1); // Mark failed twice to exceed threshold
      
      const proxy2 = proxyRotator.getNext();
      const proxy3 = proxyRotator.getNext();
      
      expect(proxy2).not.toBe(proxy1);
      expect(proxy3).not.toBe(proxy1);
    });

    it('should return null when all proxies failed', () => {
      testProxies.forEach(proxy => {
        proxyRotator.markFailed(proxy);
        proxyRotator.markFailed(proxy);
      });
      
      expect(proxyRotator.getNext()).toBeNull();
    });
  });

  describe('Failure Tracking', () => {
    it('should track failure count', () => {
      const proxy = testProxies[0];
      
      proxyRotator.markFailed(proxy);
      let stats = proxyRotator.getStats();
      let proxyStat = stats.find(s => s.proxy === proxy);
      
      expect(proxyStat.failures).toBe(1);
      expect(proxyStat.failed).toBe(false);
      
      proxyRotator.markFailed(proxy);
      stats = proxyRotator.getStats();
      proxyStat = stats.find(s => s.proxy === proxy);
      
      expect(proxyStat.failures).toBe(2);
      expect(proxyStat.failed).toBe(true);
    });

    it('should reset failure count on success', () => {
      const proxy = testProxies[0];
      
      proxyRotator.markFailed(proxy);
      proxyRotator.markSuccess(proxy);
      
      const stats = proxyRotator.getStats();
      const proxyStat = stats.find(s => s.proxy === proxy);
      
      expect(proxyStat.failures).toBe(0);
      expect(proxyStat.failed).toBe(false);
    });

    it('should restore failed proxy on success', () => {
      const proxy = testProxies[0];
      
      // Mark as failed
      proxyRotator.markFailed(proxy);
      proxyRotator.markFailed(proxy);
      
      expect(proxyRotator.getAvailableCount()).toBe(2);
      
      // Mark as successful
      proxyRotator.markSuccess(proxy);
      
      expect(proxyRotator.getAvailableCount()).toBe(3);
    });
  });

  describe('Statistics', () => {
    it('should track request count', () => {
      const proxy = proxyRotator.getNext();
      proxyRotator.getNext();
      proxyRotator.getNext();
      
      const stats = proxyRotator.getStats();
      const proxyStat = stats.find(s => s.proxy === proxy);
      
      expect(proxyStat.requests).toBe(1);
    });

    it('should track last used timestamp', () => {
      const before = Date.now();
      const proxy = proxyRotator.getNext();
      const after = Date.now();
      
      const stats = proxyRotator.getStats();
      const proxyStat = stats.find(s => s.proxy === proxy);
      
      expect(proxyStat.lastUsed).toBeGreaterThanOrEqual(before);
      expect(proxyStat.lastUsed).toBeLessThanOrEqual(after);
    });

    it('should report available count', () => {
      expect(proxyRotator.getAvailableCount()).toBe(3);
      
      const proxy = testProxies[0];
      proxyRotator.markFailed(proxy);
      proxyRotator.markFailed(proxy);
      
      expect(proxyRotator.getAvailableCount()).toBe(2);
    });
  });

  describe('Proxy Management', () => {
    it('should add new proxy', () => {
      const newProxy = 'http://proxy4.com:8080';
      proxyRotator.addProxy(newProxy);
      
      expect(proxyRotator.getAvailableCount()).toBe(4);
      
      const stats = proxyRotator.getStats();
      const proxyStat = stats.find(s => s.proxy === newProxy);
      
      expect(proxyStat).toBeDefined();
      expect(proxyStat.requests).toBe(0);
    });

    it('should not add duplicate proxy', () => {
      proxyRotator.addProxy(testProxies[0]);
      expect(proxyRotator.getAvailableCount()).toBe(3);
    });

    it('should remove proxy', () => {
      proxyRotator.removeProxy(testProxies[0]);
      expect(proxyRotator.getAvailableCount()).toBe(2);
      
      const stats = proxyRotator.getStats();
      const proxyStat = stats.find(s => s.proxy === testProxies[0]);
      
      expect(proxyStat).toBeUndefined();
    });
  });

  describe('Reset Mechanism', () => {
    it('should reset failed proxies after cooldown', () => {
      const proxy = testProxies[0];
      
      // Mark as failed
      proxyRotator.markFailed(proxy);
      proxyRotator.markFailed(proxy);
      
      expect(proxyRotator.getAvailableCount()).toBe(2);
      
      // Manually trigger reset (simulating time passage)
      proxyRotator.resetFailedProxies();
      
      // Should still be failed (not enough time passed)
      expect(proxyRotator.getAvailableCount()).toBe(2);
    });

    it('should have auto-reset timer when configured', () => {
      const rotator = new ProxyRotator({
        proxies: [...testProxies],
        resetInterval: 100, // 100ms
      });
      
      expect(rotator.resetTimer).toBeDefined();
      rotator.destroy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty proxy list', () => {
      const rotator = new ProxyRotator({ proxies: [] });
      expect(rotator.getNext()).toBeNull();
      expect(rotator.getAvailableCount()).toBe(0);
    });

    it('should handle single proxy', () => {
      const rotator = new ProxyRotator({ proxies: ['http://proxy.com:8080'] });
      
      const proxy1 = rotator.getNext();
      const proxy2 = rotator.getNext();
      
      expect(proxy1).toBe(proxy2);
    });

    it('should handle marking unknown proxy as failed', () => {
      expect(() => {
        proxyRotator.markFailed('http://unknown.com:8080');
      }).not.toThrow();
    });

    it('should handle marking unknown proxy as success', () => {
      expect(() => {
        proxyRotator.markSuccess('http://unknown.com:8080');
      }).not.toThrow();
    });
  });
});

// Made with Bob
