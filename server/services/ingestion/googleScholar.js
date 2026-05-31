import { SearchProvider } from '../search/SearchProvider.js';
import { RateLimiter } from '../rateLimiter.js';
import { ProxyRotator } from '../proxyRotator.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Google Scholar search provider
 * Uses web scraping with rate limiting and proxy rotation
 * Note: Google Scholar doesn't have an official API
 */
export class GoogleScholarProvider extends SearchProvider {
  constructor() {
    super('googleScholar', {
      baseUrl: 'https://scholar.google.com',
      requiresAuth: false,
      rateLimit: { requests: 1, perSeconds: 10 }, // Very conservative
    });
    
    // Rate limiter: 1 request per 10 seconds
    this.rateLimiter = new RateLimiter({
      maxRequests: 1,
      perMilliseconds: 10000,
    });
    
    // Proxy rotator (if proxies configured)
    const proxies = process.env.GOOGLE_SCHOLAR_PROXIES
      ? process.env.GOOGLE_SCHOLAR_PROXIES.split(',')
      : [];
    
    this.proxyRotator = new ProxyRotator({
      proxies,
      maxFailures: 3,
      resetInterval: 3600000, // 1 hour
    });
    
    // User agents for rotation
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    ];
    
    this.currentUserAgentIndex = 0;
  }

  /**
   * Get next user agent
   * @returns {string}
   */
  getNextUserAgent() {
    const ua = this.userAgents[this.currentUserAgentIndex];
    this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.userAgents.length;
    return ua;
  }

  /**
   * Make request with rate limiting and proxy rotation
   * @param {string} url - URL to fetch
   * @returns {Promise<string>} HTML content
   */
  async makeRequest(url) {
    // Wait for rate limit
    await this.rateLimiter.wait();
    
    const proxy = this.proxyRotator.getNext();
    const userAgent = this.getNextUserAgent();
    
    const config = {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 30000,
    };
    
    if (proxy) {
      config.proxy = this.parseProxy(proxy);
    }
    
    try {
      const response = await axios.get(url, config);
      
      if (proxy) {
        this.proxyRotator.markSuccess(proxy);
      }
      
      return response.data;
    } catch (error) {
      if (proxy) {
        this.proxyRotator.markFailed(proxy);
      }
      
      // Check if blocked
      if (error.response?.status === 429 || error.response?.status === 503) {
        throw new Error('Rate limited by Google Scholar. Please wait and try again.');
      }
      
      throw error;
    }
  }

  /**
   * Parse proxy string to axios proxy config
   * @param {string} proxyStr - Proxy string (http://host:port or socks5://host:port)
   * @returns {Object}
   */
  parseProxy(proxyStr) {
    const url = new URL(proxyStr);
    return {
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: parseInt(url.port),
      auth: url.username && url.password ? {
        username: url.username,
        password: url.password,
      } : undefined,
    };
  }

  /**
   * Search Google Scholar
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>}
   */
  async search(query, options = {}) {
    const {
      maxResults = 10,
      yearStart,
      yearEnd,
      sortBy = 'relevance', // 'relevance' or 'date'
    } = options;
    
    const params = new URLSearchParams({
      q: query,
      hl: 'en',
      as_sdt: '0,5', // Include patents
    });
    
    if (yearStart) {
      params.append('as_ylo', yearStart);
    }
    
    if (yearEnd) {
      params.append('as_yhi', yearEnd);
    }
    
    if (sortBy === 'date') {
      params.append('scisbd', '1'); // Sort by date
    }
    
    const url = `${this.baseUrl}/scholar?${params.toString()}`;
    
    try {
      const html = await this.makeRequest(url);
      const papers = this.parseSearchResults(html);
      
      return papers.slice(0, maxResults);
    } catch (error) {
      console.error('Google Scholar search error:', error.message);
      throw error;
    }
  }

  /**
   * Parse search results HTML
   * @param {string} html - HTML content
   * @returns {Array}
   */
  parseSearchResults(html) {
    const $ = cheerio.load(html);
    const papers = [];
    
    $('.gs_ri').each((i, elem) => {
      try {
        const $elem = $(elem);
        
        // Title and link
        const $title = $elem.find('.gs_rt a');
        const title = $title.text().trim();
        const link = $title.attr('href');
        
        if (!title) return;
        
        // Authors and publication info
        const $authors = $elem.find('.gs_a');
        const authorsText = $authors.text();
        const authorsParts = authorsText.split(' - ');
        
        const authors = authorsParts[0]
          ? authorsParts[0].split(',').map(a => a.trim())
          : [];
        
        const venue = authorsParts[1] || '';
        const year = this.extractYear(authorsText);
        
        // Abstract
        const abstract = $elem.find('.gs_rs').text().trim();
        
        // Citation count
        const $cited = $elem.find('.gs_fl a').filter((i, el) => {
          return $(el).text().includes('Cited by');
        });
        const citedText = $cited.text();
        const citationCount = citedText
          ? parseInt(citedText.match(/\d+/)?.[0] || '0')
          : 0;
        
        // Related articles link
        const $related = $elem.find('.gs_fl a').filter((i, el) => {
          return $(el).text().includes('Related articles');
        });
        const relatedLink = $related.attr('href');
        
        // Versions link
        const $versions = $elem.find('.gs_fl a').filter((i, el) => {
          return $(el).text().includes('versions');
        });
        const versionsText = $versions.text();
        const versionCount = versionsText
          ? parseInt(versionsText.match(/\d+/)?.[0] || '1')
          : 1;
        
        // PDF link
        const $pdf = $elem.parent().find('.gs_ggs a');
        const pdfUrl = $pdf.attr('href');
        
        papers.push({
          title,
          authors,
          abstract,
          year,
          venue,
          url: link,
          pdfUrl,
          citationCount,
          versionCount,
          relatedArticlesUrl: relatedLink ? `${this.baseUrl}${relatedLink}` : null,
          source: 'googleScholar',
        });
      } catch (error) {
        console.error('Error parsing Google Scholar result:', error);
      }
    });
    
    return papers;
  }

  /**
   * Extract year from text
   * @param {string} text - Text containing year
   * @returns {number|null}
   */
  extractYear(text) {
    const match = text.match(/\b(19|20)\d{2}\b/);
    return match ? parseInt(match[0]) : null;
  }

  /**
   * Get citation information for a paper
   * @param {string} paperId - Google Scholar paper ID or URL
   * @returns {Promise<Object>}
   */
  async getCitations(paperId) {
    // Extract cluster ID from URL if needed
    let clusterId = paperId;
    if (paperId.includes('cluster=')) {
      const match = paperId.match(/cluster=(\d+)/);
      clusterId = match ? match[1] : paperId;
    }
    
    const url = `${this.baseUrl}/scholar?cites=${clusterId}&hl=en`;
    
    try {
      const html = await this.makeRequest(url);
      const citations = this.parseSearchResults(html);
      
      return {
        count: citations.length,
        papers: citations,
      };
    } catch (error) {
      console.error('Error fetching citations:', error.message);
      return { count: 0, papers: [] };
    }
  }

  /**
   * Normalize to standard paper format
   * @param {Object} paper - Raw paper data
   * @returns {Object}
   */
  normalize(paper) {
    return {
      title: paper.title,
      authors: paper.authors.map(name => ({ name })),
      abstract: paper.abstract,
      year: paper.year,
      venue: paper.venue,
      url: paper.url,
      pdfUrl: paper.pdfUrl,
      citationCount: paper.citationCount,
      source: 'googleScholar',
      externalIds: {
        googleScholar: paper.url,
      },
      metadata: {
        versionCount: paper.versionCount,
        relatedArticlesUrl: paper.relatedArticlesUrl,
      },
    };
  }

  /**
   * Get provider statistics
   * @returns {Object}
   */
  getStats() {
    return {
      provider: this.name,
      rateLimiter: this.rateLimiter.getStatus(),
      proxyRotator: {
        available: this.proxyRotator.getAvailableCount(),
        total: this.proxyRotator.proxies.length,
        stats: this.proxyRotator.getStats(),
      },
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.proxyRotator.destroy();
  }
}

// Export singleton instance
export const googleScholarProvider = new GoogleScholarProvider();

export default GoogleScholarProvider;
