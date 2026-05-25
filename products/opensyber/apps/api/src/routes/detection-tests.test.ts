import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, mockAuthFetch } from '../test/helpers.js';

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' }, 401);
    }
    c.set('userId', 'user_test123');
    await next();
  },
}));
vi.stubGlobal('fetch', mockAuthFetch());
import { detectionTestRoutes } from './detection-tests.js';

describe('Detection Test Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;
  const auth = { Authorization: 'Bearer valid-token' };
  const jsonAuth = { ...auth, 'Content-Type': 'application/json' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    vi.stubGlobal('fetch', mockAuthFetch());
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/detection-tests', detectionTestRoutes);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/detection-tests/suites', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  // ── GET /suites ─────────────────────────────────────────────────────
  describe('GET /api/detection-tests/suites', () => {
    it('returns all 6 test suites', async () => {
      const res = await app.request('/api/detection-tests/suites', { headers: auth }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(6);
    });

    it('includes correct categories', async () => {
      const res = await app.request('/api/detection-tests/suites', { headers: auth }, mockEnv);
      const body = (await res.json()) as any;
      const categories = body.data.map((s: any) => s.category);
      expect(categories).toContain('prompt-injection');
      expect(categories).toContain('exfiltration');
      expect(categories).toContain('supply-chain');
      expect(categories).toContain('credential-probe');
      expect(categories).toContain('tool-anomaly');
      expect(categories).toContain('full');
    });

    it('full suite has 27 tests', async () => {
      const res = await app.request('/api/detection-tests/suites', { headers: auth }, mockEnv);
      const body = (await res.json()) as any;
      const full = body.data.find((s: any) => s.category === 'full');
      expect(full.testCount).toBe(27);
    });

    it('each suite has required fields', async () => {
      const res = await app.request('/api/detection-tests/suites', { headers: auth }, mockEnv);
      const body = (await res.json()) as any;
      for (const suite of body.data) {
        expect(suite).toHaveProperty('id');
        expect(suite).toHaveProperty('name');
        expect(suite).toHaveProperty('description');
        expect(suite).toHaveProperty('testCount');
        expect(suite).toHaveProperty('category');
      }
    });
  });

  // ── POST /run ───────────────────────────────────────────────────────
  describe('POST /api/detection-tests/run', () => {
    it('runs a suite and returns completed results', async () => {
      const res = await app.request('/api/detection-tests/run', {
        method: 'POST', headers: jsonAuth,
        body: JSON.stringify({ instanceId: 'inst_abc', suiteId: 'prompt-injection' }),
      }, mockEnv);
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.status).toBe('completed');
      expect(body.data.totalTests).toBe(8);
      expect(body.data.passed).toBe(8);
      expect(body.data.failed).toBe(0);
      expect(body.data.tests).toHaveLength(8);
    });

    it('runs full suite with 27 tests', async () => {
      const res = await app.request('/api/detection-tests/run', {
        method: 'POST', headers: jsonAuth,
        body: JSON.stringify({ instanceId: 'inst_abc', suiteId: 'full' }),
      }, mockEnv);
      const body = (await res.json()) as any;
      expect(body.data.totalTests).toBe(27);
      expect(body.data.tests).toHaveLength(27);
    });

    it('returns 400 for missing instanceId', async () => {
      const res = await app.request('/api/detection-tests/run', {
        method: 'POST', headers: jsonAuth,
        body: JSON.stringify({ suiteId: 'prompt-injection' }),
      }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('returns 404 for unknown suite', async () => {
      const res = await app.request('/api/detection-tests/run', {
        method: 'POST', headers: jsonAuth,
        body: JSON.stringify({ instanceId: 'inst_abc', suiteId: 'nonexistent' }),
      }, mockEnv);
      expect(res.status).toBe(404);
    });

    it('stores run in KV', async () => {
      const res = await app.request('/api/detection-tests/run', {
        method: 'POST', headers: jsonAuth,
        body: JSON.stringify({ instanceId: 'inst_abc', suiteId: 'exfiltration' }),
      }, mockEnv);
      const body = (await res.json()) as any;
      expect(mockEnv.CACHE.put).toHaveBeenCalledWith(
        `test-run:${body.data.id}`,
        expect.any(String),
        expect.objectContaining({ expirationTtl: 86400 }),
      );
    });

    it('test results include latency values', async () => {
      const res = await app.request('/api/detection-tests/run', {
        method: 'POST', headers: jsonAuth,
        body: JSON.stringify({ instanceId: 'inst_abc', suiteId: 'credential-probe' }),
      }, mockEnv);
      const body = (await res.json()) as any;
      for (const test of body.data.tests) {
        expect(test.latencyMs).toBeGreaterThan(0);
        expect(test.result).toBe('pass');
        expect(test.detectedAt).toBeDefined();
      }
    });
  });

  // ── GET /runs/:runId ────────────────────────────────────────────────
  describe('GET /api/detection-tests/runs/:runId', () => {
    it('returns 404 for unknown run', async () => {
      const res = await app.request(
        '/api/detection-tests/runs/nonexistent',
        { headers: auth },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it('retrieves a stored run from KV', async () => {
      const storedRun = { id: 'run_123', suiteId: 'exfiltration', status: 'completed' };
      (mockEnv.CACHE.get as any).mockResolvedValueOnce(storedRun);
      const res = await app.request(
        '/api/detection-tests/runs/run_123',
        { headers: auth },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.id).toBe('run_123');
    });
  });
});
