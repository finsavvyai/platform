import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));
vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/tenant-auth.js', () => ({
  tenantAuth: async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/guard.js', () => ({
  guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));

import worker from '../index.js';

async function getTrust(tenantId: string, env: Env): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost/public/trust/${tenantId}`),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

describe('GET /public/trust/:tenantId', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns 404 not_found when tenant does not exist', async () => {
    db._setSelectResult([]);
    const res = await getTrust('tf_missing', env);
    expect(res.status).toBe(404);
    expect((await res.json() as { error: string }).error).toBe('not_found');
  });

  it('returns the public trust stats joined from 5 sequential selects on happy path', async () => {
    db._setSelectResults([
      [{ id: 'tf_acme', name: 'Acme Corp', plan: 'pro' }],         // tenant
      [{ totalVerifications: 1000, totalBinds: 50 }],              // usage
      [{ count: 12 }],                                              // active sessions
      [{ avg: 87.6 }],                                              // trust avg
      [{ ts: '2026-05-04T08:00:00Z' }],                             // last verified
    ]);
    const res = await getTrust('tf_acme', env);
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      data: {
        name: string; plan: string; totalVerifications: number;
        threatsBlocked: number; averageTrustScore: number;
        activeSessions: number; lastVerifiedAt: string | null;
      };
    };
    expect(j.data.name).toBe('Acme Corp');
    expect(j.data.plan).toBe('pro');
    expect(j.data.totalVerifications).toBe(1050); // verifications + binds
    expect(j.data.activeSessions).toBe(12);
    expect(j.data.lastVerifiedAt).toBe('2026-05-04T08:00:00Z');
  });

  it('threatsBlocked = floor(totalVerifications * 0.02)', async () => {
    db._setSelectResults([
      [{ id: 'tf_x', name: 'X', plan: 'free' }],
      [{ totalVerifications: 1000, totalBinds: 0 }],
      [{ count: 0 }],
      [{ avg: 0 }],
      [],
    ]);
    const res = await getTrust('tf_x', env);
    const j = (await res.json()) as { data: { threatsBlocked: number } };
    // 1000 * 0.02 = 20
    expect(j.data.threatsBlocked).toBe(20);
  });

  it('averageTrustScore is rounded to nearest integer', async () => {
    db._setSelectResults([
      [{ id: 'tf_x', name: 'X', plan: 'free' }],
      [{ totalVerifications: 0, totalBinds: 0 }],
      [{ count: 0 }],
      [{ avg: 87.6 }],
      [],
    ]);
    const res = await getTrust('tf_x', env);
    const j = (await res.json()) as { data: { averageTrustScore: number } };
    expect(j.data.averageTrustScore).toBe(88); // Math.round(87.6) = 88
  });

  it('lastVerifiedAt is null when there are no sessions yet', async () => {
    db._setSelectResults([
      [{ id: 'tf_new', name: 'New', plan: 'free' }],
      [{ totalVerifications: 0, totalBinds: 0 }],
      [{ count: 0 }],
      [{ avg: 0 }],
      [],
    ]);
    const res = await getTrust('tf_new', env);
    const j = (await res.json()) as { data: { lastVerifiedAt: string | null } };
    expect(j.data.lastVerifiedAt).toBeNull();
  });

  it('handles missing usage rows by treating them as zero (COALESCE-style fallback)', async () => {
    db._setSelectResults([
      [{ id: 'tf_zero', name: 'Zero Co', plan: 'free' }],
      [], // no usage row at all
      [{ count: 0 }],
      [{ avg: 0 }],
      [],
    ]);
    const res = await getTrust('tf_zero', env);
    const j = (await res.json()) as {
      data: { totalVerifications: number; threatsBlocked: number; averageTrustScore: number };
    };
    expect(j.data.totalVerifications).toBe(0);
    expect(j.data.threatsBlocked).toBe(0);
    expect(j.data.averageTrustScore).toBe(0);
  });
});
