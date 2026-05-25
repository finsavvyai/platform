/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleCreateTeam, handleListTeams, handleSetTeamBudget, handleSetTeamRateLimit,
  handleGetTeam, handleLinkProjectTeam, routeTeams,
} from './teams-routes';
import type { Env } from './types';

vi.mock('./auth/rbac', () => ({
  getAuthUser: vi.fn(),
  checkProjectAccess: vi.fn(),
}));
vi.mock('./budget', () => ({
  getTeamBudgetStatus: vi.fn().mockResolvedValue({ monthlyCap: 100, usedMtd: 0, pct: 0, over: false }),
  getTeamRateLimit: vi.fn().mockResolvedValue({ perDay: null, usedToday: 0, over: false }),
}));

import { getAuthUser, checkProjectAccess } from './auth/rbac';

interface DBState {
  hasTeamRole?: boolean;
  teamMember?: { role: string } | null;
  team?: { id: string; name: string } | null;
  teamsList?: object[];
  inserts: Array<{ binds: unknown[] }>;
  updates: Array<{ binds: unknown[] }>;
  batched?: number;
}

function makeDB(state: DBState) {
  const stmt = (sql: string) => ({
    bind: (...binds: unknown[]) => ({
      first: async () => {
        if (sql.includes("role IN ('owner', 'admin')")) return state.hasTeamRole ? { '1': 1 } : null;
        if (sql.includes('SELECT role FROM team_members')) return state.teamMember ?? null;
        if (sql.includes('SELECT id, name FROM teams')) return state.team ?? null;
        return null;
      },
      all: async () => ({ results: state.teamsList ?? [] }),
      run: async () => {
        if (sql.startsWith('INSERT')) state.inserts.push({ binds });
        if (sql.startsWith('UPDATE')) state.updates.push({ binds });
        return { success: true };
      },
    }),
  });
  return {
    prepare: stmt,
    batch: async (arr: unknown[]) => { state.batched = arr.length; return []; },
  };
}

const mkEnv = (state: Partial<DBState> = {}): Env =>
  ({ DB: makeDB({ inserts: [], updates: [], ...state }) as unknown as D1Database } as Env);

const adminUser = { sub: 'u1', email: 'a@b.test', iat: 0, exp: 0 };

beforeEach(() => {
  vi.mocked(getAuthUser).mockReset();
  vi.mocked(checkProjectAccess).mockReset();
});

function jsonReq(body: unknown, method = 'POST'): Request {
  return new Request('https://x.test/', { method, body: JSON.stringify(body) });
}

describe('handleCreateTeam', () => {
  it('401', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleCreateTeam(jsonReq({}), mkEnv())).status).toBe(401);
  });
  it('400 when name missing', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    expect((await handleCreateTeam(jsonReq({}), mkEnv())).status).toBe(400);
  });
  it('201 + batches team + member insert', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    const state: DBState = { inserts: [], updates: [] };
    const env = { DB: makeDB(state) as unknown as D1Database } as Env;
    const res = await handleCreateTeam(jsonReq({ name: 'Acme' }), env);
    expect(res.status).toBe(201);
    expect(state.batched).toBe(2);
  });
});

describe('handleListTeams', () => {
  it('401', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleListTeams(new Request('https://x.test/'), mkEnv())).status).toBe(401);
  });
  it('200 returns rows', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    const env = mkEnv({ teamsList: [{ id: 't1', name: 'Acme', budget_usd: 100, role: 'owner' }] });
    const body = await (await handleListTeams(new Request('https://x.test/'), env)).json() as { teams: unknown[] };
    expect(body.teams).toHaveLength(1);
  });
});

describe('handleSetTeamBudget', () => {
  it('401/403/400/200', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleSetTeamBudget(jsonReq({}, 'PUT'), mkEnv(), 't1')).status).toBe(401);

    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    expect((await handleSetTeamBudget(jsonReq({}, 'PUT'), mkEnv({ hasTeamRole: false }), 't1')).status).toBe(403);

    expect((await handleSetTeamBudget(jsonReq({ monthlyCap: -5 }, 'PUT'), mkEnv({ hasTeamRole: true }), 't1')).status).toBe(400);
    expect((await handleSetTeamBudget(jsonReq({ monthlyCap: 'x' }, 'PUT'), mkEnv({ hasTeamRole: true }), 't1')).status).toBe(400);

    expect((await handleSetTeamBudget(jsonReq({ monthlyCap: 100 }, 'PUT'), mkEnv({ hasTeamRole: true }), 't1')).status).toBe(200);
    expect((await handleSetTeamBudget(jsonReq({ monthlyCap: null }, 'PUT'), mkEnv({ hasTeamRole: true }), 't1')).status).toBe(200);
    expect((await handleSetTeamBudget(jsonReq({ monthlyCap: 0 }, 'PUT'), mkEnv({ hasTeamRole: true }), 't1')).status).toBe(200);
  });
});

describe('handleSetTeamRateLimit', () => {
  it('rejects non-integer', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    expect((await handleSetTeamRateLimit(jsonReq({ perDay: 1.5 }, 'PUT'), mkEnv({ hasTeamRole: true }), 't1')).status).toBe(400);
  });
  it('200 happy', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    expect((await handleSetTeamRateLimit(jsonReq({ perDay: 1000 }, 'PUT'), mkEnv({ hasTeamRole: true }), 't1')).status).toBe(200);
  });
});

describe('handleGetTeam', () => {
  it('401', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleGetTeam(new Request('https://x.test/'), mkEnv(), 't1')).status).toBe(401);
  });
  it('404 not a member', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    expect((await handleGetTeam(new Request('https://x.test/'), mkEnv({ teamMember: null }), 't1')).status).toBe(404);
  });
  it('200 returns team + role + budget + rate', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    const env = mkEnv({ teamMember: { role: 'owner' }, team: { id: 't1', name: 'Acme' } });
    const body = await (await handleGetTeam(new Request('https://x.test/'), env, 't1')).json() as { team: unknown; role: string };
    expect(body.role).toBe('owner');
  });
});

describe('handleLinkProjectTeam', () => {
  it('401/403 project access/403 not team admin/200 link/200 unlink', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleLinkProjectTeam(jsonReq({}, 'PUT'), mkEnv(), 'p1')).status).toBe(401);

    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    expect((await handleLinkProjectTeam(jsonReq({}, 'PUT'), mkEnv(), 'p1')).status).toBe(403);

    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    expect((await handleLinkProjectTeam(jsonReq({ teamId: 't-other' }, 'PUT'), mkEnv({ hasTeamRole: false }), 'p1')).status).toBe(403);

    expect((await handleLinkProjectTeam(jsonReq({ teamId: 't1' }, 'PUT'), mkEnv({ hasTeamRole: true }), 'p1')).status).toBe(200);
    expect((await handleLinkProjectTeam(jsonReq({ teamId: null }, 'PUT'), mkEnv({ hasTeamRole: true }), 'p1')).status).toBe(200);
  });
});

describe('routeTeams', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
  });
  it('POST /v1/teams -> create', async () => {
    const res = await routeTeams(jsonReq({ name: 'Acme' }), mkEnv(), '/v1/teams', 'POST');
    expect(res?.status).toBe(201);
  });
  it('GET /v1/teams -> list', async () => {
    const res = await routeTeams(new Request('https://x.test/'), mkEnv({ teamsList: [] }), '/v1/teams', 'GET');
    expect(res?.status).toBe(200);
  });
  it('PUT /v1/teams/:id/budget -> set', async () => {
    const res = await routeTeams(jsonReq({ monthlyCap: 100 }, 'PUT'), mkEnv({ hasTeamRole: true }), '/v1/teams/t1/budget', 'PUT');
    expect(res?.status).toBe(200);
  });
  it('PUT /v1/teams/:id/rate-limit -> set', async () => {
    const res = await routeTeams(jsonReq({ perDay: 100 }, 'PUT'), mkEnv({ hasTeamRole: true }), '/v1/teams/t1/rate-limit', 'PUT');
    expect(res?.status).toBe(200);
  });
  it('GET /v1/teams/:id -> get', async () => {
    const env = mkEnv({ teamMember: { role: 'owner' }, team: { id: 't1', name: 'X' } });
    const res = await routeTeams(new Request('https://x.test/'), env, '/v1/teams/t1', 'GET');
    expect(res?.status).toBe(200);
  });
  it('PUT /v1/projects/:id/team -> link', async () => {
    const res = await routeTeams(jsonReq({ teamId: null }, 'PUT'), mkEnv({ hasTeamRole: true }), '/v1/projects/p1/team', 'PUT');
    expect(res?.status).toBe(200);
  });
  it('null on unrelated', async () => {
    expect(await routeTeams(new Request('https://x.test/'), mkEnv(), '/v1/prompt', 'POST')).toBeNull();
  });
});
