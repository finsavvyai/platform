import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import CacheService from '../src/cache-service.js';
import CachingMiddleware from '../src/caching-middleware.js';
import CacheManager from '../src/cache-manager.js';

describe('CacheService', () => {
  let cacheService;
  let mockEnv;

  beforeAll(() => {
    mockEnv = {
      CACHE: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        match: vi.fn()
      },
      CACHE_KV: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn()
      },
      ENVIRONMENT: 'test'
    };
  });

  beforeEach(() => {
    cacheService = new CacheService(mockEnv);
    vi.clearAllMocks();
  });

  describe('generateCacheKey', () => {
    it('should generate cache key with prefix and identifier', () => {
      const key = cacheService.generateCacheKey('query', 'test-id');
      expect(key).toBe('query:test-id');
    });

    it('should include metadata in cache key', () => {
      const metadata = { teamId: 'team-1', userId: 'user-1' };
      const key = cacheService.generateCacheKey('analytics', 'dashboard', metadata);
      expect(key).toBe('analytics:dashboard?teamId=team-1&userId=user-1');
    });

    it('should sort metadata parameters consistently', () => {
      const metadata = { z: 'last', a: 'first', m: 'middle' };
      const key = cacheService.generateCacheKey('test', 'id', metadata);
      expect(key).toBe('test:id?a=first&m=middle&z=last');
    });
  });

  describe('get', () => {
    it('should return cached data when available', async () => {
      const testData = { value: 'test', timestamp: Date.now() };
      mockEnv.CACHE.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cacheService.get('test-key');

      expect(result).toEqual({
        data: 'test',
        stale: false,
        needsRefresh: false,
        age: expect.any(Number)
      });
    });

    it('should return null when cache miss', async () => {
      mockEnv.CACHE.get.mockResolvedValue(null);

      const result = await cacheService.get('test-key');

      expect(result).toBeNull();
    });

    it('should handle TTL refresh strategy', async () => {
      const oldData = {
        value: 'test',
        timestamp: Date.now() - (10 * 60 * 1000), // 10 minutes ago
        refreshing: false
      };
      mockEnv.CACHE.get.mockResolvedValue(JSON.stringify(oldData));

      const result = await cacheService.get('test-key', {
        strategy: cacheService.strategies.TTL_REFRESH,
        refreshTTL: 240 // 4 minutes
      });

      expect(result.stale).toBe(true);
      expect(result.needsRefresh).toBe(true);
    });

    it('should apply validator function when provided', async () => {
      const invalidData = { value: 'invalid', timestamp: Date.now() };
      mockEnv.CACHE.get.mockResolvedValue(JSON.stringify(invalidData));

      const validator = (data) => data.value !== 'invalid';
      const result = await cacheService.get('test-key', { validator });

      expect(result).toBeNull();
      expect(mockEnv.CACHE.delete).toHaveBeenCalledWith('test-key');
    });
  });

  describe('set', () => {
    it('should store data in cache with metadata', async () => {
      const value = { test: 'data' };
      mockEnv.CACHE.put.mockResolvedValue(true);
      mockEnv.CACHE_KV.put.mockResolvedValue(true);

      const result = await cacheService.set('test-key', value, { ttl: 600 });

      expect(result).toBe(true);
      expect(mockEnv.CACHE.put).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify({
          value,
          timestamp: expect.any(Number),
          ttl: 600,
          strategy: 'cache_aside',
          tags: [],
          priority: 'normal',
          version: '1.0'
        }),
        expect.objectContaining({
          ttl: 600,
          headers: expect.any(Object)
        })
      );
    });

    it('should store metadata in KV when available', async () => {
      const value = { test: 'data' };
      mockEnv.CACHE.put.mockResolvedValue(true);
      mockEnv.CACHE_KV.put.mockResolvedValue(true);

      await cacheService.set('test-key', value, {
        ttl: 600,
        tags: ['test', 'cache']
      });

      expect(mockEnv.CACHE_KV.put).toHaveBeenCalledWith(
        'meta:test-key',
        JSON.stringify({
          key: 'test-key',
          strategy: 'cache_aside',
          ttl: 600,
          tags: ['test', 'cache'],
          priority: 'normal',
          created: expect.any(Number)
        }),
        { expirationTtl: 1200 }
      );
    });

    it('should handle cache errors gracefully', async () => {
      mockEnv.CACHE.put.mockRejectedValue(new Error('Cache error'));

      const result = await cacheService.set('test-key', { test: 'data' });

      expect(result).toBe(false);
    });
  });

  describe('invalidate', () => {
    it('should invalidate exact match patterns', async () => {
      mockEnv.CACHE.delete.mockResolvedValue(true);
      mockEnv.CACHE_KV.delete.mockResolvedValue(true);

      const count = await cacheService.invalidate('exact-key', { exactMatch: true });

      expect(count).toBe(1);
      expect(mockEnv.CACHE.delete).toHaveBeenCalledWith('exact-key');
      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith('meta:exact-key');
    });

    it('should invalidate pattern-based matches', async () => {
      const keys = [
        { name: 'meta:test-key-1' },
        { name: 'meta:test-key-2' },
        { name: 'meta:other-key' }
      ];
      mockEnv.CACHE_KV.list.mockResolvedValue({ keys });
      mockEnv.CACHE.delete.mockResolvedValue(true);
      mockEnv.CACHE_KV.delete.mockResolvedValue(true);

      const count = await cacheService.invalidate('test-key');

      expect(count).toBe(2);
    });

    it('should handle invalidation errors gracefully', async () => {
      mockEnv.CACHE_KV.list.mockRejectedValue(new Error('KV error'));

      const count = await cacheService.invalidate('test-pattern');

      expect(count).toBe(0);
    });
  });

  describe('warmCache', () => {
    it('should warm cache with provided queries', async () => {
      const warmupQueries = [
        {
          key: 'warmup-test',
          fetcher: vi.fn().mockResolvedValue({ data: 'test' }),
          options: { ttl: 300 }
        }
      ];
      mockEnv.CACHE.put.mockResolvedValue(true);

      const result = await cacheService.warmCache(warmupQueries);

      expect(result.total).toBe(1);
      expect(result.successful).toBe(1);
      expect(result.results[0].success).toBe(true);
    });

    it('should handle fetcher errors during warmup', async () => {
      const warmupQueries = [
        {
          key: 'warmup-error',
          fetcher: vi.fn().mockRejectedValue(new Error('Fetch error')),
          options: { ttl: 300 }
        }
      ];

      const result = await cacheService.warmCache(warmupQueries);

      expect(result.successful).toBe(0);
      expect(result.results[0].success).toBe(false);
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', async () => {
      mockEnv.CACHE.get.mockResolvedValue(JSON.stringify({
        requests: [Date.now() - 1000] // 1 request 1 second ago
      }));
      mockEnv.CACHE.put.mockResolvedValue(true);

      const result = await cacheService.checkRateLimit('user-1', 5, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should deny requests exceeding limit', async () => {
      const now = Date.now();
      const fiveRequests = Array.from({ length: 5 }, () => now - 1000);
      mockEnv.CACHE.get.mockResolvedValue(JSON.stringify({
        requests: fiveRequests
      }));

      const result = await cacheService.checkRateLimit('user-1', 5, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should apply penalty when specified', async () => {
      mockEnv.CACHE.get.mockResolvedValue(JSON.stringify({
        requests: Array.from({ length: 5 }, () => Date.now() - 1000)
      }));
      mockEnv.CACHE.put.mockResolvedValue(true);

      const result = await cacheService.checkRateLimit('user-1', 5, 60, { penalty: 10 });

      expect(result.allowed).toBe(false);
      expect(mockEnv.CACHE.put).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"requests"'),
        expect.objectContaining({
          expirationTtl: 70 // 60 + 10 penalty
        })
      );
    });
  });

  describe('optimizeForRegion', () => {
    it('should create regional cache options', async () => {
      const request = new Request('https://example.com/test', {
        headers: {
          'cf-ipcountry': 'US',
          'cf-colo': 'DFW',
          'cf-timezone': 'America/Chicago'
        }
      });

      const result = await cacheService.optimizeForRegion(request, 'local');

      expect(result.country).toBe('US');
      expect(result.colo).toBe('DFW');
      expect(result.timezone).toBe('America/Chicago');
      expect(result.shouldRegionalize).toBe(true);
    });

    it('should increase TTL for high-latency regions', async () => {
      const request = new Request('https://example.com/test', {
        headers: { 'cf-ipcountry': 'AP' } // Asia-Pacific
      });

      const result = await cacheService.optimizeForRegion(request);

      expect(result.ttl).toBe(600); // 2 * default TTL
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when cache works', async () => {
      mockEnv.CACHE.put.mockResolvedValue(true);
      mockEnv.CACHE.get.mockResolvedValue(JSON.stringify({
        value: { timestamp: Date.now() },
        timestamp: Date.now()
      }));
      mockEnv.CACHE.delete.mockResolvedValue(true);

      const result = await cacheService.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.cache.set).toBe(true);
      expect(result.cache.get).toBe(true);
    });

    it('should return unhealthy status on errors', async () => {
      mockEnv.CACHE.put.mockRejectedValue(new Error('Cache error'));

      const result = await cacheService.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBeDefined();
    });
  });
});

describe('CachingMiddleware', () => {
  let middleware;
  let mockEnv;

  beforeEach(() => {
    mockEnv = {
      CACHE: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
      CACHE_KV: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() },
      ENVIRONMENT: 'test'
    };
    middleware = new CachingMiddleware(mockEnv);
    vi.clearAllMocks();
  });

  describe('cacheResponse', () => {
    it('should return cached response when available', async () => {
      const request = new Request('https://example.com/api/analytics/dashboard');
      const cachedData = { summary: { total_users: 100 } };
      mockEnv.CACHE.get.mockResolvedValue(JSON.stringify(cachedData));

      const middlewareFn = middleware.cacheResponse({
        ttl: 300,
        keyGenerator: (req) => 'test-key',
        shouldCache: () => true
      });

      const result = await middlewareFn(request, mockEnv, {});

      expect(result.status).toBe(200);
      expect(result.headers.get('X-Cache')).toBe('HIT');
    });

    it('should return null when cache miss', async () => {
      const request = new Request('https://example.com/api/test');
      mockEnv.CACHE.get.mockResolvedValue(null);

      const middlewareFn = middleware.cacheResponse({
        ttl: 300,
        keyGenerator: (req) => 'test-key',
        shouldCache: () => true
      });

      const result = await middlewareFn(request, mockEnv, {});

      expect(result).toBeNull();
    });

    it('should respect shouldCache condition', async () => {
      const request = new Request('https://example.com/api/test');

      const middlewareFn = middleware.cacheResponse({
        ttl: 300,
        keyGenerator: (req) => 'test-key',
        shouldCache: () => false
      });

      const result = await middlewareFn(request, mockEnv, {});

      expect(result).toBeNull();
      expect(mockEnv.CACHE.get).not.toHaveBeenCalled();
    });
  });

  describe('storeResponse', () => {
    it('should store successful responses in cache', async () => {
      const responseData = { success: true, data: 'test' };
      const response = new Response(JSON.stringify(responseData), { status: 200 });
      const request = new Request('https://example.com/api/test');
      mockEnv.CACHE.put.mockResolvedValue(true);

      const middlewareFn = middleware.storeResponse({
        ttl: 300,
        keyGenerator: (req) => 'test-key',
        shouldStore: () => true
      });

      const result = await middlewareFn(response, request, mockEnv, {});

      expect(result).toBe(response);
      expect(mockEnv.CACHE.put).toHaveBeenCalled();
    });

    it('should not store unsuccessful responses', async () => {
      const responseData = { success: false, error: 'test' };
      const response = new Response(JSON.stringify(responseData), { status: 400 });
      const request = new Request('https://example.com/api/test');

      const middlewareFn = middleware.storeResponse({
        ttl: 300,
        keyGenerator: (req) => 'test-key',
        shouldStore: () => true
      });

      const result = await middlewareFn(response, request, mockEnv, {});

      expect(result).toBe(response);
      expect(mockEnv.CACHE.put).not.toHaveBeenCalled();
    });
  });

  describe('rateLimit', () => {
    it('should allow requests within limits', async () => {
      const request = new Request('https://example.com/api/test');
      mockEnv.CACHE.get.mockResolvedValue(JSON.stringify({
        requests: [Date.now() - 1000] // 1 request
      }));
      mockEnv.CACHE.put.mockResolvedValue(true);

      const middlewareFn = middleware.rateLimit('user-1', 5, 60);
      const result = await middlewareFn(request, mockEnv, {});

      expect(result).toBeNull(); // No rate limit response
    });

    it('should return rate limit response when exceeded', async () => {
      const request = new Request('https://example.com/api/test');
      const fiveRequests = Array.from({ length: 5 }, () => Date.now() - 1000);
      mockEnv.CACHE.get.mockResolvedValue(JSON.stringify({
        requests: fiveRequests
      }));

      const middlewareFn = middleware.rateLimit('user-1', 5, 60);
      const result = await middlewareFn(request, mockEnv, {});

      expect(result.status).toBe(429);
      expect(result.headers.get('X-RateLimit-Limit')).toBe('5');
      expect(result.headers.get('Retry-After')).toBeDefined();
    });
  });

  describe('specialized caching methods', () => {
    it('should cache RAG queries', async () => {
      const request = new Request('https://example.com/query', {
        method: 'POST',
        body: JSON.stringify({ message: 'test query' }),
        headers: { 'Content-Type': 'application/json' }
      });
      mockEnv.CACHE.get.mockResolvedValue(null);

      const middlewareFn = middleware.cacheRAGQuery();
      const result = await middlewareFn(request, mockEnv, {});

      expect(result).toBeNull(); // No cached response for new query
    });

    it('should cache analytics responses', async () => {
      const request = new Request('https://example.com/analytics/dashboard');
      mockEnv.CACHE.get.mockResolvedValue(null);

      const middlewareFn = middleware.cacheAnalytics();
      const result = await middlewareFn(request, mockEnv, {});

      expect(result).toBeNull();
    });

    it('should cache session data', async () => {
      const request = new Request('https://example.com/auth/me');
      mockEnv.CACHE.get.mockResolvedValue(null);

      const middlewareFn = middleware.cacheSession();
      const result = await middlewareFn(request, mockEnv, {});

      expect(result).toBeNull();
    });
  });

  describe('monitorPerformance', () => {
    it('should return performance metrics', async () => {
      mockEnv.CACHE_KV.list.mockResolvedValue({
        keys: [
          { name: 'meta:key1' },
          { name: 'meta:key2' }
        ]
      });
      mockEnv.CACHE_KV.get.mockImplementation((key) => {
        return Promise.resolve(JSON.stringify({
          strategy: 'ttl',
          ttl: 300,
          tags: ['test'],
          priority: 'normal',
          created: Date.now() - 300000 // 5 minutes ago
        }));
      });

      const result = await middleware.monitorPerformance();

      expect(result.statistics.totalEntries).toBe(2);
      expect(result.performance.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(result.performance.cacheHitRate).toBeLessThanOrEqual(1);
    });
  });
});

describe('CacheManager', () => {
  let cacheManager;
  let mockEnv;

  beforeEach(() => {
    mockEnv = {
      CACHE: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
      CACHE_KV: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() },
      ENVIRONMENT: 'test'
    };
    cacheManager = new CacheManager(mockEnv);
    vi.clearAllMocks();
  });

  describe('warmupCache', () => {
    it('should warm cache with predefined queries', async () => {
      mockEnv.CACHE.put.mockResolvedValue(true);

      const result = await cacheManager.warmupCache();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Cache warmup completed');
      expect(result.result.total).toBeGreaterThan(0);
    });
  });

  describe('cleanupCache', () => {
    it('should clean up old cache entries', async () => {
      const oldKeys = [
        { name: 'meta:key1' },
        { name: 'meta:key2' }
      ];
      mockEnv.CACHE_KV.list.mockResolvedValue({ keys: oldKeys });
      mockEnv.CACHE_KV.get.mockResolvedValue(JSON.stringify({
        created: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      }));
      mockEnv.CACHE_KV.delete.mockResolvedValue(true);

      const result = await cacheManager.cleanupCache();

      expect(result.success).toBe(true);
      expect(result.entriesCleaned).toBe(2);
    });
  });

  describe('optimizeCache', () => {
    it('should optimize cache performance', async () => {
      mockEnv.CACHE_KV.list.mockResolvedValue({
        keys: Array.from({ length: 50 }, (_, i) => ({ name: `meta:key${i}` }))
      });
      mockEnv.CACHE_KV.get.mockImplementation((key) => {
        return Promise.resolve(JSON.stringify({
          strategy: 'ttl',
          ttl: 300,
          tags: ['test'],
          priority: 'normal',
          created: Date.now()
        }));
      });

      const result = await cacheManager.optimizeCache();

      expect(result.success).toBe(true);
      expect(result.optimizations).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.performance).toBeDefined();
    });

    it('should generate optimization recommendations', async () => {
      // Simulate low hit rate
      mockEnv.CACHE_KV.list.mockResolvedValue({ keys: [] });
      vi.spyOn(cacheManager.cachingMiddleware, 'monitorPerformance').mockResolvedValue({
        performance: { cacheHitRate: 0.5, averageResponseTime: 150 },
        statistics: { sizeEstimate: 60 * 1024 * 1024 }
      });

      const result = await cacheManager.optimizeCache();

      expect(result.optimizations.length).toBeGreaterThan(0);
      expect(result.optimizations[0].type).toBe('low_hit_rate');
    });
  });

  describe('getHealthReport', () => {
    it('should generate comprehensive health report', async () => {
      mockEnv.CACHE.put.mockResolvedValue(true);
      mockEnv.CACHE.get.mockResolvedValue(JSON.stringify({
        value: { timestamp: Date.now() },
        timestamp: Date.now()
      }));
      mockEnv.CACHE.delete.mockResolvedValue(true);
      mockEnv.CACHE_KV.list.mockResolvedValue({ keys: [] });

      const report = await cacheManager.getHealthReport();

      expect(report.timestamp).toBeDefined();
      expect(report.status).toBe('healthy');
      expect(report.health).toBeDefined();
      expect(report.statistics).toBeDefined();
      expect(report.performance).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
    });

    it('should generate recommendations for degraded performance', async () => {
      mockEnv.CACHE_KV.list.mockResolvedValue({
        keys: Array.from({ length: 15000 }, (_, i) => ({ name: `meta:key${i}` }))
      });
      vi.spyOn(cacheManager.cachingMiddleware, 'monitorPerformance').mockResolvedValue({
        performance: { cacheHitRate: 0.6, averageResponseTime: 250 },
        statistics: { sizeEstimate: 80 * 1024 * 1024 }
      });

      const report = await cacheManager.getHealthReport();

      expect(report.status).toBe('degraded');
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('resetCache', () => {
    it('should reset all cache entries', async () => {
      const keys = [
        { name: 'meta:key1' },
        { name: 'meta:key2' }
      ];
      mockEnv.CACHE_KV.list.mockResolvedValue({ keys });
      mockEnv.CACHE_KV.delete.mockResolvedValue(true);

      const result = await cacheManager.resetCache();

      expect(result.success).toBe(true);
      expect(result.entries_deleted).toBe(2);
    });

    it('should handle missing KV namespace', async () => {
      cacheManager.cacheService.kvNamespace = null;

      const result = await cacheManager.resetCache();

      expect(result.success).toBe(false);
      expect(result.error).toBe('KV namespace not available for cache reset');
    });
  });

  describe('exportMetrics', () => {
    it('should export cache metrics for monitoring', async () => {
      mockEnv.CACHE_KV.list.mockResolvedValue({ keys: [] });
      vi.spyOn(cacheManager.cacheService, 'getCacheStats').mockResolvedValue({
        totalEntries: 100,
        sizeEstimate: 1024000,
        strategies: { ttl: 80, lru: 20 },
        tags: { api: 60, analytics: 40 },
        priorities: { high: 30, normal: 60, low: 10 },
        averageAge: 150000
      });
      vi.spyOn(cacheManager.cachingMiddleware, 'monitorPerformance').mockResolvedValue({
        performance: {
          cacheHitRate: 0.85,
          averageResponseTime: 120,
          totalRequests: 1000,
          cacheMisses: 150
        }
      });
      vi.spyOn(cacheManager.cacheService, 'healthCheck').mockResolvedValue({
        status: 'healthy',
        cache: { set: true, get: true }
      });

      const metrics = await cacheManager.exportMetrics();

      expect(metrics.timestamp).toBeDefined();
      expect(metrics.cache.total_entries).toBe(100);
      expect(metrics.performance.cache_hit_rate).toBe(0.85);
      expect(metrics.health.status).toBe('healthy');
    });
  });
});