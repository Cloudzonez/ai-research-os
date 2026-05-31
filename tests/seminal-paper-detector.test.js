import { describe, it, expect, beforeEach } from '@jest/globals';
import { SeminalPaperDetector } from '../server/services/search/seminalPaperDetector.js';

describe('SeminalPaperDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new SeminalPaperDetector();
  });

  describe('Citation Velocity Calculation', () => {
    it('should calculate velocity for recent paper', () => {
      const paper = {
        citationCount: 100,
        year: new Date().getFullYear() - 2, // 2 years old
      };
      
      const velocity = detector.calculateCitationVelocity(paper);
      expect(velocity).toBe(50); // 100 citations / 2 years
    });

    it('should handle paper from current year', () => {
      const paper = {
        citationCount: 10,
        year: new Date().getFullYear(),
      };
      
      const velocity = detector.calculateCitationVelocity(paper);
      expect(velocity).toBeGreaterThan(0);
    });

    it('should return 0 for paper with no citations', () => {
      const paper = {
        citationCount: 0,
        year: 2020,
      };
      
      const velocity = detector.calculateCitationVelocity(paper);
      expect(velocity).toBe(0);
    });

    it('should handle very old papers', () => {
      const paper = {
        citationCount: 1000,
        year: 1990,
      };
      
      const velocity = detector.calculateCitationVelocity(paper);
      expect(velocity).toBeGreaterThan(0);
      expect(velocity).toBeLessThan(100); // Should be relatively low
    });
  });

  describe('Citation Age Score Calculation', () => {
    it('should weight recent citations higher', () => {
      const paper = {
        _id: 'paper1',
        citationCount: 100,
      };
      
      const citations = [
        { citingPaper: 'p1', year: new Date().getFullYear() },
        { citingPaper: 'p2', year: new Date().getFullYear() - 1 },
        { citingPaper: 'p3', year: new Date().getFullYear() - 5 },
      ];
      
      const score = detector.calculateCitationAgeScore(paper, citations);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should return 0 for no citations', () => {
      const paper = { _id: 'paper1', citationCount: 0 };
      const score = detector.calculateCitationAgeScore(paper, []);
      expect(score).toBe(0);
    });

    it('should handle missing citation years', () => {
      const paper = { _id: 'paper1', citationCount: 10 };
      const citations = [
        { citingPaper: 'p1' }, // No year
        { citingPaper: 'p2', year: 2020 },
      ];
      
      const score = detector.calculateCitationAgeScore(paper, citations);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('PageRank Calculation', () => {
    it('should calculate PageRank for citation network', () => {
      const papers = [
        { _id: 'p1', citationCount: 10 },
        { _id: 'p2', citationCount: 20 },
        { _id: 'p3', citationCount: 5 },
      ];
      
      const citations = [
        { citingPaper: 'p2', citedPaper: 'p1' },
        { citingPaper: 'p3', citedPaper: 'p1' },
        { citingPaper: 'p3', citedPaper: 'p2' },
      ];
      
      const pageRanks = detector.calculatePageRank(papers, citations);
      
      expect(pageRanks.p1).toBeGreaterThan(pageRanks.p2);
      expect(pageRanks.p1).toBeGreaterThan(pageRanks.p3);
    });

    it('should handle isolated papers', () => {
      const papers = [
        { _id: 'p1', citationCount: 0 },
      ];
      
      const pageRanks = detector.calculatePageRank(papers, []);
      expect(pageRanks.p1).toBe(1); // Should get base rank
    });

    it('should converge within max iterations', () => {
      const papers = Array.from({ length: 10 }, (_, i) => ({
        _id: `p${i}`,
        citationCount: i * 10,
      }));
      
      const citations = [];
      for (let i = 1; i < 10; i++) {
        citations.push({
          citingPaper: `p${i}`,
          citedPaper: `p${i - 1}`,
        });
      }
      
      const pageRanks = detector.calculatePageRank(papers, citations);
      
      // Should have ranks for all papers
      expect(Object.keys(pageRanks).length).toBe(10);
      
      // Sum of all ranks should be approximately equal to number of papers
      const sum = Object.values(pageRanks).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(10, 0);
    });
  });

  describe('Cross-Field Impact Detection', () => {
    it('should detect cross-field citations', () => {
      const paper = {
        _id: 'p1',
        categories: ['cs.AI', 'cs.LG'],
      };
      
      const citations = [
        { citingPaper: 'p2', categories: ['cs.AI'] },
        { citingPaper: 'p3', categories: ['physics.comp-ph'] },
        { citingPaper: 'p4', categories: ['math.ST'] },
      ];
      
      const score = detector.calculateCrossFieldImpact(paper, citations);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should return 0 for no citations', () => {
      const paper = { _id: 'p1', categories: ['cs.AI'] };
      const score = detector.calculateCrossFieldImpact(paper, []);
      expect(score).toBe(0);
    });

    it('should handle papers without categories', () => {
      const paper = { _id: 'p1' };
      const citations = [
        { citingPaper: 'p2', categories: ['cs.AI'] },
      ];
      
      const score = detector.calculateCrossFieldImpact(paper, citations);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Seminal Paper Detection', () => {
    it('should detect seminal papers', async () => {
      const papers = [
        {
          _id: 'p1',
          title: 'Highly Cited Paper',
          citationCount: 1000,
          year: 2015,
          categories: ['cs.AI'],
        },
        {
          _id: 'p2',
          title: 'Moderately Cited Paper',
          citationCount: 100,
          year: 2020,
          categories: ['cs.AI'],
        },
        {
          _id: 'p3',
          title: 'Low Cited Paper',
          citationCount: 10,
          year: 2023,
          categories: ['cs.AI'],
        },
      ];
      
      const citations = [
        { citingPaper: 'p2', citedPaper: 'p1', year: 2020 },
        { citingPaper: 'p3', citedPaper: 'p1', year: 2023 },
        { citingPaper: 'p3', citedPaper: 'p2', year: 2023 },
      ];
      
      const seminalPapers = await detector.detectSeminalPapers(papers, citations);
      
      expect(seminalPapers.length).toBeGreaterThan(0);
      expect(seminalPapers[0].seminalScore).toBeGreaterThan(0);
      expect(seminalPapers[0].isSeminal).toBe(true);
    });

    it('should apply threshold correctly', async () => {
      const papers = [
        {
          _id: 'p1',
          citationCount: 50,
          year: 2020,
        },
      ];
      
      const seminalPapers = await detector.detectSeminalPapers(
        papers,
        [],
        { threshold: 0.9 } // Very high threshold
      );
      
      expect(seminalPapers.length).toBe(0);
    });

    it('should limit results', async () => {
      const papers = Array.from({ length: 20 }, (_, i) => ({
        _id: `p${i}`,
        citationCount: 100 - i,
        year: 2020,
      }));
      
      const seminalPapers = await detector.detectSeminalPapers(
        papers,
        [],
        { limit: 5 }
      );
      
      expect(seminalPapers.length).toBeLessThanOrEqual(5);
    });

    it('should sort by seminal score', async () => {
      const papers = [
        { _id: 'p1', citationCount: 100, year: 2020 },
        { _id: 'p2', citationCount: 200, year: 2019 },
        { _id: 'p3', citationCount: 50, year: 2021 },
      ];
      
      const seminalPapers = await detector.detectSeminalPapers(papers, []);
      
      for (let i = 1; i < seminalPapers.length; i++) {
        expect(seminalPapers[i - 1].seminalScore).toBeGreaterThanOrEqual(
          seminalPapers[i].seminalScore
        );
      }
    });
  });

  describe('Composite Scoring', () => {
    it('should use correct weights', () => {
      const weights = detector.weights;
      
      expect(weights.velocity).toBe(0.30);
      expect(weights.age).toBe(0.25);
      expect(weights.pageRank).toBe(0.25);
      expect(weights.crossField).toBe(0.20);
      
      // Weights should sum to 1
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should normalize scores to 0-1 range', async () => {
      const papers = [
        { _id: 'p1', citationCount: 1000, year: 2015 },
        { _id: 'p2', citationCount: 100, year: 2020 },
      ];
      
      const seminalPapers = await detector.detectSeminalPapers(papers, []);
      
      seminalPapers.forEach(paper => {
        expect(paper.seminalScore).toBeGreaterThanOrEqual(0);
        expect(paper.seminalScore).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty paper list', async () => {
      const seminalPapers = await detector.detectSeminalPapers([], []);
      expect(seminalPapers).toEqual([]);
    });

    it('should handle papers with missing data', async () => {
      const papers = [
        { _id: 'p1' }, // Missing citationCount and year
        { _id: 'p2', citationCount: 100 }, // Missing year
        { _id: 'p3', year: 2020 }, // Missing citationCount
      ];
      
      const seminalPapers = await detector.detectSeminalPapers(papers, []);
      expect(seminalPapers).toBeDefined();
    });

    it('should handle circular citations', async () => {
      const papers = [
        { _id: 'p1', citationCount: 10, year: 2020 },
        { _id: 'p2', citationCount: 10, year: 2020 },
      ];
      
      const citations = [
        { citingPaper: 'p1', citedPaper: 'p2' },
        { citingPaper: 'p2', citedPaper: 'p1' },
      ];
      
      const seminalPapers = await detector.detectSeminalPapers(papers, citations);
      expect(seminalPapers).toBeDefined();
    });
  });
});

// Made with Bob
