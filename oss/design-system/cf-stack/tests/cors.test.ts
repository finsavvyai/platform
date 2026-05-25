import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCors } from '../src/middleware/cors';
import type { Context } from 'hono';

describe('cors middleware', () => {
  let mockContext: Partial<Context>;

  beforeEach(() => {
    mockContext = {
      req: {
        header: vi.fn(),
        method: 'GET',
      } as any,
      header: vi.fn().mockReturnValue(mockContext),
      text: vi.fn().mockReturnValue('response'),
    };
  });

  it('should allow OPTIONS preflight for allowed origin', async () => {
    (mockContext.req as any).header = vi.fn((name) => {
      if (name === 'origin') return 'https://example.com';
      return undefined;
    });
    (mockContext.req as any).method = 'OPTIONS';

    const middleware = createCors({ origins: ['https://example.com'] });
    const next = vi.fn();

    await middleware(mockContext as Context, next);

    expect(mockContext.header).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'https://example.com',
    );
    expect(mockContext.header).toHaveBeenCalledWith(
      'Access-Control-Allow-Methods',
      expect.stringContaining('GET'),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject OPTIONS preflight for disallowed origin', async () => {
    (mockContext.req as any).header = vi.fn((name) => {
      if (name === 'origin') return 'https://evil.com';
      return undefined;
    });
    (mockContext.req as any).method = 'OPTIONS';

    const middleware = createCors({ origins: ['https://example.com'] });
    const next = vi.fn();

    await middleware(mockContext as Context, next);

    expect(mockContext.text).toHaveBeenCalledWith('Forbidden', 403);
  });

  it('should allow wildcard origins', async () => {
    (mockContext.req as any).header = vi.fn((name) => {
      if (name === 'origin') return 'https://any.com';
      return undefined;
    });
    (mockContext.req as any).method = 'OPTIONS';

    const middleware = createCors({ origins: ['*'] });
    const next = vi.fn();

    await middleware(mockContext as Context, next);

    expect(mockContext.text).not.toHaveBeenCalledWith('', 403);
  });

  it('should set CORS headers on non-OPTIONS requests', async () => {
    (mockContext.req as any).header = vi.fn((name) => {
      if (name === 'origin') return 'https://example.com';
      return undefined;
    });
    (mockContext.req as any).method = 'GET';

    const middleware = createCors({ origins: ['https://example.com'] });
    const next = vi.fn();

    await middleware(mockContext as Context, next);

    expect(mockContext.header).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'https://example.com',
    );
    expect(next).toHaveBeenCalled();
  });

  it('should handle credentials flag', async () => {
    (mockContext.req as any).method = 'OPTIONS';
    (mockContext.req as any).header = vi.fn();

    const middleware = createCors({
      origins: ['https://example.com'],
      credentials: true,
    });
    const next = vi.fn();

    await middleware(mockContext as Context, next);

    expect(mockContext.header).toHaveBeenCalledWith(
      'Access-Control-Allow-Credentials',
      'true',
    );
  });

  it('should use custom methods', async () => {
    (mockContext.req as any).method = 'OPTIONS';
    (mockContext.req as any).header = vi.fn();

    const middleware = createCors({
      origins: ['*'],
      methods: ['GET', 'POST'],
    });
    const next = vi.fn();

    await middleware(mockContext as Context, next);

    expect(mockContext.header).toHaveBeenCalledWith(
      'Access-Control-Allow-Methods',
      'GET, POST',
    );
  });

  it('should return 204 for successful preflight', async () => {
    (mockContext.req as any).method = 'OPTIONS';
    (mockContext.req as any).header = vi.fn();
    const createResponseSpy = vi.spyOn(global, 'Response' as any).mockImplementation(() => ({
      status: 204,
    }));

    const middleware = createCors({ origins: ['*'] });
    const next = vi.fn();

    await middleware(mockContext as Context, next);

    expect(createResponseSpy).toHaveBeenCalledWith(null, { status: 204 });
    createResponseSpy.mockRestore();
  });
});
