import { describe, it, expect, beforeEach } from '@jest/globals';
import { RateLimiter } from '../server/services/rateLimiter.js';

describe('RateLimiter', () => {
  let rateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      maxRequests: 3,
      perMilliseconds: 1000,
    });
  });

  describe('Token Bucket Algorithm', () => {
    it('should allow requests within limit', async () => {
      const start = Date.now();
      
      await rateLimiter.wait();
      await rateLimiter.wait();
      await rateLimiter.wait();
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // Should be nearly instant
    });

    it('should throttle requests exceeding limit', async () => {
      const start = Date.now();
      
      // First 3 requests should be instant
      await rateLimiter.wait();
      await rateLimiter.wait();
      await rateLimiter.wait();
      
      // 4th request should wait
      await rateLimiter.wait();
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(1000); // Should wait ~1 second
    });

    it('should handle concurrent requests', async () => {
      const promises = [];
      const start = Date.now();
      
      // Try to make 6 requests concurrently
      for (let i = 0; i < 6; i++) {
        promises.push(rateLimiter.wait());
      }
      
      await Promise.all(promises);
      
      const elapsed = Date.now() - start;
      // Should take at least 1 second (for the 4th-6th requests)
      expect(elapsed).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('Status Reporting', () => {
    it('should report current status', async () => {
      await rateLimiter.wait();
      await rateLimiter.wait();
      
      const status = rateLimiter.getStatus();
      
      expect(status.current).toBe(2);
      expect(status.max).toBe(3);
      expect(status.available).toBe(1);
      expect(status.window).toBe(1000);
    });

    it('should check if can proceed', async () => {
      expect(rateLimiter.canProceed()).toBe(true);
      
      await rateLimiter.wait();
      await rateLimiter.wait();
      await rateLimiter.wait();
      
      expect(rateLimiter.canProceed()).toBe(false);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset timestamps', async () => {
      await rateLimiter.wait();
      await rateLimiter.wait();
      await rateLimiter.wait();
      
      expect(rateLimiter.canProceed()).toBe(false);
      
      rateLimiter.reset();
      
      expect(rateLimiter.canProceed()).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero max requests', async () => {
      const limiter = new RateLimiter({
        maxRequests: 0,
        perMilliseconds: 1000,
      });
      
      // Should never allow requests
      expect(limiter.canProceed()).toBe(false);
    });

    it('should handle very short time windows', async () => {
      const limiter = new RateLimiter({
        maxRequests: 2,
        perMilliseconds: 10, // 10ms window
      });
      
      await limiter.wait();
      await limiter.wait();
      
      const start = Date.now();
      await limiter.wait();
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(10);
    });

    it('should clean up old timestamps', async () => {
      await rateLimiter.wait();
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const status = rateLimiter.getStatus();
      expect(status.current).toBe(0);
    });
  });
});

// Made with Bob
