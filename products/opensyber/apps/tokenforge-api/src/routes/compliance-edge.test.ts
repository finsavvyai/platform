/**
 * Edge-case coverage for GET /v1/compliance/report.
 * Sibling of compliance.test.ts so the original stays focused on the
 * happy-path field shape; this pins resilience + invariant behaviors.
 */

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
    c.set('tenantId', 't1'); c.set('tenantPlan', 'pro'); await next();
  },
}));
vi.mock('../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/guard.js', () => ({ guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));

import worker from '../index.js';

interface ReportData {
  period: { label: string; start: string; end: string };
  totalVerifications: number;
  threatsBlocked: { total: number; byType: Record<string, number> };
  averageTrustScore: number;
  activeSessions: number;
  deviceBindingCoverage: number;
  generatedAt: string;
}

async function getReport(env: Env): Promise<ReportData> {
  const res = await worker.fetch(
    new Request('http://localhost/v1/compliance/report', {
      headers: { authorization: 'Bearer tf_test' },
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
  return ((await res.json()) as { data: ReportData }).data;
}

const baseRows = (
  over: { usage?: object; threats?: unknown[]; active?: object; total?: object; tenant?: unknown[] } = {},
): unknown[][] => [
  [{ verifications: 0, binds: 0, ...(over.usage ?? {}) }],
  over.threats ?? [],
  [{ count: 0, avgTrust: 0, ...(over.active ?? {}) }],
  [{ count: 0, ...(over.total ?? {}) }],
  over.tenant ?? [{ name: 'X' }],
];

describe('GET /v1/compliance/report — edge cases', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns valid 200 with all-zero report when every select returns []', async () => {
    db._setSelectResults([[], [], [], [], []]);
    const res = await worker.fetch(
      new Request('http://localhost/v1/compliance/report', { headers: { authorization: 'Bearer tf_test' } }),
      env,
      { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
    );
    expect(res.status).toBe(200);
    const data = ((await res.json()) as { data: ReportData }).data;
    expect(data.totalVerifications).toBe(0);
    expect(data.threatsBlocked.total).toBe(0);
    expect(data.activeSessions).toBe(0);
    expect(data.averageTrustScore).toBe(0);
    expect(data.deviceBindingCoverage).toBe(0);
  });

  it('averageTrustScore = 0 when SQL avgTrust returns null (Math.round(null ?? 0))', async () => {
    db._setSelectResults(baseRows({ active: { count: 1, avgTrust: null } }));
    const data = await getReport(env);
    expect(data.averageTrustScore).toBe(0);
  });

  it('period.end is YYYY-MM-01 of the NEXT month (UTC-anchored, no TZ drift)', async () => {
    db._setSelectResults(baseRows());
    const data = await getReport(env);
    // UTC-anchored compute means end is always the FIRST day of next month
    // (regardless of test runner TZ). SQL boundary `< monthEnd` then correctly
    // excludes only next-month rows — last day of current month is INCLUDED.
    expect(data.period.end).toMatch(/^\d{4}-\d{2}-01$/);
    expect(Date.parse(data.period.end)).toBeGreaterThan(Date.parse(data.period.start));
  });

  it('generatedAt parses as ISO and is within 5 seconds of "now"', async () => {
    db._setSelectResults(baseRows());
    const before = Date.now();
    const data = await getReport(env);
    const ts = Date.parse(data.generatedAt);
    expect(Number.isFinite(ts)).toBe(true);
    expect(Math.abs(ts - before)).toBeLessThan(5000);
  });

  it('threatsBlocked.byType passes through all 5 documented THREAT_TYPES', async () => {
    // The internal THREAT_TYPES catalog at compliance.ts:16-22 lists these
    // 5 categories. The route doesn't filter — any eventType from the DB
    // flows into byType — so this pins the documented contract that those
    // categories ARE supported (a regression that filters/normalizes
    // would silently drop one of them from the report).
    const types = ['hijack_attempt', 'trust_drop', 'ip_change', 'geo_anomaly', 'session_revoked'];
    db._setSelectResults(baseRows({
      threats: types.map((eventType, i) => ({ eventType, count: i + 1 })),
    }));
    const data = await getReport(env);
    expect(data.threatsBlocked.total).toBe(1 + 2 + 3 + 4 + 5);
    for (const t of types) expect(data.threatsBlocked.byType[t]).toBeGreaterThan(0);
  });
});
