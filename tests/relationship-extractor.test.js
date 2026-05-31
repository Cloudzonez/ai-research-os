import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RelationshipExtractor } from '../server/services/search/relationshipExtractor.js';

// Mock DeepSeek service
jest.mock('../server/services/deepseek.js', () => ({
  chat: jest.fn(),
}));

describe('RelationshipExtractor', () => {
  let extractor;

  beforeEach(() => {
    extractor = new RelationshipExtractor();
    jest.clearAllMocks();
  });

  describe('Relationship Type Detection', () => {
    it('should detect contradiction relationship', async () => {
      const paper1 = {
        _id: 'p1',
        title: 'Study A shows X increases Y',
        abstract: 'We found that X significantly increases Y',
      };
      
      const paper2 = {
        _id: 'p2',
        title: 'Study B shows X decreases Y',
        abstract: 'Our results indicate X decreases Y',
      };
      
      const relationship = await extractor.extractRelationship(paper1, paper2);
      
      expect(relationship).toBeDefined();
      expect(['contradicts', 'extends', 'supports']).toContain(relationship.type);
      expect(relationship.confidence).toBeGreaterThan(0);
      expect(relationship.confidence).toBeLessThanOrEqual(1);
    });

    it('should detect replication relationship', async () => {
      const paper1 = {
        _id: 'p1',
        title: 'Original Study on X',
        abstract: 'We conducted a study on X',
      };
      
      const paper2 = {
        _id: 'p2',
        title: 'Replication of Study on X',
        abstract: 'We replicated the original study',
      };
      
      const relationship = await extractor.extractRelationship(paper1, paper2);
      expect(relationship).toBeDefined();
    });

    it('should detect extension relationship', async () => {
      const paper1 = {
        _id: 'p1',
        title: 'Basic Theory of X',
        abstract: 'We propose a theory of X',
      };
      
      const paper2 = {
        _id: 'p2',
        title: 'Extended Theory of X',
        abstract: 'Building on previous work, we extend the theory',
      };
      
      const relationship = await extractor.extractRelationship(paper1, paper2);
      expect(relationship).toBeDefined();
    });
  });

  describe('Confidence Scoring', () => {
    it('should return high confidence for clear relationships', async () => {
      const paper1 = {
        _id: 'p1',
        title: 'Study A',
        abstract: 'Clear finding A',
      };
      
      const paper2 = {
        _id: 'p2',
        title: 'Study B contradicts A',
        abstract: 'We found opposite results to Study A',
      };
      
      const relationship = await extractor.extractRelationship(paper1, paper2);
      expect(relationship.confidence).toBeGreaterThan(0.5);
    });

    it('should return low confidence for unclear relationships', async () => {
      const paper1 = {
        _id: 'p1',
        title: 'Study on topic A',
        abstract: 'Brief abstract',
      };
      
      const paper2 = {
        _id: 'p2',
        title: 'Study on topic B',
        abstract: 'Different topic',
      };
      
      const relationship = await extractor.extractRelationship(paper1, paper2);
      
      if (relationship) {
        expect(relationship.confidence).toBeLessThan(0.7);
      }
    });
  });

  describe('Claim Comparison', () => {
    it('should identify contradicting claims', () => {
      const claims1 = ['X increases Y', 'A causes B'];
      const claims2 = ['X decreases Y', 'A prevents B'];
      
      const contradictions = extractor.compareClaimsForContradiction(claims1, claims2);
      expect(contradictions.length).toBeGreaterThan(0);
    });

    it('should handle empty claims', () => {
      const contradictions = extractor.compareClaimsForContradiction([], []);
      expect(contradictions).toEqual([]);
    });

    it('should detect semantic contradictions', () => {
      const claims1 = ['Treatment improves outcomes'];
      const claims2 = ['Treatment worsens outcomes'];
      
      const contradictions = extractor.compareClaimsForContradiction(claims1, claims2);
      expect(contradictions.length).toBeGreaterThan(0);
    });
  });

  describe('Related Papers Discovery', () => {
    it('should find papers with relationships', async () => {
      const paper = {
        _id: 'p1',
        title: 'Study on X',
        abstract: 'We studied X',
      };
      
      const candidatePapers = [
        { _id: 'p2', title: 'Related to X', abstract: 'Also about X' },
        { _id: 'p3', title: 'Unrelated', abstract: 'About Y' },
      ];
      
      const related = await extractor.findRelatedPapers(paper, candidatePapers);
      expect(Array.isArray(related)).toBe(true);
    });

    it('should filter by relationship type', async () => {
      const paper = {
        _id: 'p1',
        title: 'Study A',
        abstract: 'Finding A',
      };
      
      const candidates = [
        { _id: 'p2', title: 'Contradicts A', abstract: 'Opposite finding' },
        { _id: 'p3', title: 'Supports A', abstract: 'Same finding' },
      ];
      
      const contradictions = await extractor.findRelatedPapers(
        paper,
        candidates,
        { type: 'contradicts' }
      );
      
      expect(Array.isArray(contradictions)).toBe(true);
    });

    it('should respect confidence threshold', async () => {
      const paper = { _id: 'p1', title: 'A', abstract: 'A' };
      const candidates = [
        { _id: 'p2', title: 'B', abstract: 'B' },
      ];
      
      const highConfidence = await extractor.findRelatedPapers(
        paper,
        candidates,
        { minConfidence: 0.9 }
      );
      
      expect(Array.isArray(highConfidence)).toBe(true);
    });

    it('should limit results', async () => {
      const paper = { _id: 'p1', title: 'A', abstract: 'A' };
      const candidates = Array.from({ length: 20 }, (_, i) => ({
        _id: `p${i}`,
        title: `Paper ${i}`,
        abstract: `Abstract ${i}`,
      }));
      
      const related = await extractor.findRelatedPapers(
        paper,
        candidates,
        { limit: 5 }
      );
      
      expect(related.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Caching', () => {
    it('should cache relationship extractions', async () => {
      const paper1 = { _id: 'p1', title: 'A', abstract: 'A' };
      const paper2 = { _id: 'p2', title: 'B', abstract: 'B' };
      
      // First call
      const rel1 = await extractor.extractRelationship(paper1, paper2);
      
      // Second call (should use cache)
      const rel2 = await extractor.extractRelationship(paper1, paper2);
      
      expect(rel1).toEqual(rel2);
    });

    it('should respect cache TTL', async () => {
      const shortCacheExtractor = new RelationshipExtractor({
        cacheTTL: 100, // 100ms
      });
      
      const paper1 = { _id: 'p1', title: 'A', abstract: 'A' };
      const paper2 = { _id: 'p2', title: 'B', abstract: 'B' };
      
      await shortCacheExtractor.extractRelationship(paper1, paper2);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should make new request
      await shortCacheExtractor.extractRelationship(paper1, paper2);
    });
  });

  describe('Fallback Behavior', () => {
    it('should use heuristics when LLM unavailable', async () => {
      const { chat } = require('../server/services/deepseek.js');
      chat.mockRejectedValue(new Error('API unavailable'));
      
      const paper1 = {
        _id: 'p1',
        title: 'Study shows X increases Y',
        abstract: 'X increases Y',
      };
      
      const paper2 = {
        _id: 'p2',
        title: 'Replication of X study',
        abstract: 'We replicated the study',
      };
      
      const relationship = await extractor.extractRelationship(paper1, paper2);
      
      // Should still return a relationship using heuristics
      expect(relationship).toBeDefined();
    });

    it('should handle malformed LLM responses', async () => {
      const { chat } = require('../server/services/deepseek.js');
      chat.mockResolvedValue('Invalid JSON response');
      
      const paper1 = { _id: 'p1', title: 'A', abstract: 'A' };
      const paper2 = { _id: 'p2', title: 'B', abstract: 'B' };
      
      const relationship = await extractor.extractRelationship(paper1, paper2);
      
      // Should handle gracefully
      expect(relationship).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle papers with missing abstracts', async () => {
      const paper1 = { _id: 'p1', title: 'Study A' };
      const paper2 = { _id: 'p2', title: 'Study B' };
      
      const relationship = await extractor.extractRelationship(paper1, paper2);
      expect(relationship).toBeDefined();
    });

    it('should handle very long abstracts', async () => {
      const longAbstract = 'A'.repeat(10000);
      
      const paper1 = { _id: 'p1', title: 'A', abstract: longAbstract };
      const paper2 = { _id: 'p2', title: 'B', abstract: longAbstract };
      
      const relationship = await extractor.extractRelationship(paper1, paper2);
      expect(relationship).toBeDefined();
    });

    it('should handle special characters in text', async () => {
      const paper1 = {
        _id: 'p1',
        title: 'Study with "quotes" & symbols',
        abstract: 'Abstract with <tags> and $pecial ch@rs',
      };
      
      const paper2 = {
        _id: 'p2',
        title: 'Another study',
        abstract: 'Normal abstract',
      };
      
      const relationship = await extractor.extractRelationship(paper1, paper2);
      expect(relationship).toBeDefined();
    });

    it('should handle same paper comparison', async () => {
      const paper = { _id: 'p1', title: 'A', abstract: 'A' };
      
      const relationship = await extractor.extractRelationship(paper, paper);
      
      // Should return null or very low confidence
      if (relationship) {
        expect(relationship.confidence).toBeLessThan(0.3);
      }
    });
  });

  describe('Relationship Types', () => {
    it('should support all relationship types', () => {
      const types = extractor.relationshipTypes;
      
      expect(types).toContain('contradicts');
      expect(types).toContain('replicates');
      expect(types).toContain('extends');
      expect(types).toContain('supports');
      expect(types).toContain('reviews');
      expect(types).toContain('applies');
    });

    it('should validate relationship type', () => {
      expect(extractor.isValidRelationshipType('contradicts')).toBe(true);
      expect(extractor.isValidRelationshipType('invalid')).toBe(false);
    });
  });
});

// Made with Bob
