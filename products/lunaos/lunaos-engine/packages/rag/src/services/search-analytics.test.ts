import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchAnalyticsService } from './search-analytics';
import { D1MetadataStore } from './metadata-store';

function createMockStore() {
  return {
    recordSearchAnalytics: vi.fn().mockResolvedValue(undefined),
    getSearchPerformanceStats: vi.fn().mockResolvedValue({
      totalSearches: 100,
      avgLatencyMs: 85,
      p95LatencyMs: 180,
      cacheHitRate: 0.35,
      avgResultCount: 7,
    }),
    getTopQueries: vi.fn().mockResolvedValue([
      { queryText: 'auth login', count: 15, avgLatencyMs: 90 },
      { queryText: 'api route', count: 10, avgLatencyMs: 75 },
    ]),
    getSearchAnalytics: vi.fn().mockResolvedValue([
      { id: '1', queryText: 'test', resultCount: 5, latencyMs: 50, cacheHit: false, searchType: 'semantic' },
    ]),
  } as unknown as D1MetadataStore;
}

describe('SearchAnalyticsService', () => {
  let analytics: SearchAnalyticsService;
  let mockStore: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    mockStore = createMockStore();
    analytics = new SearchAnalyticsService(mockStore as any);
  });

  it('records a search entry', async () => {
    const entry = {
      queryText: 'test query',
      resultCount: 5,
      latencyMs: 100,
      cacheHit: false,
      searchType: 'semantic' as const,
    };
    await analytics.recordSearch(entry);
    expect(mockStore.recordSearchAnalytics).toHaveBeenCalledWith(entry);
  });

  it('returns performance stats', async () => {
    const stats = await analytics.getPerformanceStats();
    expect(stats.totalSearches).toBe(100);
    expect(stats.avgLatencyMs).toBe(85);
    expect(stats.cacheHitRate).toBe(0.35);
  });

  it('returns top queries', async () => {
    const top = await analytics.getTopQueries(5);
    expect(top).toHaveLength(2);
    expect(top[0].queryText).toBe('auth login');
    expect(mockStore.getTopQueries).toHaveBeenCalledWith(5);
  });

  it('returns analytics with options', async () => {
    const result = await analytics.getAnalytics({ limit: 50 });
    expect(result).toHaveLength(1);
    expect(mockStore.getSearchAnalytics).toHaveBeenCalledWith({ limit: 50 });
  });
});
