/**
 * Trace Retrieval Route Tests
 *
 * GET /:traceId
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: { req: { header: (h: string) => string | undefined }; json: (b: unknown, s: number) => Response; set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    const h = c.req.header('Authorization');
    if (!h?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'user-admin');
    await next();
  },
}));

vi.mock('../middleware/db.js', () => ({
  dbMiddleware: async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));

vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('orgId', 'org-1');
    c.set('role', 'admin');
    c.set('orgMember', { orgId: 'org-1', userId: 'user-admin', role: 'admin' });
    await next();
  },
  requirePermission: (_permission: string) => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

import { traceRoutes } from './traces.js';
import { createMockEnv } from '../test/helpers.js';

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const AUTH = { Authorization: 'Bearer valid-token' };
const OWNER_JSON = JSON.stringify({ orgId: 'org-1', userId: 'user-admin', storedAt: '2026-04-17T00:00:00Z' });

/**
 * Seed both the trace payload and its owner sidecar so requireTraceOwnership
 * passes for the admin user the RBAC mock installs.
 */
function mockTraceKv(env: ReturnType<typeof createMockEnv>, payload: string | null, ownerOverride?: string | null) {
  const owner = ownerOverride === undefined ? OWNER_JSON : ownerOverride;
  env.CACHE.get = vi.fn(async (key: string) => {
    if (key.endsWith(':owner')) return owner;
    return payload;
  });
}

function buildApp() {
  const app = new Hono<{ Bindings: ReturnType<typeof createMockEnv> }>();
  app.route('/traces', traceRoutes);
  return app;
}

describe('GET /traces/:traceId', () => {
  let env: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
  });

  describe('authentication', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const app = buildApp();
      const res = await app.request(`/traces/${VALID_UUID}`, {}, env);
      expect(res.status).toBe(401);
    });

    it('returns 401 when Authorization header has wrong scheme', async () => {
      const app = buildApp();
      const res = await app.request(`/traces/${VALID_UUID}`, {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      }, env);
      expect(res.status).toBe(401);
    });
  });

  describe('input validation', () => {
    it('returns 400 for a non-UUID traceId', async () => {
      const app = buildApp();
      const res = await app.request('/traces/not-a-uuid', { headers: AUTH }, env);
      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Invalid trace ID format');
    });

    it('returns 400 for a partial UUID', async () => {
      const app = buildApp();
      const res = await app.request('/traces/a1b2c3d4-e5f6-7890', { headers: AUTH }, env);
      expect(res.status).toBe(400);
    });

    it('returns 400 for an empty-segment traceId', async () => {
      const app = buildApp();
      const res = await app.request('/traces/------', { headers: AUTH }, env);
      expect(res.status).toBe(400);
    });

    it('accepts UUID with uppercase letters', async () => {
      // UUID regex is case-insensitive; KV returns null → 404, not 400
      const app = buildApp();
      const upperUuid = VALID_UUID.toUpperCase();
      const res = await app.request(`/traces/${upperUuid}`, { headers: AUTH }, env);
      // Not a 400 — UUID is valid, KV just has no data
      expect(res.status).not.toBe(400);
    });
  });

  describe('missing trace (404)', () => {
    it('returns 404 when KV has owner metadata but trace payload is missing', async () => {
      mockTraceKv(env, null);
      const app = buildApp();
      const res = await app.request(`/traces/${VALID_UUID}`, { headers: AUTH }, env);
      expect(res.status).toBe(404);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Trace not found or expired');
    });

    it('returns 410 when owner sidecar is missing (legacy trace without tenant metadata)', async () => {
      mockTraceKv(env, JSON.stringify({ traceEvents: [] }), null);
      const app = buildApp();
      const res = await app.request(`/traces/${VALID_UUID}`, { headers: AUTH }, env);
      expect(res.status).toBe(410);
    });

    it('returns 403 when trace is owned by a different tenant', async () => {
      mockTraceKv(
        env,
        JSON.stringify({ traceEvents: [] }),
        JSON.stringify({ orgId: 'other-org', userId: 'other-user', storedAt: '2026-04-17T00:00:00Z' }),
      );
      const app = buildApp();
      const res = await app.request(`/traces/${VALID_UUID}`, { headers: AUTH }, env);
      expect(res.status).toBe(403);
    });
  });

  describe('valid trace (200)', () => {
    it('returns parsed JSON for a stored trace', async () => {
      const tracePayload = { traceEvents: [{ name: 'llm-call', ph: 'X', ts: 1000, dur: 200, pid: 1, tid: 42, cat: 'api', args: {} }] };
      mockTraceKv(env, JSON.stringify(tracePayload));

      const app = buildApp();
      const res = await app.request(`/traces/${VALID_UUID}`, { headers: AUTH }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as typeof tracePayload;
      expect(body.traceEvents).toHaveLength(1);
      expect(body.traceEvents[0]!.name).toBe('llm-call');
    });

    it('passes traceId formatted as "trace:{id}" to KV.get', async () => {
      mockTraceKv(env, JSON.stringify({ traceEvents: [] }));

      const app = buildApp();
      await app.request(`/traces/${VALID_UUID}`, { headers: AUTH }, env);

      expect(env.CACHE.get).toHaveBeenCalledWith(`trace:${VALID_UUID}`);
    });

    it('returns 200 for a trace with empty traceEvents array', async () => {
      mockTraceKv(env, JSON.stringify({ traceEvents: [] }));

      const app = buildApp();
      const res = await app.request(`/traces/${VALID_UUID}`, { headers: AUTH }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as { traceEvents: unknown[] };
      expect(body.traceEvents).toEqual([]);
    });
  });

  describe('corrupt trace data (500)', () => {
    it('returns 500 when KV value is not valid JSON', async () => {
      mockTraceKv(env, 'this is not json {{{{');

      const app = buildApp();
      const res = await app.request(`/traces/${VALID_UUID}`, { headers: AUTH }, env);

      expect(res.status).toBe(500);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Corrupt trace data');
    });

    it('returns 500 when KV value is truncated JSON', async () => {
      mockTraceKv(env, '{"traceEvents":[{"name":"span"');

      const app = buildApp();
      const res = await app.request(`/traces/${VALID_UUID}`, { headers: AUTH }, env);

      expect(res.status).toBe(500);
    });
  });
});
