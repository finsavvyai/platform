import { describe, it, expect, vi } from 'vitest';
import { enterpriseApi, type DoraMetrics, type IdentityStatus } from './useEnterprise';

function mockFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe('enterpriseApi.getDora', () => {
  it('returns typed DORA metrics on 200', async () => {
    const payload: DoraMetrics = {
      window_days: 30,
      deploy_count: 4,
      deploy_frequency_per_day: 0.13,
      lead_time_ms_p50: 120_000,
      mttr_ms_p50: null,
      change_failure_rate: 0.25,
      computed_at: '2026-04-17T00:00:00.000Z',
    };
    const result = await enterpriseApi.getDora(mockFetch(payload));
    expect(result).toEqual(payload);
  });

  it('throws on non-2xx', async () => {
    await expect(
      enterpriseApi.getDora(mockFetch({ error: 'unauthorized' }, 401)),
    ).rejects.toThrow(/API 401/);
  });
});

describe('enterpriseApi.getIdentityStatus', () => {
  it('reports unconfigured identity without inventing fields', async () => {
    const payload: IdentityStatus = {
      sso: { configured: false, provider: null, tenant: null, updated_at: null },
      scim: { configured: false, tenant: null },
      checked_at: '2026-04-17T00:00:00.000Z',
    };
    const result = await enterpriseApi.getIdentityStatus(mockFetch(payload));
    expect(result.sso.configured).toBe(false);
    expect(result.scim.configured).toBe(false);
  });
});

describe('enterpriseApi.getRecentAudit', () => {
  it('unwraps the logs array', async () => {
    const result = await enterpriseApi.getRecentAudit(
      5,
      mockFetch({ logs: [{ id: 1, action: 'project.created' }], total: 1 }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('project.created');
  });

  it('returns [] when server omits logs key', async () => {
    const result = await enterpriseApi.getRecentAudit(5, mockFetch({ total: 0 }));
    expect(result).toEqual([]);
  });
});
