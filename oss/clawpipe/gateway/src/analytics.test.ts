/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';
import {
  handleOverview, handleProviders, handleCacheAnalytics,
  handleCostTrend, handleSavingsByTask, handleRouteAnalytics,
} from './analytics';
import type { Env } from './types';

vi.mock('./billing/usage', () => ({
  getProjectTier: vi.fn().mockResolvedValue('dev'),
  getDailyUsage: vi.fn().mockResolvedValue({ tokensIn: 0, tokensOut: 0, totalCalls: 12, limitCalls: 15_000, remaining: 14_988 }),
}));

interface OverviewRow {
  total_requests: number; total_tokens_in: number; total_tokens_out: number;
  total_cost: number; cached_count: number; boosted_count: number; avg_latency: number;
}

function makeDB(plan: { firstRow?: OverviewRow | null; rows?: object[] } = {}) {
  return {
    prepare: () => ({
      bind: () => ({
        first: async <T>(): Promise<T | null> => (plan.firstRow as unknown) as T | null,
        all: async () => ({ results: plan.rows ?? [] }),
      }),
    }),
  };
}

const mkEnv = (plan = {}) => ({ DB: makeDB(plan) as unknown as D1Database } as Env);

describe('handleOverview', () => {
  it('returns zeros + tier + dailyUsage when no requests', async () => {
    const env = mkEnv({ firstRow: null });
    const res = await handleOverview(env, 'p1');
    const body = await res.json() as Record<string, unknown>;
    expect(body.totalRequests).toBe(0);
    expect(body.cacheHitRate).toBe('0.0%');
    expect(body.boostRate).toBe('0.0%');
    expect(body.tier).toBe('dev');
    expect(body.dailyLimit).toBe(15_000);
  });

  it('computes hit rates and rounds cost to 4dp', async () => {
    const env = mkEnv({ firstRow: {
      total_requests: 100, total_tokens_in: 5000, total_tokens_out: 10000,
      total_cost: 0.123456789, cached_count: 35, boosted_count: 30, avg_latency: 250.7,
    } });
    const res = await handleOverview(env, 'p1');
    const body = await res.json() as Record<string, unknown>;
    expect(body.totalRequests).toBe(100);
    expect(body.cacheHitRate).toBe('35.0%');
    expect(body.boostRate).toBe('30.0%');
    expect(body.totalCost).toBe(0.1235);
    expect(body.avgLatencyMs).toBe(251);
  });
});

describe('handleProviders', () => {
  it('maps each row to camelCase fields', async () => {
    const env = mkEnv({ rows: [
      { provider: 'openai', model: 'gpt-4o', request_count: 50, total_cost: 1.234567, avg_latency: 800.4, total_tokens_out: 5000 },
      { provider: 'groq', model: 'llama', request_count: 200, total_cost: 0.001, avg_latency: 100, total_tokens_out: 9999 },
    ] });
    const res = await handleProviders(env, 'p1');
    const body = await res.json() as { providers: Array<Record<string, unknown>> };
    expect(body.providers).toHaveLength(2);
    expect(body.providers[0]).toMatchObject({
      provider: 'openai', model: 'gpt-4o', requestCount: 50,
      totalCost: 1.2346, avgLatencyMs: 800, totalTokensOut: 5000,
    });
  });

  it('returns empty providers list', async () => {
    const env = mkEnv({ rows: [] });
    const body = await (await handleProviders(env, 'p1')).json() as { providers: unknown[] };
    expect(body.providers).toEqual([]);
  });
});

describe('handleCacheAnalytics', () => {
  it('computes daily hitRate as cached+boosted / total', async () => {
    const env = mkEnv({ rows: [
      { day: '2026-04-29', total: 200, cached: 60, boosted: 40 },
    ] });
    const body = await (await handleCacheAnalytics(env, 'p1')).json() as { daily: Array<{ hitRate: string }> };
    expect(body.daily[0].hitRate).toBe('50.0%');
  });

  it('returns 0% when total is 0', async () => {
    const env = mkEnv({ rows: [{ day: '2026-04-29', total: 0, cached: 0, boosted: 0 }] });
    const body = await (await handleCacheAnalytics(env, 'p1')).json() as { daily: Array<{ hitRate: string }> };
    expect(body.daily[0].hitRate).toBe('0.0%');
  });
});

describe('handleCostTrend', () => {
  it('computes baseline and savings per day', async () => {
    const env = mkEnv({ rows: [
      { day: '2026-04-29', total: 100, cost: 1.0, cached: 50, boosted: 0, tokens: 1000 },
    ] });
    const body = await (await handleCostTrend(env, 'p1')).json() as { days: Array<{ baseline: number; saved: number }> };
    // baseline = 1.0 + (50 + 0) * 0.002 = 1.1; saved = 0.1
    expect(body.days[0].baseline).toBeCloseTo(1.1, 4);
    expect(body.days[0].saved).toBeCloseTo(0.1, 4);
  });
});

describe('handleSavingsByTask', () => {
  it('returns rounded cost + latency per bucket', async () => {
    const env = mkEnv({ rows: [
      { bucket: 'boosted', count: 30, cost: 0, avg_latency: 1.2 },
      { bucket: 'cached', count: 25, cost: 0.0001, avg_latency: 1.5 },
      { bucket: 'openai', count: 10, cost: 0.5, avg_latency: 700 },
    ] });
    const body = await (await handleSavingsByTask(env, 'p1')).json() as { buckets: Array<{ bucket: string; cost: number }> };
    expect(body.buckets).toHaveLength(3);
    expect(body.buckets.find((b) => b.bucket === 'boosted')?.cost).toBe(0);
  });
});

describe('handleRouteAnalytics', () => {
  it('maps each row + rounds latency', async () => {
    const env = mkEnv({ rows: [
      { provider: 'openai', model: 'gpt-4o', day: '2026-04-29', request_count: 10, avg_latency: 800.7 },
    ] });
    const body = await (await handleRouteAnalytics(env, 'p1')).json() as { routes: Array<{ avgLatencyMs: number }> };
    expect(body.routes[0].avgLatencyMs).toBe(801);
  });
});
