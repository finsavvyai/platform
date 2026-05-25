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
  tenantAuth: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('tenantId', 't1');
    c.set('tenantPlan', 'pro');
    await next();
  },
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

async function getOverview(env: Env): Promise<Response> {
  return worker.fetch(
    new Request('http://localhost/v1/analytics/overview', {
      headers: { authorization: 'Bearer tf_test' },
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

interface OverviewData {
  period: { start: string; end: string };
  usage: { current: number; previous: number; growthPercent: number; verifications: number; binds: number };
  sessions: { active: number; revoked: number; total: number };
  trustScore: { average: number };
  dailyUsage: Array<{ date: string; total: number }>;
}

describe('GET /v1/analytics/overview', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  const seed = (over: { current?: object; prev?: object; sessions?: object; avg?: number | null; daily?: unknown[] } = {}) =>
    db._setSelectResults([
      [{ verifications: 0, binds: 0, ...(over.current ?? {}) }],
      [{ verifications: 0, binds: 0, ...(over.prev ?? {}) }],
      [{ active: 0, revoked: 0, total: 0, ...(over.sessions ?? {}) }],
      [{ avg: over.avg === undefined ? 0 : over.avg }],
      over.daily ?? [],
    ]);

  it('returns the full overview shape on happy path', async () => {
    db._setSelectResults([
      [{ verifications: 600, binds: 200 }],   // current month
      [{ verifications: 400, binds: 100 }],   // previous month
      [{ active: 12, revoked: 3, total: 15 }], // session counts
      [{ avg: 87.6 }],                         // trust avg
      [                                        // daily usage rows
        { date: '2026-05-01', verifications: 50, binds: 10 },
        { date: '2026-05-02', verifications: 60, binds: 12 },
      ],
    ]);
    const res = await getOverview(env);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { data: OverviewData };
    expect(j.data.usage.current).toBe(800);
    expect(j.data.usage.previous).toBe(500);
    // (800 - 500) / 500 = 0.6 → 60
    expect(j.data.usage.growthPercent).toBe(60);
    expect(j.data.sessions).toEqual({ active: 12, revoked: 3, total: 15 });
    expect(j.data.trustScore.average).toBe(88);
    expect(j.data.dailyUsage).toHaveLength(2);
    expect(j.data.dailyUsage[0]).toEqual({ date: '2026-05-01', total: 60 });
    expect(j.data.dailyUsage[1]).toEqual({ date: '2026-05-02', total: 72 });
  });

  it('growthPercent rounds to nearest integer', async () => {
    seed({ current: { verifications: 113 }, prev: { verifications: 100 } });
    const j = (await (await getOverview(env)).json()) as { data: OverviewData };
    expect(j.data.usage.growthPercent).toBe(13);
  });

  it('growthPercent = 100 when previous is 0 and current > 0 (signals first-month users)', async () => {
    seed({ current: { verifications: 50 } });
    const j = (await (await getOverview(env)).json()) as { data: OverviewData };
    expect(j.data.usage.growthPercent).toBe(100);
  });

  it('growthPercent = 0 when both current and previous are 0', async () => {
    seed();
    const j = (await (await getOverview(env)).json()) as { data: OverviewData };
    expect(j.data.usage.growthPercent).toBe(0);
  });

  it('dailyUsage rows are mapped to {date, total} with verifications + binds summed', async () => {
    seed({ daily: [{ date: '2026-04-30', verifications: 100, binds: 50 }] });
    const j = (await (await getOverview(env)).json()) as { data: OverviewData };
    expect(j.data.dailyUsage[0]).toEqual({ date: '2026-04-30', total: 150 });
  });

  it('handles null verifications/binds in daily rows by treating as 0', async () => {
    seed({ daily: [{ date: '2026-04-29', verifications: null, binds: null }] });
    const j = (await (await getOverview(env)).json()) as { data: OverviewData };
    expect(j.data.dailyUsage[0]!.total).toBe(0);
  });

  it('period.start is YYYY-MM-01 and period.end is today YYYY-MM-DD', async () => {
    seed();
    const j = (await (await getOverview(env)).json()) as { data: OverviewData };
    expect(j.data.period.start).toMatch(/^\d{4}-\d{2}-01$/);
    expect(j.data.period.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(j.data.period.start <= j.data.period.end).toBe(true);
  });

  it('growthPercent is NEGATIVE when current < previous (declining usage signal)', async () => {
    seed({ current: { verifications: 50 }, prev: { verifications: 100 } });
    const j = (await (await getOverview(env)).json()) as { data: OverviewData };
    expect(j.data.usage.growthPercent).toBe(-50);
  });

  it('growthPercent rounds for negative ratios (current=83, prev=100 → -17)', async () => {
    seed({ current: { verifications: 83 }, prev: { verifications: 100 } });
    const j = (await (await getOverview(env)).json()) as { data: OverviewData };
    expect(j.data.usage.growthPercent).toBe(-17);
  });

  it('returns 200 with zeroed report when every select returns empty rows (degraded DB)', async () => {
    db._setSelectResults([[], [], [], [], []]);
    const res = await getOverview(env);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { data: OverviewData };
    expect(j.data.usage.current).toBe(0);
    expect(j.data.sessions).toEqual({ active: 0, revoked: 0, total: 0 });
    expect(j.data.trustScore.average).toBe(0);
    expect(j.data.dailyUsage).toEqual([]);
  });

  it('trustScore.average is 0 when SQL avg returns null (handles AVG over zero rows)', async () => {
    seed({ avg: null });
    const j = (await (await getOverview(env)).json()) as { data: OverviewData };
    expect(j.data.trustScore.average).toBe(0);
  });
});
