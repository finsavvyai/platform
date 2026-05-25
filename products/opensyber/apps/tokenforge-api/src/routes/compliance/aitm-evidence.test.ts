import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../../test/helpers.js';
import type { Env } from '../../types.js';

vi.mock('../../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb) }));
vi.mock('hono/logger', () => ({ logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../../middleware/tenant-auth.js', () => ({
  tenantAuth: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('tenantId', 't1'); c.set('tenantPlan', 'pro'); await next();
  },
}));
vi.mock('../../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../../middleware/guard.js', () => ({ guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));

import worker from '../../index.js';

async function api(method: string, path: string, env: Env): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost${path}`, { method, headers: { authorization: 'Bearer tf_test' } }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

let env: Env;
let db: ReturnType<typeof createMockDb>;
beforeEach(() => {
  vi.clearAllMocks();
  env = createMockEnv();
  db = createMockDb();
  (globalThis as Record<string, unknown>).__mockDb = db;
});

describe('GET /v1/compliance/aitm.csv', () => {
  it('returns text/csv content-type', async () => {
    const r = await api('GET', '/v1/compliance/aitm.csv', env);
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
  });

  it('emits Content-Disposition attachment with tenant-scoped filename', async () => {
    const r = await api('GET', '/v1/compliance/aitm.csv', env);
    const cd = r.headers.get('Content-Disposition');
    expect(cd).toMatch(/^attachment;\s*filename="aitm-evidence-t1-\d+\.csv"$/);
  });

  it('sets Cache-Control: no-store (auditor exports must not be cached)', async () => {
    const r = await api('GET', '/v1/compliance/aitm.csv', env);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns header-only CSV when DB has no events', async () => {
    db._setSelectResult([]);
    const r = await api('GET', '/v1/compliance/aitm.csv', env);
    const text = await r.text();
    const lines = text.trim().split('\n');
    expect(lines).toHaveLength(1); // header row only
    expect(lines[0]).toContain('event_id');
    expect(lines[0]).toContain('evidence_hash');
  });

  it('emits a data row per AitM-relevant event from DB', async () => {
    db._setSelectResult([
      {
        id: 'ev_1', tenantId: 't1', sessionId: 'ses_1', userId: 'u1',
        eventType: 'aitm.detected', trustScoreBefore: 80, trustScoreAfter: 30,
        ipAddress: '1.2.3.4', countryCode: 'US', userAgent: 'TestAgent',
        metadata: JSON.stringify({ signals: [{ kind: 'origin_mismatch' }], confidence: 'high' }),
        createdAt: '2026-05-04T12:00:00Z',
      },
    ]);
    const r = await api('GET', '/v1/compliance/aitm.csv', env);
    const text = await r.text();
    const lines = text.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('ev_1');
    expect(lines[1]).toContain('origin_mismatch');
    expect(lines[1]).toContain('high');
  });

  it('passes from + to query params through to the DB filter (date window)', async () => {
    db._setSelectResult([]);
    const r = await api('GET', '/v1/compliance/aitm.csv?from=2026-05-01&to=2026-05-04', env);
    expect(r.status).toBe(200);
    // The filter is composed inside the route; we cannot inspect Drizzle
    // internals from here, but the route should not error.
  });
});
