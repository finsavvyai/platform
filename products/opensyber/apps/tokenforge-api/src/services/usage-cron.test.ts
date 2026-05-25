import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb, createMockKV } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));

import { runUsageCron } from './usage-cron.js';

describe('Usage Cron', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let mockCache: KVNamespace;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockCache = createMockKV();
    (globalThis as Record<string, unknown>).__mockDb = mockDb;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('checks all tenants and returns result', async () => {
    mockDb._setSelectResults([
      // tenants list
      [{ id: 't1', name: 'Tenant 1', plan: 'free' }],
      // usage for t1
      [{ total: 500 }],
    ]);

    const result = await runUsageCron(
      mockDb as unknown as Parameters<typeof runUsageCron>[0],
      'resend_test',
      mockCache,
    );

    expect(result.tenantsChecked).toBe(1);
    expect(result.warningsSent).toBe(0);
  });

  it('sends warning when usage exceeds 80%', async () => {
    mockDb._setSelectResults([
      [{ id: 't1', name: 'Tenant 1', plan: 'free' }],
      [{ total: 850 }],
    ]);

    const result = await runUsageCron(
      mockDb as unknown as Parameters<typeof runUsageCron>[0],
      'resend_test',
      mockCache,
    );

    expect(result.tenantsChecked).toBe(1);
    expect(result.warningsSent).toBe(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('does not send duplicate warnings', async () => {
    // Simulate already-sent warning
    (mockCache.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce('1');

    mockDb._setSelectResults([
      [{ id: 't1', name: 'Tenant 1', plan: 'free' }],
      [{ total: 900 }],
    ]);

    const result = await runUsageCron(
      mockDb as unknown as Parameters<typeof runUsageCron>[0],
      'resend_test',
      mockCache,
    );

    expect(result.warningsSent).toBe(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('skips enterprise tenants (unlimited)', async () => {
    mockDb._setSelectResults([
      [{ id: 't1', name: 'Enterprise Co', plan: 'enterprise' }],
    ]);

    const result = await runUsageCron(
      mockDb as unknown as Parameters<typeof runUsageCron>[0],
      'resend_test',
      mockCache,
    );

    expect(result.tenantsChecked).toBe(1);
    expect(result.warningsSent).toBe(0);
  });

  it('handles multiple tenants', async () => {
    mockDb._setSelectResults([
      [
        { id: 't1', name: 'Tenant 1', plan: 'free' },
        { id: 't2', name: 'Tenant 2', plan: 'pro' },
      ],
      [{ total: 900 }],   // t1 at 90% of 1000
      [{ total: 10000 }], // t2 at 20% of 50000
    ]);

    const result = await runUsageCron(
      mockDb as unknown as Parameters<typeof runUsageCron>[0],
      'resend_test',
      mockCache,
    );

    expect(result.tenantsChecked).toBe(2);
    expect(result.warningsSent).toBe(1);
  });

  it('handles empty tenant list', async () => {
    mockDb._setSelectResult([]);

    const result = await runUsageCron(
      mockDb as unknown as Parameters<typeof runUsageCron>[0],
      'resend_test',
      mockCache,
    );

    expect(result.tenantsChecked).toBe(0);
    expect(result.warningsSent).toBe(0);
  });

  it('sends warning at exactly 80% boundary (>= threshold, not strict >)', async () => {
    // free plan limit = 1000 → 800 = exactly 80%
    mockDb._setSelectResults([
      [{ id: 't1', name: 'T1', plan: 'free' }],
      [{ total: 800 }],
    ]);
    const result = await runUsageCron(
      mockDb as unknown as Parameters<typeof runUsageCron>[0], 'resend_test', mockCache,
    );
    expect(result.warningsSent).toBe(1);
  });

  it('falls back to free-plan limit when tenant.plan is unknown', async () => {
    // Plan 'mystery' is not in PLAN_LIMITS — `?? PLAN_LIMITS['free']` kicks in.
    // 800 against the free 1000 limit = 80% → warning fires.
    mockDb._setSelectResults([
      [{ id: 't1', name: 'Mystery', plan: 'mystery' }],
      [{ total: 800 }],
    ]);
    const result = await runUsageCron(
      mockDb as unknown as Parameters<typeof runUsageCron>[0], 'resend_test', mockCache,
    );
    expect(result.warningsSent).toBe(1);
  });

  it('skips Resend HTTP call entirely when resendApiKey is empty (still increments warningsSent)', async () => {
    mockDb._setSelectResults([
      [{ id: 't1', name: 'T1', plan: 'free' }],
      [{ total: 850 }],
    ]);
    const result = await runUsageCron(
      mockDb as unknown as Parameters<typeof runUsageCron>[0], '', mockCache,
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result.warningsSent).toBe(1);
  });

  it('persists warning marker in KV with 30-day TTL after sending', async () => {
    mockDb._setSelectResults([
      [{ id: 't1', name: 'T1', plan: 'free' }],
      [{ total: 850 }],
    ]);
    await runUsageCron(
      mockDb as unknown as Parameters<typeof runUsageCron>[0], 'resend_test', mockCache,
    );
    const putSpy = mockCache.put as ReturnType<typeof vi.fn>;
    expect(putSpy).toHaveBeenCalledTimes(1);
    const [key, value, opts] = putSpy.mock.calls[0]!;
    expect(key).toMatch(/^usage-warning:t1:\d{4}-\d{2}-01$/);
    expect(value).toBe('1');
    expect(opts).toEqual({ expirationTtl: 30 * 86400 });
  });

  it('treats null SUM result as 0 usage (no warning, no fetch)', async () => {
    // Drizzle COALESCE returns 0 in SQL but a fresh tenant with no rows
    // could still produce { total: null } at the JS layer. The `?? 0`
    // fallback on line 56 prevents a NaN ratio.
    mockDb._setSelectResults([
      [{ id: 't1', name: 'T1', plan: 'free' }],
      [{ total: null }],
    ]);
    const result = await runUsageCron(
      mockDb as unknown as Parameters<typeof runUsageCron>[0], 'resend_test', mockCache,
    );
    expect(result.warningsSent).toBe(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
