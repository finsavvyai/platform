import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as any).__mockDb) }));
vi.mock('../middleware/api-key-auth.js', () => ({
  apiKeyAuthMiddleware: async (c: any, next: any) => {
    const apiKey = c.req.header('Authorization') || c.req.header('X-API-Key');
    if (!apiKey) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    c.set('apiKey', apiKey);
    await next();
  },
}));
vi.mock('../services/otel-ingestion.js', () => ({
  processOtelTrace: vi.fn(async (_db: any, body: any) => {
    return [
      { traceId: 'trace-1', spanId: 'span-1', duration: 100 },
      { traceId: 'trace-2', spanId: 'span-2', duration: 200 },
    ];
  }),
}));
vi.stubGlobal('fetch', mockAuthFetch());
import { otelIngestRoutes } from './otel-ingest.js';

describe('OTEL Ingestion Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;
  const auth = { Authorization: 'Bearer api_key_123' };
  const json = { ...auth, 'Content-Type': 'application/json' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch());
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/otel', otelIngestRoutes);
  });

  describe('POST /api/otel', () => {
    const validBody = {
      resourceSpans: [
        {
          resource: { attributes: {} },
          scopeSpans: [{
            scope: { name: 'test' },
            spans: [{
              traceId: 'trace1',
              spanId: 'span1',
              name: 'llm_call',
              duration: 100,
            }],
          }],
        },
      ],
    };

    it('accepts OTLP trace data and returns 202', async () => {
      const res = await app.request('/api/otel', {
        method: 'POST',
        headers: json,
        body: JSON.stringify(validBody),
      }, mockEnv);
      expect(res.status).toBe(202);
      const body = (await res.json()) as any;
      expect(typeof body.data.tracesProcessed).toBe('number');
      expect(Array.isArray(body.data.traceIds)).toBe(true);
    });

    it('validates resourceSpans is array', async () => {
      let res = await app.request('/api/otel', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({}),
      }, mockEnv);
      expect(res.status).toBe(400);

      res = await app.request('/api/otel', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ resourceSpans: {} }),
      }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('returns 401 without API key', async () => {
      const res = await app.request('/api/otel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      }, mockEnv);
      expect(res.status).toBe(401);
    });

    it('rejects empty resourceSpans array', async () => {
      const res = await app.request('/api/otel', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ resourceSpans: [] }),
      }, mockEnv);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/otel/traces', () => {
    it('returns list of recent traces with required fields', async () => {
      const res = await app.request('/api/otel/traces', { headers: auth }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(Array.isArray(body.data)).toBe(true);
      body.data.forEach((trace: any) => {
        expect(trace).toHaveProperty('traceId');
        expect(trace).toHaveProperty('spanId');
        expect(trace).toHaveProperty('name');
        expect(trace).toHaveProperty('duration');
        expect(trace).toHaveProperty('status');
        expect(trace).toHaveProperty('timestamp');
        expect(typeof trace.duration).toBe('number');
        expect(trace.duration).toBeGreaterThanOrEqual(0);
        expect(['ok', 'error']).toContain(trace.status);
      });
    });

    it('returns 401 without API key', async () => {
      const res = await app.request('/api/otel/traces', {}, mockEnv);
      expect(res.status).toBe(401);
    });

    it('respects limit query parameter', async () => {
      const res = await app.request('/api/otel/traces?limit=10', { headers: auth }, mockEnv);
      const body = (await res.json()) as any;
      expect(body.data.length).toBeLessThanOrEqual(10);
    });

    it('defaults to 50 traces max', async () => {
      const res = await app.request('/api/otel/traces', { headers: auth }, mockEnv);
      const body = (await res.json()) as any;
      expect(body.data.length).toBeLessThanOrEqual(50);
    });

    it('accepts zero limit', async () => {
      const res = await app.request('/api/otel/traces?limit=0', { headers: auth }, mockEnv);
      expect(res.status).toBe(200);
    });

    it('handles non-numeric limit gracefully', async () => {
      const res = await app.request('/api/otel/traces?limit=abc', { headers: auth }, mockEnv);
      expect([200, 400]).toContain(res.status);
    });
  });
});
