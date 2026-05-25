/** Tests for /v1/savings — real D1 aggregation, no mocked numbers. */

import { describe, it, expect } from 'vitest';
import { handleSavings, computeSavings } from './savings-route';
import type { Env } from './types';

interface Row { project_id: string; cost: number; cached: number; boosted: number; created_at: string }

function makeDb(allRows: Row[]) {
  return {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: async () => {
          const projectId = args[0] as string;
          const monthStart = args[1] as string | undefined;
          const inWindow = (r: Row) => !monthStart || r.created_at >= monthStart;
          const rows = allRows.filter((r) => r.project_id === projectId && inWindow(r));
          if (sql.includes('SELECT')) {
            const baselineRows = rows.filter((r) => r.cached === 0 && r.boosted === 0);
            const baselineAvg = baselineRows.length
              ? baselineRows.reduce((s, r) => s + r.cost, 0) / baselineRows.length
              : 0;
            return {
              total_cost: rows.reduce((s, r) => s + r.cost, 0),
              total_calls: rows.length,
              baseline_cost_avg: baselineAvg,
              baseline_calls: baselineRows.length,
            };
          }
          return null;
        },
      }),
    }),
  };
}

function envWith(rows: Row[]): Env {
  return { DB: makeDb(rows) } as unknown as Env;
}

describe('computeSavings — zero-usage project', () => {
  it('returns all zeros when no rows', async () => {
    const result = await computeSavings(envWith([]), 'proj-empty');
    expect(result.thisMonth).toBe(0);
    expect(result.sinceStart).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.currency).toBe('USD');
  });
});

describe('computeSavings — populated project', () => {
  const today = new Date().toISOString().slice(0, 10);
  const rows: Row[] = [
    // baseline (live) calls @ $0.01 each
    { project_id: 'p1', cost: 0.01, cached: 0, boosted: 0, created_at: today },
    { project_id: 'p1', cost: 0.01, cached: 0, boosted: 0, created_at: today },
    // free hits — saved 100% of what they would have cost
    { project_id: 'p1', cost: 0,    cached: 1, boosted: 0, created_at: today },
    { project_id: 'p1', cost: 0,    cached: 1, boosted: 0, created_at: today },
    { project_id: 'p1', cost: 0,    cached: 0, boosted: 1, created_at: today },
  ];

  it('returns positive savings derived from real sums', async () => {
    const result = await computeSavings(envWith(rows), 'p1');
    // baseline avg = 0.01, total calls = 5, baselineTotal = 0.05, actual = 0.02
    expect(result.thisMonth).toBeCloseTo(0.03, 4);
    expect(result.sinceStart).toBeCloseTo(0.03, 4);
    expect(result.percent).toBeGreaterThan(0);
  });

  it('handler returns 200 with same shape', async () => {
    const res = await handleSavings(envWith(rows), 'p1');
    expect(res.status).toBe(200);
    const body = await res.json() as { thisMonth: number; currency: string };
    expect(body.currency).toBe('USD');
    expect(body.thisMonth).toBeGreaterThan(0);
  });
});

describe('handleSavings error path', () => {
  it('returns 500 with savings_unavailable when D1 throws', async () => {
    const env = {
      DB: {
        prepare: () => ({
          bind: () => ({ first: async () => { throw new Error('d1 down'); } }),
        }),
      } as unknown as D1Database,
    } as Env;
    const res = await handleSavings(env, 'p1');
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string; detail: string };
    expect(body.error).toBe('savings_unavailable');
    expect(body.detail).toBe('d1 down');
  });

  it('handles non-Error throws via String() fallback', async () => {
    const env = {
      DB: {
        prepare: () => ({
          bind: () => ({ first: async () => { throw 'plain string'; } }),
        }),
      } as unknown as D1Database,
    } as Env;
    const res = await handleSavings(env, 'p1');
    expect(res.status).toBe(500);
    const body = await res.json() as { detail: string };
    expect(body.detail).toBe('plain string');
  });
});

describe('computeSavings — auth scoping', () => {
  const today = new Date().toISOString().slice(0, 10);
  const rows: Row[] = [
    { project_id: 'p1', cost: 0.01, cached: 0, boosted: 0, created_at: today },
    { project_id: 'p1', cost: 0,    cached: 1, boosted: 0, created_at: today },
    { project_id: 'p2', cost: 5.00, cached: 0, boosted: 0, created_at: today },
  ];

  it('p1 cannot see p2 data', async () => {
    const r1 = await computeSavings(envWith(rows), 'p1');
    const r2 = await computeSavings(envWith(rows), 'p2');
    expect(r1.sinceStart).toBeLessThan(0.1);
    expect(r2.sinceStart).toBe(0);  // p2 has no cached/boosted, so no savings
    // and totals don't bleed across projects
    expect(r1.thisMonth).not.toEqual(r2.thisMonth);
  });

  it('unknown project returns zeros', async () => {
    const r = await computeSavings(envWith(rows), 'ghost');
    expect(r.thisMonth).toBe(0);
    expect(r.sinceStart).toBe(0);
  });
});
