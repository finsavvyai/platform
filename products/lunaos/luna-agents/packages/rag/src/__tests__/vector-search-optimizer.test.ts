/**
 * Tests for VectorSearchOptimizer — Task 2.3
 */
import { VectorSearchOptimizer } from '../services/vector-search-optimizer.js';
import type { SearchResult } from '../interfaces/index.js';

function makeResult(id: string, score: number, embedding?: number[]): SearchResult {
  return {
    document: {
      id,
      content: `content-${id}`,
      metadata: { source: 'test', type: 'text' },
      embedding,
      source: 'local',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    score,
    rank: 0,
  };
}

const semanticResults: SearchResult[] = [
  makeResult('a', 0.95),
  makeResult('b', 0.85),
  makeResult('c', 0.75),
];

const keywordResults: SearchResult[] = [
  makeResult('b', 0.9),
  makeResult('d', 0.8),
  makeResult('a', 0.7),
];

describe('VectorSearchOptimizer', () => {
  let optimizer: VectorSearchOptimizer;

  beforeEach(() => {
    optimizer = new VectorSearchOptimizer({ cacheTtl: 0 });
  });

  describe('reciprocalRankFusion', () => {
    it('merges two result lists and produces combined scores', () => {
      const combined = optimizer.reciprocalRankFusion(
        semanticResults,
        keywordResults,
        0.7,
        60
      );
      expect(combined.length).toBe(4); // a, b, c, d
    });

    it('assigns rank 0 to the top result', () => {
      const combined = optimizer.reciprocalRankFusion(
        semanticResults,
        keywordResults
      );
      expect(combined[0].rank).toBe(0);
    });

    it('boosts documents appearing in both lists', () => {
      const combined = optimizer.reciprocalRankFusion(
        semanticResults,
        keywordResults
      );
      // 'a' and 'b' appear in both lists, so they should rank above 'c' and 'd'
      const ids = combined.map((r) => r.document.id);
      expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('c'));
      expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('d'));
    });

    it('respects alpha weight (pure semantic)', () => {
      const pureSemanticCombined = optimizer.reciprocalRankFusion(
        semanticResults,
        [],
        1.0
      );
      expect(pureSemanticCombined.map((r) => r.document.id)).toEqual(['a', 'b', 'c']);
    });

    it('returns empty array for empty inputs', () => {
      const result = optimizer.reciprocalRankFusion([], []);
      expect(result).toEqual([]);
    });
  });

  describe('hybridSearch', () => {
    it('calls both search functions and returns merged results', async () => {
      const semanticFn = jest.fn().mockResolvedValue(semanticResults);
      const keywordFn = jest.fn().mockResolvedValue(keywordResults);

      const result = await optimizer.hybridSearch('test query', semanticFn, keywordFn);

      expect(semanticFn).toHaveBeenCalledTimes(1);
      expect(keywordFn).toHaveBeenCalledTimes(1);
      expect(result.combinedResults.length).toBeGreaterThan(0);
    });

    it('returns semanticResults and keywordResults in response', async () => {
      const semanticFn = jest.fn().mockResolvedValue(semanticResults);
      const keywordFn = jest.fn().mockResolvedValue(keywordResults);

      const result = await optimizer.hybridSearch('test', semanticFn, keywordFn);
      expect(result.semanticResults).toBe(semanticResults);
      expect(result.keywordResults).toBe(keywordResults);
    });

    it('uses cache on second call with same query', async () => {
      const cachedOptimizer = new VectorSearchOptimizer({ cacheTtl: 5000 });
      const semanticFn = jest.fn().mockResolvedValue(semanticResults);
      const keywordFn = jest.fn().mockResolvedValue(keywordResults);

      await cachedOptimizer.hybridSearch('cached query', semanticFn, keywordFn);
      await cachedOptimizer.hybridSearch('cached query', semanticFn, keywordFn);

      // Second call should hit cache — fns called only once
      expect(semanticFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      expect(optimizer.cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
    });

    it('returns 0 for orthogonal vectors', () => {
      expect(optimizer.cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    });

    it('returns 0 for empty vectors', () => {
      expect(optimizer.cosineSimilarity([], [])).toBe(0);
    });

    it('returns 0 for mismatched lengths', () => {
      expect(optimizer.cosineSimilarity([1, 2], [1])).toBe(0);
    });
  });

  describe('deduplicateResults', () => {
    it('removes near-duplicate results above threshold', () => {
      const vec = [1, 0];
      const r1 = makeResult('x', 0.9, vec);
      const r2 = makeResult('y', 0.8, [0.999, 0.001]); // very similar to vec
      const r3 = makeResult('z', 0.7, [0, 1]); // orthogonal

      const deduped = optimizer.deduplicateResults([r1, r2, r3], 0.99);
      expect(deduped.length).toBe(2); // x and z kept; y deduplicated
    });

    it('keeps all results when all are distinct', () => {
      const results = [
        makeResult('a', 0.9, [1, 0]),
        makeResult('b', 0.8, [0, 1]),
      ];
      expect(optimizer.deduplicateResults(results).length).toBe(2);
    });
  });

  describe('pruneCache', () => {
    it('removes expired cache entries', async () => {
      const shortCacheOptimizer = new VectorSearchOptimizer({ cacheTtl: 1 });
      const semanticFn = jest.fn().mockResolvedValue(semanticResults);
      const keywordFn = jest.fn().mockResolvedValue(keywordResults);
      await shortCacheOptimizer.hybridSearch('q', semanticFn, keywordFn);
      await new Promise((r) => setTimeout(r, 5));
      shortCacheOptimizer.pruneCache();
      // After prune, second call should hit fns again
      await shortCacheOptimizer.hybridSearch('q', semanticFn, keywordFn);
      expect(semanticFn).toHaveBeenCalledTimes(2);
    });
  });
});
