import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { GoogleScholarProvider } from '../server/services/ingestion/googleScholar.js';
import axios from 'axios';

// Mock axios
jest.mock('axios');

describe('GoogleScholarProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new GoogleScholarProvider();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (provider) {
      provider.destroy();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default settings', () => {
      expect(provider.name).toBe('googleScholar');
      expect(provider.baseUrl).toBe('https://scholar.google.com');
      expect(provider.rateLimiter).toBeDefined();
      expect(provider.proxyRotator).toBeDefined();
    });

    it('should load proxies from environment', () => {
      process.env.GOOGLE_SCHOLAR_PROXIES = 'http://proxy1:8080,http://proxy2:8080';
      const providerWithProxies = new GoogleScholarProvider();
      
      expect(providerWithProxies.proxyRotator.proxies.length).toBe(2);
      
      delete process.env.GOOGLE_SCHOLAR_PROXIES;
      providerWithProxies.destroy();
    });

    it('should have multiple user agents', () => {
      expect(provider.userAgents.length).toBeGreaterThan(1);
    });
  });

  describe('User Agent Rotation', () => {
    it('should rotate through user agents', () => {
      const ua1 = provider.getNextUserAgent();
      const ua2 = provider.getNextUserAgent();
      const ua3 = provider.getNextUserAgent();
      
      expect(ua1).toBeDefined();
      expect(ua2).toBeDefined();
      expect(ua3).toBeDefined();
      
      // Should eventually wrap around
      const totalAgents = provider.userAgents.length;
      for (let i = 0; i < totalAgents; i++) {
        provider.getNextUserAgent();
      }
      
      const wrappedUA = provider.getNextUserAgent();
      expect(wrappedUA).toBe(ua1);
    });
  });

  describe('Proxy Parsing', () => {
    it('should parse HTTP proxy', () => {
      const proxy = provider.parseProxy('http://proxy.com:8080');
      
      expect(proxy.protocol).toBe('http');
      expect(proxy.host).toBe('proxy.com');
      expect(proxy.port).toBe(8080);
    });

    it('should parse SOCKS proxy', () => {
      const proxy = provider.parseProxy('socks5://proxy.com:1080');
      
      expect(proxy.protocol).toBe('socks5');
      expect(proxy.host).toBe('proxy.com');
      expect(proxy.port).toBe(1080);
    });

    it('should parse proxy with authentication', () => {
      const proxy = provider.parseProxy('http://user:pass@proxy.com:8080');
      
      expect(proxy.auth).toBeDefined();
      expect(proxy.auth.username).toBe('user');
      expect(proxy.auth.password).toBe('pass');
    });
  });

  describe('HTML Parsing', () => {
    it('should parse search results', () => {
      const mockHTML = `
        <div class="gs_ri">
          <h3 class="gs_rt">
            <a href="https://example.com/paper.pdf">Test Paper Title</a>
          </h3>
          <div class="gs_a">Author A, Author B - Journal Name, 2020</div>
          <div class="gs_rs">This is the abstract of the paper.</div>
          <div class="gs_fl">
            <a>Cited by 100</a>
            <a>Related articles</a>
            <a>All 3 versions</a>
          </div>
        </div>
      `;
      
      const papers = provider.parseSearchResults(mockHTML);
      
      expect(papers.length).toBe(1);
      expect(papers[0].title).toBe('Test Paper Title');
      expect(papers[0].authors).toContain('Author A');
      expect(papers[0].abstract).toContain('abstract');
      expect(papers[0].citationCount).toBe(100);
      expect(papers[0].year).toBe(2020);
    });

    it('should handle missing fields gracefully', () => {
      const mockHTML = `
        <div class="gs_ri">
          <h3 class="gs_rt">
            <a href="https://example.com">Minimal Paper</a>
          </h3>
        </div>
      `;
      
      const papers = provider.parseSearchResults(mockHTML);
      
      expect(papers.length).toBe(1);
      expect(papers[0].title).toBe('Minimal Paper');
      expect(papers[0].authors).toEqual([]);
      expect(papers[0].citationCount).toBe(0);
    });

    it('should extract year from various formats', () => {
      expect(provider.extractYear('Published in 2020')).toBe(2020);
      expect(provider.extractYear('1995 edition')).toBe(1995);
      expect(provider.extractYear('No year here')).toBeNull();
    });

    it('should handle multiple papers', () => {
      const mockHTML = `
        <div class="gs_ri">
          <h3 class="gs_rt"><a href="#">Paper 1</a></h3>
        </div>
        <div class="gs_ri">
          <h3 class="gs_rt"><a href="#">Paper 2</a></h3>
        </div>
        <div class="gs_ri">
          <h3 class="gs_rt"><a href="#">Paper 3</a></h3>
        </div>
      `;
      
      const papers = provider.parseSearchResults(mockHTML);
      expect(papers.length).toBe(3);
    });
  });

  describe('Search Functionality', () => {
    it('should construct search URL correctly', async () => {
      axios.get.mockResolvedValue({
        data: '<div class="gs_ri"><h3 class="gs_rt"><a>Test</a></h3></div>',
      });
      
      await provider.search('machine learning', {
        maxResults: 10,
        yearStart: 2020,
        yearEnd: 2023,
      });
      
      const callUrl = axios.get.mock.calls[0][0];
      expect(callUrl).toContain('q=machine+learning');
      expect(callUrl).toContain('as_ylo=2020');
      expect(callUrl).toContain('as_yhi=2023');
    });

    it('should respect maxResults parameter', async () => {
      const mockHTML = Array.from({ length: 20 }, (_, i) => `
        <div class="gs_ri">
          <h3 class="gs_rt"><a>Paper ${i}</a></h3>
        </div>
      `).join('');
      
      axios.get.mockResolvedValue({ data: mockHTML });
      
      const results = await provider.search('test', { maxResults: 5 });
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should handle sort by date', async () => {
      axios.get.mockResolvedValue({
        data: '<div class="gs_ri"><h3 class="gs_rt"><a>Test</a></h3></div>',
      });
      
      await provider.search('test', { sortBy: 'date' });
      
      const callUrl = axios.get.mock.calls[0][0];
      expect(callUrl).toContain('scisbd=1');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting', async () => {
      axios.get.mockResolvedValue({
        data: '<div class="gs_ri"><h3 class="gs_rt"><a>Test</a></h3></div>',
      });
      
      const start = Date.now();
      
      await provider.search('query1');
      await provider.search('query2');
      
      const elapsed = Date.now() - start;
      
      // Should wait at least 10 seconds between requests
      expect(elapsed).toBeGreaterThanOrEqual(10000);
    }, 15000); // Increase timeout for this test

    it('should track rate limiter status', () => {
      const stats = provider.getStats();
      
      expect(stats.provider).toBe('googleScholar');
      expect(stats.rateLimiter).toBeDefined();
      expect(stats.proxyRotator).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limit errors', async () => {
      axios.get.mockRejectedValue({
        response: { status: 429 },
      });
      
      await expect(provider.search('test')).rejects.toThrow('Rate limited');
    });

    it('should handle service unavailable errors', async () => {
      axios.get.mockRejectedValue({
        response: { status: 503 },
      });
      
      await expect(provider.search('test')).rejects.toThrow('Rate limited');
    });

    it('should handle network errors', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));
      
      await expect(provider.search('test')).rejects.toThrow();
    });

    it('should mark proxy as failed on error', async () => {
      process.env.GOOGLE_SCHOLAR_PROXIES = 'http://proxy1:8080';
      const providerWithProxy = new GoogleScholarProvider();
      
      axios.get.mockRejectedValue(new Error('Connection failed'));
      
      try {
        await providerWithProxy.search('test');
      } catch (error) {
        // Expected to fail
      }
      
      const stats = providerWithProxy.getStats();
      const proxyStats = stats.proxyRotator.stats[0];
      
      expect(proxyStats.failures).toBeGreaterThan(0);
      
      delete process.env.GOOGLE_SCHOLAR_PROXIES;
      providerWithProxy.destroy();
    });
  });

  describe('Citation Retrieval', () => {
    it('should fetch citations for a paper', async () => {
      const mockHTML = `
        <div class="gs_ri">
          <h3 class="gs_rt"><a>Citing Paper</a></h3>
        </div>
      `;
      
      axios.get.mockResolvedValue({ data: mockHTML });
      
      const citations = await provider.getCitations('12345');
      
      expect(citations.count).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(citations.papers)).toBe(true);
    });

    it('should extract cluster ID from URL', async () => {
      axios.get.mockResolvedValue({ data: '<html></html>' });
      
      await provider.getCitations('https://scholar.google.com/scholar?cluster=12345');
      
      const callUrl = axios.get.mock.calls[0][0];
      expect(callUrl).toContain('cites=12345');
    });
  });

  describe('Normalization', () => {
    it('should normalize paper data', () => {
      const rawPaper = {
        title: 'Test Paper',
        authors: ['Author A', 'Author B'],
        abstract: 'Abstract text',
        year: 2020,
        venue: 'Journal',
        url: 'https://example.com',
        pdfUrl: 'https://example.com/paper.pdf',
        citationCount: 100,
        versionCount: 3,
        relatedArticlesUrl: 'https://scholar.google.com/related',
      };
      
      const normalized = provider.normalize(rawPaper);
      
      expect(normalized.title).toBe('Test Paper');
      expect(normalized.authors).toHaveLength(2);
      expect(normalized.authors[0].name).toBe('Author A');
      expect(normalized.source).toBe('googleScholar');
      expect(normalized.externalIds.googleScholar).toBe('https://example.com');
      expect(normalized.metadata.versionCount).toBe(3);
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const testProvider = new GoogleScholarProvider();
      
      expect(() => testProvider.destroy()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty search results', async () => {
      axios.get.mockResolvedValue({ data: '<html><body></body></html>' });
      
      const results = await provider.search('nonexistent query');
      expect(results).toEqual([]);
    });

    it('should handle malformed HTML', async () => {
      axios.get.mockResolvedValue({ data: '<div>Broken HTML' });
      
      const results = await provider.search('test');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle special characters in query', async () => {
      axios.get.mockResolvedValue({
        data: '<div class="gs_ri"><h3 class="gs_rt"><a>Test</a></h3></div>',
      });
      
      await expect(
        provider.search('query with "quotes" & symbols')
      ).resolves.toBeDefined();
    });
  });
});

// Made with Bob
