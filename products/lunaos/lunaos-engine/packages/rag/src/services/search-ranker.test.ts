import { describe, it, expect } from 'vitest';
import { SearchRanker } from './search-ranker';
import { SearchResult, SearchRankingAlgorithm } from '../interfaces';

function mockResult(id: string, score: number, content = ''): SearchResult {
  return {
    id,
    score,
    rank: 0,
    content,
    document: {
      id,
      content,
      metadata: { type: 'text' } as any,
      source: 'local' as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

describe('SearchRanker', () => {
  const ranker = new SearchRanker();

  describe('rankBySemanticSimilarity', () => {
    it('sorts by score descending', () => {
      const results = [mockResult('a', 0.5), mockResult('b', 0.9), mockResult('c', 0.7)];
      const ranked = ranker.rankBySemanticSimilarity(results);
      expect(ranked.map(r => r.id)).toEqual(['b', 'c', 'a']);
    });
  });

  describe('rankByBM25', () => {
    it('scores documents containing query terms higher', () => {
      const results = [
        mockResult('a', 0.5, 'the quick brown fox jumps'),
        mockResult('b', 0.5, 'completely unrelated content here'),
      ];
      const ranked = ranker.rankByBM25(results, { text: 'quick fox' });
      expect(ranked[0].id).toBe('a');
      expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    });
  });

  describe('rankByTFIDF', () => {
    it('ranks documents with matching terms higher', () => {
      const results = [
        mockResult('a', 0.5, 'machine learning deep learning neural networks'),
        mockResult('b', 0.5, 'cooking recipes food preparation'),
      ];
      const ranked = ranker.rankByTFIDF(results, { text: 'machine learning' });
      expect(ranked[0].id).toBe('a');
    });
  });

  describe('rankResults', () => {
    it('dispatches to correct algorithm', () => {
      const results = [mockResult('a', 0.3), mockResult('b', 0.8)];

      const semantic = ranker.rankResults(results, { text: 'test' }, SearchRankingAlgorithm.SEMANTIC);
      expect(semantic[0].id).toBe('b');

      const bm25 = ranker.rankResults(
        [mockResult('x', 0.5, 'hello world'), mockResult('y', 0.5, 'goodbye')],
        { text: 'hello' },
        SearchRankingAlgorithm.BM25
      );
      expect(bm25[0].id).toBe('x');
    });
  });

  describe('reciprocalRankFusion', () => {
    it('fuses multiple result sets', () => {
      const set1 = [mockResult('a', 0.9), mockResult('b', 0.8)];
      const set2 = [mockResult('b', 0.95), mockResult('c', 0.7)];
      const fused = ranker.reciprocalRankFusion([set1, set2]);

      // b appears in both sets, should score highest
      expect(fused[0].id).toBe('b');
      expect(fused.length).toBe(3);
    });
  });

  describe('combineHybridResults', () => {
    it('merges and weights scores', () => {
      const semantic = [mockResult('a', 1.0), mockResult('b', 0.5)];
      const keyword = [mockResult('b', 1.0), mockResult('c', 0.8)];
      const combined = ranker.combineHybridResults(semantic, keyword, 0.7, 0.3);

      const aScore = combined.find(r => r.id === 'a')!.score;
      const bScore = combined.find(r => r.id === 'b')!.score;
      expect(aScore).toBeCloseTo(0.7); // 1.0 * 0.7
      expect(bScore).toBeCloseTo(0.65); // 0.5 * 0.7 + 1.0 * 0.3
    });
  });

  describe('extractKeywords', () => {
    it('extracts lowercase words longer than 2 chars', () => {
      const kw = ranker.extractKeywords('The Quick Brown Fox');
      expect(kw).toEqual(['the', 'quick', 'brown', 'fox']);
    });

    it('filters short words', () => {
      const kw = ranker.extractKeywords('I am a cat');
      expect(kw).toEqual(['cat']);
    });
  });

  describe('calculateKeywordOverlap', () => {
    it('calculates overlap ratio', () => {
      const overlap = ranker.calculateKeywordOverlap('hello world test', 'hello test other');
      expect(overlap).toBeCloseTo(2 / 3);
    });

    it('returns 0 for no overlap', () => {
      expect(ranker.calculateKeywordOverlap('alpha beta', 'gamma delta')).toBe(0);
    });
  });
});
