import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRateLimiter } from '../src/middleware/rate-limiter';
import type { Context } from 'hono';
import type { KVNamespace } from '../src/bindings';

describe('rate-limiter middleware', () => {
  let mockKV: Partial<KVNamespace>;
  let mockContext: Partial<Context>;
  let nextCalled = false;

  beforeEach(() => {
    nextCalled = false;
    mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    };
    mockContext = {
      env: { KV_NAMESPACE: mockKV },
      req: {
        header: vi.fn((name) => {
          if (name === 'cf-connecting-ip') return '192.168.1.1';
          return undefined;
        }),
      } as any,
      status: vi.fn().mockReturnValue(mockContext),
      json: vi.fn().mockReturnValue('error response'),
    };
  });

  it('should allow request when under limit', async () => {
    const middleware = createRateLimiter({
      maxRequests: 5,
      windowMs: 60000,
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(mockContext as Context, next);

    expect(next).toHaveBeenCalled();
    expect(mockContext.status).not.toHaveBeenCalledWith(429);
  });

  it('should reject request when limit exceeded', async () => {
    const requests = Array(5).fill(Date.now());
    (mockKV.get as any).mockResolvedValueOnce(JSON.stringify(requests));

    const middleware = createRateLimiter({
      maxRequests: 5,
      windowMs: 60000,
    });
    const next = vi.fn();

    await middleware(mockContext as Context, next);

    expect(mockContext.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it('should store requests in KV with TTL', async () => {
    const middleware = createRateLimiter({
      maxRequests: 5,
      windowMs: 60000,
      keyPrefix: 'test',
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(mockContext as Context, next);

    expect(mockKV.put).toHaveBeenCalled();
    const [key, value, options] = (mockKV.put as any).mock
      .calls[0];
    expect(key).toBe('test:192.168.1.1');
    expect(options?.expirationTtl).toBe(60);
  });

  it('should use custom key function', async () => {
    const middleware = createRateLimiter({
      maxRequests: 5,
      windowMs: 60000,
      keyFn: () => 'custom-key',
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(mockContext as Context, next);

    const [key] = (mockKV.put as any).mock.calls[0];
    expect(key).toContain('custom-key');
  });

  it('should skip when KV is not available', async () => {
    mockContext.env = {};
    const middleware = createRateLimiter({
      maxRequests: 5,
      windowMs: 60000,
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(mockContext as Context, next);

    expect(next).toHaveBeenCalled();
  });

  it('should filter expired requests', async () => {
    const now = Date.now();
    const oldRequest = now - 70000;
    const recentRequest = now - 1000;
    const requests = [oldRequest, recentRequest];
    (mockKV.get as any).mockResolvedValueOnce(JSON.stringify(requests));

    const middleware = createRateLimiter({
      maxRequests: 2,
      windowMs: 60000,
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(mockContext as Context, next);

    expect(next).toHaveBeenCalled();
  });

  it('should handle empty KV gracefully', async () => {
    const middleware = createRateLimiter({
      maxRequests: 5,
      windowMs: 60000,
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(mockContext as Context, next);

    expect(next).toHaveBeenCalled();
  });
});
