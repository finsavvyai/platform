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

async function getReport(env: Env): Promise<Response> {
  return worker.fetch(
    new Request('http://localhost/v1/compliance/report', {
      headers: { authorization: 'Bearer tf_test' },
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

interface ReportData {
  period: { label: string; start: string; end: string };
  tenant: { name: string; plan: string };
  totalVerifications: number;
  threatsBlocked: { total: number; byType: Record<string, number> };
  averageTrustScore: number;
  activeSessions: number;
  deviceBindingCoverage: number;
  uptime: number;
  generatedAt: string;
}

describe('GET /v1/compliance/report', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns the full report shape on happy path', async () => {
    db._setSelectResults([
      [{ verifications: 800, binds: 200 }],          // usage
      [                                               // threats by type
        { eventType: 'hijack_attempt', count: 3 },
        { eventType: 'trust_drop', count: 7 },
      ],
      [{ count: 5, avgTrust: 92.4 }],                 // active sessions + avg
      [{ count: 50 }],                                // total sessions
      [{ name: 'Acme Corp' }],                        // tenant
    ]);
    const res = await getReport(env);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { data: ReportData };
    expect(j.data.tenant.name).toBe('Acme Corp');
    expect(j.data.tenant.plan).toBe('pro');
    expect(j.data.totalVerifications).toBe(1000);
    expect(j.data.threatsBlocked.total).toBe(10);
    expect(j.data.threatsBlocked.byType.hijack_attempt).toBe(3);
    expect(j.data.threatsBlocked.byType.trust_drop).toBe(7);
    expect(j.data.averageTrustScore).toBe(92);
    expect(j.data.activeSessions).toBe(5);
    expect(j.data.deviceBindingCoverage).toBe(100);
    expect(j.data.uptime).toBe(99.9);
    expect(typeof j.data.generatedAt).toBe('string');
  });

  it('totalVerifications sums verifications + binds', async () => {
    db._setSelectResults([
      [{ verifications: 333, binds: 167 }],
      [],
      [{ count: 0, avgTrust: 0 }],
      [{ count: 0 }],
      [{ name: 'X' }],
    ]);
    const j = (await (await getReport(env)).json()) as { data: ReportData };
    expect(j.data.totalVerifications).toBe(500);
  });

  it('threatsBlocked.total = sum of all threat counts; byType keyed by eventType', async () => {
    db._setSelectResults([
      [{ verifications: 0, binds: 0 }],
      [
        { eventType: 'hijack_attempt', count: 1 },
        { eventType: 'trust_drop', count: 4 },
        { eventType: 'session_revoked', count: 2 },
      ],
      [{ count: 0, avgTrust: 0 }],
      [{ count: 0 }],
      [{ name: 'Y' }],
    ]);
    const j = (await (await getReport(env)).json()) as { data: ReportData };
    expect(j.data.threatsBlocked.total).toBe(7);
    expect(Object.keys(j.data.threatsBlocked.byType).sort())
      .toEqual(['hijack_attempt', 'session_revoked', 'trust_drop']);
  });

  it('averageTrustScore rounds the SQL avg to nearest integer', async () => {
    db._setSelectResults([
      [{ verifications: 0, binds: 0 }],
      [],
      [{ count: 1, avgTrust: 87.49 }],
      [{ count: 1 }],
      [{ name: 'Z' }],
    ]);
    const j = (await (await getReport(env)).json()) as { data: ReportData };
    expect(j.data.averageTrustScore).toBe(87);
  });

  it('deviceBindingCoverage is 0 when there are zero total sessions', async () => {
    db._setSelectResults([
      [{ verifications: 0, binds: 0 }],
      [],
      [{ count: 0, avgTrust: 0 }],
      [{ count: 0 }],
      [{ name: 'New Tenant' }],
    ]);
    const j = (await (await getReport(env)).json()) as { data: ReportData };
    expect(j.data.deviceBindingCoverage).toBe(0);
  });

  it('falls back to tenant name "Unknown" when the tenant row is missing', async () => {
    db._setSelectResults([
      [{ verifications: 0, binds: 0 }],
      [],
      [{ count: 0, avgTrust: 0 }],
      [{ count: 0 }],
      [], // no tenant row
    ]);
    const j = (await (await getReport(env)).json()) as { data: ReportData };
    expect(j.data.tenant.name).toBe('Unknown');
  });

  it('period label is "<Month> <Year>" with start and end ISO date strings', async () => {
    db._setSelectResults([
      [{ verifications: 0, binds: 0 }],
      [],
      [{ count: 0, avgTrust: 0 }],
      [{ count: 0 }],
      [{ name: 'X' }],
    ]);
    const j = (await (await getReport(env)).json()) as { data: ReportData };
    expect(j.data.period.label).toMatch(/^[A-Z][a-z]+ \d{4}$/);
    // start is the 1st of the month: YYYY-MM-01
    expect(j.data.period.start).toMatch(/^\d{4}-\d{2}-01$/);
    // end is the 1st of the next month: YYYY-MM-DD
    expect(j.data.period.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
