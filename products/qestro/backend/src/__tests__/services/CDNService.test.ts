/**
 * CDN Service Unit Tests
 * Test CDN caching, cache invalidation, and performance monitoring
 */

import { CloudflareCDN, CDNService } from '../../services/CDNService.js';

// Mock fetch
global.fetch = jest.fn();

describe('CloudflareCDN', () => {
  let cloudflareCDN: CloudflareCDN;

  beforeEach(() => {
    cloudflareCDN = new CloudflareCDN({
      provider: 'cloudflare',
      zoneId: 'test-zone-id',
      apiKey: 'test-api-key',
    });
    jest.clearAllMocks();
  });

  describe('Cache Purging', () => {
    test('should purge cache by URLs successfully', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await cloudflareCDN.purgeCache({
        urls: ['https://example.com/page1', 'https://example.com/page2'],
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/zones/test-zone-id/purge_cache',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
          }),
          body: expect.stringContaining('"files"'),
        })
      );
    });

    test('should purge cache by patterns successfully', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await cloudflareCDN.purgeCache({
        patterns: ['/api/*', '/static/*'],
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/zones/test-zone-id/purge_cache',
        expect.objectContaining({
          body: expect.stringContaining('"tags"'),
        })
      );
    });

    test('should purge all cache successfully', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await cloudflareCDN.purgeCache({
        purgeEverything: true,
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/zones/test-zone-id/purge_cache',
        expect.objectContaining({
          body: expect.stringContaining('"purge_everything": true'),
        })
      );
    });

    test('should handle purge failure', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          errors: [{ message: 'Invalid purge request' }],
        }),
      } as Response);

      const result = await cloudflareCDN.purgeCache({
        urls: ['https://example.com/page1'],
      });

      expect(result).toBe(false);
    });

    test('should handle network errors during purge', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await cloudflareCDN.purgeCache({
        urls: ['https://example.com/page1'],
      });

      expect(result).toBe(false);
    });
  });

  describe('Cache Rules Management', () => {
    test('should get cache rules successfully', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: [
            {
              targets: [{ constraint: { value: '/api/*' } }],
              actions: [
                { id: 'cache_ttl', value: 3600 },
                { id: 'bypass_cache_on_cookie' },
              ],
            },
          ],
        }),
      } as Response);

      const rules = await cloudflareCDN.getCacheRules();

      expect(rules).toHaveLength(1);
      expect(rules[0].pattern).toBe('/api/*');
      expect(rules[0].ttl).toBe(3600);
      expect(rules[0].bypassCache).toBe(true);
    });

    test('should create cache rule successfully', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const rule = {
        pattern: '/static/*',
        ttl: 86400,
        edgeTTL: 604800,
        compression: true,
      };

      const result = await cloudflareCDN.createCacheRule(rule);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/zones/test-zone-id/pagerules',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('/static/*'),
        })
      );
    });

    test('should handle rule creation failure', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          errors: [{ message: 'Invalid rule configuration' }],
        }),
      } as Response);

      const result = await cloudflareCDN.createCacheRule({
        pattern: 'invalid-pattern',
        ttl: 3600,
      });

      expect(result).toBe(false);
    });

    test('should update cache rule successfully', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const rule = {
        pattern: '/updated/*',
        ttl: 7200,
      };

      const result = await cloudflareCDN.updateCacheRule('rule-id-123', rule);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/zones/test-zone-id/pagerules/rule-id-123',
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    test('should delete cache rule successfully', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await cloudflareCDN.deleteCacheRule('rule-id-123');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/zones/test-zone-id/pagerules/rule-id-123',
        { method: 'DELETE', headers: expect.any(Object), body: undefined }
      );
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should get CDN statistics successfully', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            requests: { http: { all: 10000, cached: 8000 } },
            bandwidth: { http: { all: 1000000, cached: 800000 } },
            responseTime: { http: { all: 150 } },
          },
        }),
      } as Response);

      const stats = await cloudflareCDN.getStats();

      expect(stats.requests).toBe(10000);
      expect(stats.cachedRequests).toBe(8000);
      expect(stats.hitRate).toBe(80);
      expect(stats.avgResponseTime).toBe(150);
    });

    test('should handle stats API failure', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ success: false }),
      } as Response);

      const stats = await cloudflareCDN.getStats();

      expect(stats.requests).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('Health Checks', () => {
    test('should report healthy status', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const health = await cloudflareCDN.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.latency).toBeGreaterThan(0);
    });

    test('should report degraded status for high latency', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as Response), 3000))
      );

      const health = await cloudflareCDN.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.latency).toBeGreaterThan(2000);
    });

    test('should report unhealthy status for API failure', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockRejectedValue(new Error('API connection failed'));

      const health = await cloudflareCDN.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.latency).toBe(-1);
    });
  });

  describe('API Request Handling', () => {
    test('should make requests with correct headers', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await cloudflareCDN.getCacheRules();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          },
        })
      );
    });

    test('should handle API error responses', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          errors: [{ message: 'Invalid API token' }],
        }),
      } as Response);

      await expect(cloudflareCDN.getCacheRules()).rejects.toThrow(
        'Cloudflare API error: Invalid API token'
      );
    });
  });
});

describe('CDNService', () => {
  let cdnService: CDNService;

  beforeEach(() => {
    cdnService = new CDNService({
      provider: 'cloudflare',
      zoneId: 'test-zone',
      apiKey: 'test-key',
    });
    jest.clearAllMocks();
  });

  describe('Service Management', () => {
    test('should create Cloudflare provider instance', () => {
      expect(cdnService).toBeDefined();
    });

    test('should throw error for unsupported provider', () => {
      expect(() => {
        new CDNService({
          provider: 'unsupported',
          zoneId: 'test',
          apiKey: 'test',
        });
      }).toThrow('Unsupported CDN provider: unsupported');
    });
  });

  describe('Convenience Methods', () => {
    test('should purge URLs using convenience method', async () => {
      const mockPurgeCache = jest.spyOn(cdnService as any, 'provider', 'get').mockReturnValue({
        purgeCache: jest.fn().mockResolvedValue(true),
      });

      const result = await cdnService.purgeURLs(['https://example.com/page1']);

      expect(result).toBe(true);
      expect(mockPurgeCache().purgeCache).toHaveBeenCalledWith({
        urls: ['https://example.com/page1'],
      });
    });

    test('should purge patterns using convenience method', async () => {
      const mockPurgeCache = jest.spyOn(cdnService as any, 'provider', 'get').mockReturnValue({
        purgeCache: jest.fn().mockResolvedValue(true),
      });

      const result = await cdnService.purgePatterns(['/api/*']);

      expect(result).toBe(true);
      expect(mockPurgeCache().purgeCache).toHaveBeenCalledWith({
        patterns: ['/api/*'],
      });
    });

    test('should purge all cache using convenience method', async () => {
      const mockPurgeCache = jest.spyOn(cdnService as any, 'provider', 'get').mockReturnValue({
        purgeCache: jest.fn().mockResolvedValue(true),
      });

      const result = await cdnService.purgeAll();

      expect(result).toBe(true);
      expect(mockPurgeCache().purgeCache).toHaveBeenCalledWith({
        purgeEverything: true,
      });
    });
  });

  describe('Default Rules Setup', () => {
    test('should setup default cache rules successfully', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await cdnService.setupDefaultRules();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(5); // 5 default rules
    });

    test('should handle partial rule setup failures', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ success: false }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);

      const result = await cdnService.setupDefaultRules();

      expect(result).toBe(false); // Not all rules were created
    });
  });

  describe('Error Handling', () => {
    test('should handle provider errors gracefully', async () => {
      const mockProvider = {
        purgeCache: jest.fn().mockRejectedValue(new Error('Provider error')),
        getStats: jest.fn().mockRejectedValue(new Error('Stats error')),
        healthCheck: jest.fn().mockRejectedValue(new Error('Health error')),
      };

      Object.defineProperty(cdnService, 'provider', {
        get: () => mockProvider,
      });

      const purgeResult = await cdnService.purgeAll();
      const statsResult = await cdnService.getStats();
      const healthResult = await cdnService.healthCheck();

      expect(purgeResult).toBe(false);
      expect(statsResult.requests).toBe(0);
      expect(healthResult.status).toBe('unhealthy');
    });
  });

  describe('Method Delegation', () => {
    test('should delegate getCacheRules to provider', async () => {
      const mockRules = [{ pattern: '/test/*', ttl: 3600 }];
      const mockProvider = {
        getCacheRules: jest.fn().mockResolvedValue(mockRules),
      };

      Object.defineProperty(cdnService, 'provider', {
        get: () => mockProvider,
      });

      const result = await cdnService.getCacheRules();

      expect(result).toEqual(mockRules);
      expect(mockProvider.getCacheRules).toHaveBeenCalledTimes(1);
    });

    test('should delegate getStats to provider', async () => {
      const mockStats = { requests: 1000, hitRate: 85 };
      const mockProvider = {
        getStats: jest.fn().mockResolvedValue(mockStats),
      };

      Object.defineProperty(cdnService, 'provider', {
        get: () => mockProvider,
      });

      const result = await cdnService.getStats();

      expect(result).toEqual(mockStats);
      expect(mockProvider.getStats).toHaveBeenCalledTimes(1);
    });

    test('should delegate healthCheck to provider', async () => {
      const mockHealth = { status: 'healthy', latency: 100 };
      const mockProvider = {
        healthCheck: jest.fn().mockResolvedValue(mockHealth),
      };

      Object.defineProperty(cdnService, 'provider', {
        get: () => mockProvider,
      });

      const result = await cdnService.healthCheck();

      expect(result).toEqual(mockHealth);
      expect(mockProvider.healthCheck).toHaveBeenCalledTimes(1);
    });
  });
});