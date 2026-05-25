/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  getAnomalyStatus,
  recordFiredToday,
} from './anomaly';
import type { Env } from './types';

function makeDB(todayCost: number, trailingCost: number) {
  let updateCaptured: { json: string; projectId: string } | null = null;

  return {
    prepare: (sql: string) => ({
      bind: (..._binds: unknown[]) => ({
        first: async <T>(): Promise<T> => {
          // Today query has "= date('now')" (no '-30 days'), trailing has '-30 days'
          const cost = sql.includes('-30 days') ? trailingCost : todayCost;
          return { cost } as T;
        },
        run: async () => {
          updateCaptured = { json: _binds[0] as string, projectId: _binds[1] as string };
          return { success: true };
        },
      }),
    }),
    _getUpdateCapture: () => updateCaptured,
  };
}

function makeEnv(todayCost: number, trailingCost: number): Env {
  return {
    DB: makeDB(todayCost, trailingCost) as unknown as D1Database,
    CACHE: {} as KVNamespace,
    ENVIRONMENT: 'test',
  } as unknown as Env;
}

describe('getAnomalyStatus', () => {
  it('returns alert=false when avg30d is zero', async () => {
    const status = await getAnomalyStatus(makeEnv(100, 0), 'proj1');
    expect(status.alert).toBe(false);
    expect(status.multiplier).toBe(0);
    expect(status.avg30dUsd).toBe(0);
  });

  it('returns alert=true when spend exceeds threshold', async () => {
    // trailing=300 over 30 days => avg=10/day; today=25 >= threshold 2 * 10
    const status = await getAnomalyStatus(makeEnv(25, 300), 'proj1');
    expect(status.avg30dUsd).toBeCloseTo(10, 2);
    expect(status.multiplier).toBeGreaterThanOrEqual(2);
    expect(status.alert).toBe(true);
  });

  it('returns alert=false when today spend is below MIN_DAILY_FLOOR ($1)', async () => {
    // avg=10/day, today=0.50 (below $1 floor)
    const status = await getAnomalyStatus(makeEnv(0.5, 300), 'proj1');
    expect(status.alert).toBe(false);
  });

  it('rounds to 4 decimal places', async () => {
    const status = await getAnomalyStatus(makeEnv(1.23456789, 0), 'proj1');
    expect(status.todayUsd).toBe(1.2346);
  });

  it('uses custom threshold multiplier', async () => {
    // trailing=300 over 30 days => avg=10/day; today=15 => multiplier=1.5
    // with threshold=1.5 -> should alert
    const status = await getAnomalyStatus(makeEnv(15, 300), 'proj1', 1.5);
    expect(status.threshold).toBe(1.5);
    expect(status.alert).toBe(true);
  });

  it('returns alert=false when multiplier is just below threshold', async () => {
    // avg=10, today=19 => multiplier=1.9 < 2.0 threshold
    const status = await getAnomalyStatus(makeEnv(19, 300), 'proj1');
    expect(status.alert).toBe(false);
  });
});

describe('recordFiredToday', () => {
  it('adds today to fired list', async () => {
    const db = makeDB(0, 0);
    const env = { DB: db as unknown as D1Database, CACHE: {} as KVNamespace, ENVIRONMENT: 'test' } as unknown as Env;
    const today = new Date().toISOString().slice(0, 10);
    await recordFiredToday(env, 'p1', []);
    const cap = db._getUpdateCapture();
    expect(cap).not.toBeNull();
    const parsed = JSON.parse(cap!.json) as string[];
    expect(parsed).toContain(today);
    expect(cap!.projectId).toBe('p1');
  });

  it('deduplicates today if already present', async () => {
    const db = makeDB(0, 0);
    const env = { DB: db as unknown as D1Database, CACHE: {} as KVNamespace, ENVIRONMENT: 'test' } as unknown as Env;
    const today = new Date().toISOString().slice(0, 10);
    await recordFiredToday(env, 'p1', [today, today]);
    const cap = db._getUpdateCapture();
    const parsed = JSON.parse(cap!.json) as string[];
    expect(parsed.filter((d) => d === today)).toHaveLength(1);
  });

  it('keeps at most last 60 dates', async () => {
    const db = makeDB(0, 0);
    const env = { DB: db as unknown as D1Database, CACHE: {} as KVNamespace, ENVIRONMENT: 'test' } as unknown as Env;
    const existing = Array.from({ length: 61 }, (_, i) => `2024-01-${String(i + 1).padStart(2, '0')}`);
    await recordFiredToday(env, 'p1', existing.slice(0, 60));
    const cap = db._getUpdateCapture();
    const parsed = JSON.parse(cap!.json) as string[];
    expect(parsed.length).toBeLessThanOrEqual(60);
  });
});
