/**
 * Tests for SearchAnalytics — Task 2.3
 */
import { SearchAnalytics } from '../services/search-analytics.js';
import type { QueryRecord } from '../services/search-analytics.js';

function makeRecord(overrides: Partial<QueryRecord> = {}): QueryRecord {
  return {
    query: 'test query',
    durationMs: 50,
    resultCount: 5,
    cacheHit: false,
    timestamp: Date.now(),
    indexName: 'main',
    searchType: 'hybrid',
    ...overrides,
  };
}

describe('SearchAnalytics', () => {
  let analytics: SearchAnalytics;

  beforeEach(() => {
    analytics = new SearchAnalytics();
  });

  describe('record', () => {
    it('stores a query record', () => {
      analytics.record(makeRecord());
      expect(analytics.size).toBe(1);
    });

    it('evicts oldest records when over 10K limit', () => {
      for (let i = 0; i < 10_001; i++) {
        analytics.record(makeRecord({ query: `q${i}` }));
      }
      expect(analytics.size).toBe(10_000);
    });
  });

  describe('getSummary', () => {
    it('returns empty summary when no records', () => {
      const summary = analytics.getSummary();
      expect(summary.totalQueries).toBe(0);
      expect(summary.averageLatencyMs).toBe(0);
    });

    it('computes average latency correctly', () => {
      analytics.record(makeRecord({ durationMs: 100 }));
      analytics.record(makeRecord({ durationMs: 200 }));
      const summary = analytics.getSummary();
      expect(summary.averageLatencyMs).toBe(150);
    });

    it('computes cache hit rate correctly', () => {
      analytics.record(makeRecord({ cacheHit: true }));
      analytics.record(makeRecord({ cacheHit: false }));
      analytics.record(makeRecord({ cacheHit: true }));
      const summary = analytics.getSummary();
      expect(summary.cacheHitRate).toBeCloseTo(0.667, 2);
    });

    it('counts slow queries (> 200ms)', () => {
      analytics.record(makeRecord({ durationMs: 150 }));
      analytics.record(makeRecord({ durationMs: 250 }));
      analytics.record(makeRecord({ durationMs: 350 }));
      const summary = analytics.getSummary();
      expect(summary.slowQueryCount).toBe(2);
    });

    it('reports top queries by frequency', () => {
      analytics.record(makeRecord({ query: 'alpha' }));
      analytics.record(makeRecord({ query: 'alpha' }));
      analytics.record(makeRecord({ query: 'beta' }));
      const summary = analytics.getSummary();
      expect(summary.topQueries[0].query).toBe('alpha');
      expect(summary.topQueries[0].count).toBe(2);
    });

    it('respects lastN window', () => {
      analytics.record(makeRecord({ durationMs: 10 }));
      analytics.record(makeRecord({ durationMs: 10 }));
      analytics.record(makeRecord({ durationMs: 500 }));
      const summary = analytics.getSummary(1);
      expect(summary.averageLatencyMs).toBe(500);
    });

    it('builds latency buckets', () => {
      analytics.record(makeRecord({ durationMs: 30 }));
      analytics.record(makeRecord({ durationMs: 75 }));
      analytics.record(makeRecord({ durationMs: 150 }));
      analytics.record(makeRecord({ durationMs: 300 }));
      analytics.record(makeRecord({ durationMs: 600 }));
      const { latencyBuckets } = analytics.getSummary();
      expect(latencyBuckets['<50ms']).toBe(1);
      expect(latencyBuckets['50–100ms']).toBe(1);
      expect(latencyBuckets['100–200ms']).toBe(1);
      expect(latencyBuckets['200–500ms']).toBe(1);
      expect(latencyBuckets['>500ms']).toBe(1);
    });
  });

  describe('getSlowQueries', () => {
    it('returns only queries over the threshold', () => {
      analytics.record(makeRecord({ durationMs: 100 }));
      analytics.record(makeRecord({ durationMs: 300 }));
      analytics.record(makeRecord({ durationMs: 500 }));
      const slow = analytics.getSlowQueries();
      expect(slow.length).toBe(2);
    });

    it('respects custom threshold', () => {
      analytics.record(makeRecord({ durationMs: 300 }));
      analytics.record(makeRecord({ durationMs: 600 }));
      const slow = analytics.getSlowQueries(400);
      expect(slow.length).toBe(1);
      expect(slow[0].durationMs).toBe(600);
    });
  });

  describe('timed', () => {
    it('records the result after the async fn completes', async () => {
      await analytics.timed(
        {
          query: 'timed q',
          resultCount: 3,
          cacheHit: false,
          indexName: 'idx',
          searchType: 'semantic',
        },
        async () => [1, 2, 3]
      );
      expect(analytics.size).toBe(1);
      expect(analytics.getSummary().totalQueries).toBe(1);
    });

    it('still records on error', async () => {
      await expect(
        analytics.timed(
          {
            query: 'error q',
            resultCount: 0,
            cacheHit: false,
            indexName: 'idx',
            searchType: 'keyword',
          },
          async () => { throw new Error('fail'); }
        )
      ).rejects.toThrow('fail');
      expect(analytics.size).toBe(1);
    });
  });

  describe('clear', () => {
    it('removes all records', () => {
      analytics.record(makeRecord());
      analytics.record(makeRecord());
      analytics.clear();
      expect(analytics.size).toBe(0);
    });
  });
});
