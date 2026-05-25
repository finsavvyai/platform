import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import handler from '../../pages/api/health';

type HealthSuccessPayload = {
  status: 'healthy';
  timestamp: string;
  message: string;
};

type ErrorPayload = {
  error: string;
  status?: string;
  timestamp?: string;
};

describe('/api/health endpoint', () => {
  beforeAll(() => {
    // Handler is Edge: (req: NextRequest) => Promise<Response>
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const toRequest = (method: string, url = 'https://sdlc.cc/api/health') =>
    new Request(url, { method });

  it('should return 200 OK for GET', async () => {
    const res = await handler(toRequest('GET') as any);
    expect(res.status).toBe(200);
  });

  it('should return health status response', async () => {
    const res = await handler(toRequest('GET') as any);
    const data = await res.json() as HealthSuccessPayload;
    expect(data).toMatchObject({
      status: 'healthy',
      timestamp: expect.any(String),
      message: 'SDLC Platform API is working',
    });
  });

  it('should set content-type application/json', async () => {
    const res = await handler(toRequest('GET') as any);
    expect(res.headers.get('content-type')).toBe('application/json');
  });

  it('should support HEAD requests', async () => {
    const res = await handler(toRequest('HEAD') as any);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('');
  });

  it('should reject POST with 405', async () => {
    const res = await handler(toRequest('POST') as any);
    expect(res.status).toBe(405);
    const data = await res.json() as ErrorPayload;
    expect(data.error).toBe('Method not allowed');
  });

  it('should handle multiple GET requests', async () => {
    const res1 = await handler(toRequest('GET') as any);
    const res2 = await handler(toRequest('GET') as any);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  describe('Error Handling', () => {
    it('should handle internal errors gracefully', async () => {
      const orig = Date.prototype.toISOString;
      let callCount = 0;
      try {
        Date.prototype.toISOString = function (this: Date) {
          callCount++;
          if (callCount === 1) throw new Error('Date error');
          return orig.call(this);
        };
        const res = await handler(toRequest('GET') as any);
        expect(res.status).toBe(500);
        const data = await res.json() as ErrorPayload;
        expect(data.error).toBe('Internal server error');
      } finally {
        Date.prototype.toISOString = orig;
      }
    });
  });

  describe('Performance', () => {
    it('should respond within acceptable time', async () => {
      const start = Date.now();
      await handler(toRequest('GET') as any);
      expect(Date.now() - start).toBeLessThan(500);
    });

    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, () =>
        handler(toRequest('GET') as any)
      );
      const results = await Promise.all(promises);
      expect(results.every((r) => r.status === 200)).toBe(true);
    });
  });

  describe('Security', () => {
    it('should not expose sensitive information', async () => {
      const res = await handler(toRequest('GET') as any);
      const data = await res.json() as HealthSuccessPayload;
      const str = JSON.stringify(data);
      expect(str).not.toContain('password');
      expect(str).not.toContain('secret');
    });
  });
});
