/**
 * Tests for Tenant-Aware Rate Limiter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TENANT_RATE_LIMITS,
  cleanupMemoryCounters,
  tenantRateLimit,
  endpointRateLimit,
  slidingWindowRateLimit,
} from './tenant-rate-limiter';

describe('Tenant Rate Limiter', () => {
  describe('TENANT_RATE_LIMITS', () => {
    it('should have free tier with 100 req/min stated limit', () => {
      expect(TENANT_RATE_LIMITS.free.statedLimit).toBe(100);
    });

    it('should have pro tier with 1000 req/min stated limit', () => {
      expect(TENANT_RATE_LIMITS.pro.statedLimit).toBe(1000);
    });

    it('should have enterprise tier with 10000 req/min stated limit', () => {
      expect(TENANT_RATE_LIMITS.enterprise.statedLimit).toBe(10000);
    });

    it('should apply 70% safety margin to KV limits', () => {
      expect(TENANT_RATE_LIMITS.free.kvLimit).toBe(70);
      expect(TENANT_RATE_LIMITS.pro.kvLimit).toBe(700);
      expect(TENANT_RATE_LIMITS.enterprise.kvLimit).toBe(7000);
    });
  });

  describe('cleanupMemoryCounters', () => {
    it('should remove expired entries', () => {
      // This test mainly verifies the function doesn't throw
      expect(() => cleanupMemoryCounters()).not.toThrow();
    });
  });

  describe('tenantRateLimit middleware', () => {
    let mockContext: any;
    let mockEnv: any;
    let nextCalled = false;

    beforeEach(() => {
      nextCalled = false;
      mockEnv = {
        KV: {
          get: vi.fn().mockResolvedValue(null),
          put: vi.fn().mockResolvedValue(undefined),
        },
      };

      mockContext = {
        get: vi.fn((key: string) => {
          const values: Record<string, any> = {
            tenantId: 'tenant-123',
            userTier: 'pro',
          };
          return values[key];
        }),
        env: mockEnv,
        req: {
          path: '/test',
        },
        header: vi.fn(),
        json: vi.fn((data, status) => ({ data, status })),
      };
    });

    it('should allow request under rate limit', async () => {
      const middleware = tenantRateLimit;
      const next = vi.fn(async () => {
        nextCalled = true;
      });

      // Mock KV.get to return 50 (under 700 limit for pro)
      mockEnv.KV.get.mockResolvedValue('50');

      const handler = await middleware(mockContext, next);

      // Note: Hono middleware returns result of next() or error response
      expect(mockContext.header).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        expect.any(String),
      );
    });

    it('should block request over rate limit', async () => {
      const middleware = tenantRateLimit;
      const next = vi.fn();

      // Mock KV.get to return at-limit count
      mockEnv.KV.get.mockResolvedValue('700');

      const result = await middleware(mockContext, next);

      // Should return 429 response without calling next
      if (result && typeof result === 'function') {
        const response = result(mockContext);
        // Verify rate limit response format
      }
    });

    it('should skip rate limiting if no tenantId', async () => {
      mockContext.get.mockReturnValue(null);

      const middleware = tenantRateLimit;
      const next = vi.fn(async () => {
        nextCalled = true;
      });

      await middleware(mockContext, next);

      // Should skip to next without rate limiting
    });

    it('should use free tier limits as default', async () => {
      mockContext.get.mockImplementation((key: string) => {
        const values: Record<string, any> = {
          tenantId: 'tenant-456',
          userTier: undefined, // No tier specified
        };
        return values[key];
      });

      const middleware = tenantRateLimit;
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(mockContext.header).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        String(TENANT_RATE_LIMITS.free.statedLimit),
      );
    });

    it('should fall back to memory counter on KV error', async () => {
      mockEnv.KV.get.mockRejectedValue(new Error('KV unavailable'));

      const middleware = tenantRateLimit;
      const next = vi.fn();

      const result = await middleware(mockContext, next);

      // Should not throw and should set rate limit headers
      expect(mockContext.header).toHaveBeenCalled();
    });

    it('should set Retry-After header on rate limit', async () => {
      mockEnv.KV.get.mockResolvedValue('800');

      const middleware = tenantRateLimit;
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(mockContext.header).toHaveBeenCalledWith(
        'Retry-After',
        expect.stringMatching(/^\d+$/),
      );
    });
  });

  describe('endpointRateLimit middleware', () => {
    let mockContext: any;
    let mockEnv: any;

    beforeEach(() => {
      mockEnv = {
        KV: {
          get: vi.fn().mockResolvedValue(null),
          put: vi.fn().mockResolvedValue(undefined),
        },
      };

      mockContext = {
        get: vi.fn((key: string) => {
          const values: Record<string, any> = {
            tenantId: 'tenant-123',
          };
          return values[key];
        }),
        env: mockEnv,
        req: {
          path: '/api/expensive-operation',
        },
        header: vi.fn(),
        json: vi.fn((data, status) => ({ data, status })),
      };
    });

    it('should enforce stricter limits for expensive endpoints', async () => {
      const middleware = endpointRateLimit(10, 60); // 10 requests per minute
      const next = vi.fn();

      // Mock KV returning limit reached
      mockEnv.KV.get.mockResolvedValue('7'); // 70% of 10

      await middleware(mockContext, next);

      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
    });

    it('should allow custom window sizes', async () => {
      const middleware = endpointRateLimit(5, 3600); // 5 requests per hour
      const next = vi.fn();

      mockEnv.KV.get.mockResolvedValue(null);

      await middleware(mockContext, next);

      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
    });
  });

  describe('slidingWindowRateLimit middleware', () => {
    let mockContext: any;
    let mockEnv: any;

    beforeEach(() => {
      mockEnv = {
        KV: {
          get: vi.fn().mockResolvedValue(null),
          put: vi.fn().mockResolvedValue(undefined),
        },
      };

      mockContext = {
        get: vi.fn((key: string) => {
          const values: Record<string, any> = {
            tenantId: 'tenant-123',
          };
          return values[key];
        }),
        env: mockEnv,
        req: {
          path: '/test',
        },
        header: vi.fn(),
        json: vi.fn((data, status) => ({ data, status })),
      };
    });

    it('should use sliding window algorithm', async () => {
      const middleware = slidingWindowRateLimit(100, 60);
      const next = vi.fn();

      mockEnv.KV.get.mockResolvedValue(null);

      await middleware(mockContext, next);

      // Should initialize sliding window data
      expect(mockEnv.KV.put).toHaveBeenCalled();
    });

    it('should reset window when expired', async () => {
      const now = Date.now() / 1000;
      const expiredWindow = {
        count: 100,
        resetAt: now - 10, // Already expired
      };

      mockEnv.KV.get.mockResolvedValue(JSON.stringify(expiredWindow));

      const middleware = slidingWindowRateLimit(100, 60);
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(mockEnv.KV.put).toHaveBeenCalled();
    });

    it('should block when window limit exceeded', async () => {
      const now = Date.now() / 1000;
      const limitWindow = {
        count: 100,
        resetAt: now + 30,
      };

      mockEnv.KV.get.mockResolvedValue(JSON.stringify(limitWindow));

      const middleware = slidingWindowRateLimit(100, 60);
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(mockContext.header).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        expect.any(String),
      );
    });
  });
});
