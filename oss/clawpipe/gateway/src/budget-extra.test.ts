/** @vitest-environment node */
/** Extra coverage for budget.ts beyond the threshold-tracking tests in budget.test.ts. */

import { describe, it, expect } from 'vitest';
import {
  getMonthToDateSpend, getBudgetStatus, getTeamBudgetStatus, getProjectTeamId,
  getTeamRateLimit, recordFiredThresholds,
} from './budget';
import type { Env } from './types';

interface DBState {
  spend?: number;
  budgetCap?: number | null;
  teamCap?: number | null;
  teamId?: string | null;
  teamSpend?: number;
  rateLimit?: number | null;
  todayCalls?: number;
  storedFired?: string | null;
  updates: Array<{ sql: string; binds: unknown[] }>;
}

function makeDB(s: DBState) {
  return {
    prepare: (sql: string) => ({
      bind: (...binds: unknown[]) => ({
        first: async <T>(): Promise<T | null> => {
          if (sql.includes('SUM(r.cost)') && sql.includes('start of month')) {
            return ({ cost: s.teamSpend ?? 0 } as unknown) as T;
          }
          if (sql.includes('SUM(cost)') && sql.includes('start of month')) {
            return ({ cost: s.spend ?? 0 } as unknown) as T;
          }
          if (sql.includes('monthly_budget_usd FROM projects')) {
            return ({ monthly_budget_usd: s.budgetCap ?? null } as unknown) as T;
          }
          if (sql.includes('budget_usd FROM teams')) {
            return ({ budget_usd: s.teamCap ?? null } as unknown) as T;
          }
          if (sql.includes('team_id FROM projects')) {
            return ({ team_id: s.teamId ?? null } as unknown) as T;
          }
          if (sql.includes('rate_limit_per_day FROM teams')) {
            return ({ rate_limit_per_day: s.rateLimit ?? null } as unknown) as T;
          }
          if (sql.includes('COUNT(*) as n FROM requests')) {
            return ({ n: s.todayCalls ?? 0 } as unknown) as T;
          }
          if (sql.includes('threshold_alerts_fired FROM projects')) {
            return ({ threshold_alerts_fired: s.storedFired ?? null } as unknown) as T;
          }
          return null;
        },
        run: async () => {
          if (sql.startsWith('UPDATE')) s.updates.push({ sql, binds });
          return { success: true };
        },
      }),
    }),
  };
}

function mkEnv(s: Partial<DBState> = {}): Env {
  const state: DBState = { updates: [], ...s };
  return { DB: makeDB(state) as unknown as D1Database } as Env;
}

describe('getMonthToDateSpend', () => {
  it('returns the SUM(cost) row', async () => {
    const env = mkEnv({ spend: 12.34 });
    expect(await getMonthToDateSpend(env, 'p1')).toBe(12.34);
  });
  it('returns 0 when no rows', async () => {
    const env = mkEnv({});
    expect(await getMonthToDateSpend(env, 'p1')).toBe(0);
  });
});

describe('getBudgetStatus', () => {
  it('reports usedMtd + pct + over=false when under cap', async () => {
    const env = mkEnv({ budgetCap: 100, spend: 25 });
    const s = await getBudgetStatus(env, 'p1');
    expect(s.monthlyCap).toBe(100);
    expect(s.usedMtd).toBe(25);
    expect(s.pct).toBe(25);
    expect(s.over).toBe(false);
  });
  it('over=true when spend reaches cap', async () => {
    const env = mkEnv({ budgetCap: 100, spend: 100 });
    expect((await getBudgetStatus(env, 'p1')).over).toBe(true);
  });
  it('pct=0 when no cap configured', async () => {
    const env = mkEnv({ budgetCap: null, spend: 50 });
    const s = await getBudgetStatus(env, 'p1');
    expect(s.monthlyCap).toBeNull();
    expect(s.pct).toBe(0);
    expect(s.over).toBe(false);
  });
});

describe('getTeamBudgetStatus', () => {
  it('joins requests + projects to compute team-wide spend', async () => {
    const env = mkEnv({ teamCap: 200, teamSpend: 80 });
    const s = await getTeamBudgetStatus(env, 't1');
    expect(s.monthlyCap).toBe(200);
    expect(s.usedMtd).toBe(80);
    expect(s.pct).toBe(40);
    expect(s.over).toBe(false);
  });
  it('over=true at cap', async () => {
    const env = mkEnv({ teamCap: 50, teamSpend: 50 });
    expect((await getTeamBudgetStatus(env, 't1')).over).toBe(true);
  });
});

describe('getProjectTeamId', () => {
  it('returns the team id', async () => {
    const env = mkEnv({ teamId: 'team-7' });
    expect(await getProjectTeamId(env, 'p1')).toBe('team-7');
  });
  it('returns null when project not in a team', async () => {
    const env = mkEnv({ teamId: null });
    expect(await getProjectTeamId(env, 'p1')).toBeNull();
  });
});

describe('getTeamRateLimit', () => {
  it('reports usedToday vs perDay', async () => {
    const env = mkEnv({ rateLimit: 1000, todayCalls: 250 });
    const r = await getTeamRateLimit(env, 't1');
    expect(r.perDay).toBe(1000);
    expect(r.usedToday).toBe(250);
    expect(r.over).toBe(false);
  });
  it('over=true when calls reach the cap', async () => {
    const env = mkEnv({ rateLimit: 100, todayCalls: 100 });
    expect((await getTeamRateLimit(env, 't1')).over).toBe(true);
  });
  it('over=false when no cap configured', async () => {
    const env = mkEnv({ rateLimit: null, todayCalls: 9_999_999 });
    expect((await getTeamRateLimit(env, 't1')).over).toBe(false);
  });
});

describe('recordFiredThresholds', () => {
  it('initializes an empty record + writes new month entry', async () => {
    const state: DBState = { updates: [], storedFired: null };
    const env = { DB: makeDB(state) as unknown as D1Database } as Env;
    await recordFiredThresholds(env, 'p1', [50]);
    expect(state.updates).toHaveLength(1);
    const json = state.updates[0].binds[0] as string;
    const parsed = JSON.parse(json) as Record<string, number[]>;
    const month = Object.keys(parsed)[0];
    expect(parsed[month]).toContain(50);
  });

  it('merges with existing thresholds without duplicating', async () => {
    const month = new Date().toISOString().slice(0, 7);
    const state: DBState = {
      updates: [],
      storedFired: JSON.stringify({ [month]: [50] }),
    };
    const env = { DB: makeDB(state) as unknown as D1Database } as Env;
    await recordFiredThresholds(env, 'p1', [50, 80]);
    const json = state.updates[0].binds[0] as string;
    const parsed = JSON.parse(json) as Record<string, number[]>;
    expect(parsed[month].sort((a, b) => a - b)).toEqual([50, 80]);
  });
});
