/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleFinopsOverview } from './finops-overview';
import type { Env } from './types';

vi.mock('./auth/rbac', () => ({ getAuthUser: vi.fn() }));
vi.mock('./budget-forecast', () => ({
  utcDaysElapsed: vi.fn(() => 15),
  daysInUtcMonth: vi.fn(() => 30),
}));

import { getAuthUser } from './auth/rbac';

interface DBState {
  projectRows?: Array<{
    id: string; name: string; role: string;
    team_id: string | null; team_name: string | null;
    monthly_budget_usd: number | null; team_budget_usd: number | null;
  }>;
  spendRows?: Array<{ project_id: string; cost: number }>;
}

function makeDB(state: DBState) {
  return {
    prepare: (sql: string) => ({
      bind: () => ({
        all: async () => {
          if (sql.includes('FROM project_members')) return { results: state.projectRows ?? [] };
          if (sql.includes('FROM requests')) return { results: state.spendRows ?? [] };
          return { results: [] };
        },
      }),
    }),
  };
}

const mkEnv = (state: DBState = {}): Env => ({ DB: makeDB(state) as unknown as D1Database } as Env);
const authedUser = { sub: 'u1', email: 'a@b.test', iat: 0, exp: 0 };

beforeEach(() => { vi.mocked(getAuthUser).mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe('handleFinopsOverview', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const res = await handleFinopsOverview(new Request('https://x.test/'), mkEnv());
    expect(res.status).toBe(401);
  });

  it('returns empty totals when user has no projects', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    const env = mkEnv({ projectRows: [] });
    const res = await handleFinopsOverview(new Request('https://x.test/'), env);
    const body = await res.json() as { totals: { projects: number; usedMtd: number } };
    expect(body.totals.projects).toBe(0);
    expect(body.totals.usedMtd).toBe(0);
  });

  it('returns one row per project with budget pct + over flag', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    const env = mkEnv({
      projectRows: [
        { id: 'p1', name: 'Alpha', role: 'owner', team_id: null, team_name: null, monthly_budget_usd: 100, team_budget_usd: null },
        { id: 'p2', name: 'Beta',  role: 'member', team_id: 't1', team_name: 'TeamX', monthly_budget_usd: 50, team_budget_usd: 200 },
      ],
      spendRows: [
        { project_id: 'p1', cost: 25 },
        { project_id: 'p2', cost: 50 },
      ],
    });
    const body = await (await handleFinopsOverview(new Request('https://x.test/'), env)).json() as {
      totals: { projects: number; cappedProjects: number; overBudget: number; usedMtd: number };
      projects: Array<{ id: string; budget: { pct: number; over: boolean }; team: unknown }>;
    };
    expect(body.totals.projects).toBe(2);
    expect(body.totals.cappedProjects).toBe(2);
    expect(body.totals.overBudget).toBe(1);
    expect(body.totals.usedMtd).toBe(75);
    const p1 = body.projects.find((p) => p.id === 'p1')!;
    const p2 = body.projects.find((p) => p.id === 'p2')!;
    expect(p1.budget.pct).toBe(25);
    expect(p1.budget.over).toBe(false);
    expect(p2.budget.pct).toBe(100);
    expect(p2.budget.over).toBe(true);
    expect(p2.team).toMatchObject({ id: 't1', name: 'TeamX', monthlyCap: 200 });
    expect(p1.team).toBeNull();
  });

  it('returns 0% pct when no budget cap', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    const env = mkEnv({
      projectRows: [{ id: 'p1', name: 'Alpha', role: 'owner', team_id: null, team_name: null, monthly_budget_usd: null, team_budget_usd: null }],
      spendRows: [{ project_id: 'p1', cost: 10 }],
    });
    const body = await (await handleFinopsOverview(new Request('https://x.test/'), env)).json() as {
      projects: Array<{ budget: { pct: number; over: boolean } }>;
    };
    expect(body.projects[0].budget.pct).toBe(0);
    expect(body.projects[0].budget.over).toBe(false);
  });

  it('includes forecastEomUsd in each project row (day 15 of 30 with $150 MTD → $300 forecast)', async () => {
    // budget-forecast module is mocked: daysElapsed=15, totalDays=30
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    const env = mkEnv({
      projectRows: [
        { id: 'p1', name: 'Alpha', role: 'owner', team_id: null, team_name: null, monthly_budget_usd: 400, team_budget_usd: null },
      ],
      spendRows: [{ project_id: 'p1', cost: 150 }],
    });
    const body = await (await handleFinopsOverview(new Request('https://x.test/'), env)).json() as {
      projects: Array<{ budget: { forecastEomUsd: number; pctOfCapForecast: number } }>;
    };
    // 150 / 15 * 30 = 300
    expect(body.projects[0].budget.forecastEomUsd).toBe(300);
    // 300 / 400 * 100 = 75%
    expect(body.projects[0].budget.pctOfCapForecast).toBe(75);
  });

  it('pctOfCapForecast is 0 when no cap is set', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    const env = mkEnv({
      projectRows: [
        { id: 'p1', name: 'Alpha', role: 'owner', team_id: null, team_name: null, monthly_budget_usd: null, team_budget_usd: null },
      ],
      spendRows: [{ project_id: 'p1', cost: 50 }],
    });
    const body = await (await handleFinopsOverview(new Request('https://x.test/'), env)).json() as {
      projects: Array<{ budget: { forecastEomUsd: number; pctOfCapForecast: number } }>;
    };
    expect(body.projects[0].budget.pctOfCapForecast).toBe(0);
  });
});
