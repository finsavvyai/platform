import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchCache } from './search-cache';
import { SearchResult } from '../interfaces';

function mockResult(id: string, score = 0.9): SearchResult {
  return {
    id,
    score,
    rank: 1,
    content: `content-${id}`,
    document: {
      id,
      content: `content-${id}`,
      metadata: { type: 'text' } as any,
      source: 'local' as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

describe('SearchCache', () => {
  let cache: SearchCache;

  beforeEach(() => {
    cache = new SearchCache({ maxSize: 3, ttlMs: 1000, embeddingMaxSize: 3 });
  });

  describe('result cache', () => {
    it('returns null for cache miss', () => {
      expect(cache.getResults('unknown')).toBeNull();
    });

    it('returns cached results on hit', () => {
      const results = [mockResult('a')];
      cache.setResults('test query', undefined, results);
      const cached = cache.getResults('test query');
      expect(cached).toEqual(results);
    });

    it('separates results by filters', () => {
      const r1 = [mockResult('a')];
      const r2 = [mockResult('b')];
      cache.setResults('q', { type: 'code' }, r1);
      cache.setResults('q', { type: 'text' }, r2);
      expect(cache.getResults('q', { type: 'code' })).toEqual(r1);
      expect(cache.getResults('q', { type: 'text' })).toEqual(r2);
    });

    it('returns null for expired entries', async () => {
      cache = new SearchCache({ maxSize: 3, ttlMs: 50 });
      cache.setResults('q', undefined, [mockResult('a')]);
      expect(cache.getResults('q')).not.toBeNull();
      await new Promise(r => setTimeout(r, 60));
      expect(cache.getResults('q')).toBeNull();
    });

    it('evicts oldest entry when full', () => {
      cache.setResults('q1', undefined, [mockResult('1')]);
      cache.setResults('q2', undefined, [mockResult('2')]);
      cache.setResults('q3', undefined, [mockResult('3')]);
      cache.setResults('q4', undefined, [mockResult('4')]);
      // q1 should be evicted
      expect(cache.getResults('q1')).toBeNull();
      expect(cache.getResults('q4')).not.toBeNull();
    });
  });

  describe('embedding cache', () => {
    it('returns null for miss', () => {
      expect(cache.getEmbedding('unknown')).toBeNull();
    });

    it('caches and retrieves embeddings', () => {
      const emb = [0.1, 0.2, 0.3];
      cache.setEmbedding('hello', emb);
      expect(cache.getEmbedding('hello')).toEqual(emb);
    });

    it('evicts oldest embedding when full', () => {
      cache.setEmbedding('a', [1]);
      cache.setEmbedding('b', [2]);
      cache.setEmbedding('c', [3]);
      cache.setEmbedding('d', [4]);
      expect(cache.getEmbedding('a')).toBeNull();
      expect(cache.getEmbedding('d')).toEqual([4]);
    });
  });

  describe('stats', () => {
    it('tracks hit and miss counts', () => {
      cache.setResults('q', undefined, [mockResult('a')]);
      cache.getResults('q'); // hit
      cache.getResults('missing'); // miss

      const stats = cache.getStats();
      expect(stats.hitCount).toBe(1);
      expect(stats.missCount).toBe(1);
      expect(stats.hitRate).toBe(0.5);
      expect(stats.entries).toBe(1);
    });

    it('resets on clear', () => {
      cache.setResults('q', undefined, [mockResult('a')]);
      cache.setEmbedding('e', [1]);
      cache.clear();

      const stats = cache.getStats();
      expect(stats.entries).toBe(0);
      expect(stats.embeddingCacheSize).toBe(0);
      expect(stats.hitCount).toBe(0);
    });
  });
});
