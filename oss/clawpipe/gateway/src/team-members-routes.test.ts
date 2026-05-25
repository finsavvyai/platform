/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleListTeamMembers, handleAddTeamMember, handleUpdateTeamRole,
  handleRemoveTeamMember, routeTeamMembers,
} from './team-members-routes';
import type { Env } from './types';

vi.mock('./auth/rbac', () => ({ getAuthUser: vi.fn() }));
vi.mock('./email-digest', () => ({ isValidEmail: (s: string) => /\S+@\S+\.\S+/.test(s) }));

import { getAuthUser } from './auth/rbac';

interface DBPlan {
  isAdmin?: boolean;
  isMember?: boolean;
  members?: Array<{ user_id: string; email: string; name: string; role: string }>;
  userByEmail?: { id: string } | null;
  targetMemberRole?: string | null;
  owners?: string[];
  updates: Array<{ sql: string; binds: unknown[] }>;
}

function makeDB(plan: DBPlan) {
  return {
    prepare: (sql: string) => ({
      bind: (...binds: unknown[]) => ({
        first: async <T>(): Promise<T | null> => {
          if (sql.includes("role IN ('owner', 'admin')")) {
            return (plan.isAdmin ? ({ '1': 1 } as unknown as T) : null);
          }
          if (sql.includes('FROM team_members WHERE team_id = ? AND user_id = ?') && sql.includes('LIMIT 1')) {
            return (plan.isMember ? ({ '1': 1 } as unknown as T) : null);
          }
          if (sql.includes('SELECT role FROM team_members')) {
            return plan.targetMemberRole ? ({ role: plan.targetMemberRole } as unknown as T) : null;
          }
          if (sql.includes('SELECT id FROM users WHERE email')) {
            return (plan.userByEmail as unknown) as T | null;
          }
          return null;
        },
        all: async () => {
          if (sql.includes('SELECT u.id as user_id')) {
            return { results: plan.members ?? [] };
          }
          if (sql.includes("role = 'owner'")) {
            return { results: (plan.owners ?? []).map((id) => ({ user_id: id })) };
          }
          return { results: [] };
        },
        run: async () => {
          plan.updates.push({ sql, binds });
          return { success: true };
        },
      }),
    }),
  };
}

function mkEnv(plan: Partial<DBPlan> = {}): Env {
  return { DB: makeDB({ updates: [], ...plan }) as unknown as D1Database } as Env;
}

const authedUser = { sub: 'u1', email: 'a@b.test', iat: 0, exp: 0 };

beforeEach(() => { vi.mocked(getAuthUser).mockReset(); });

describe('handleListTeamMembers', () => {
  it('401 unauthenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const res = await handleListTeamMembers(new Request('https://x.test/'), mkEnv(), 't1');
    expect(res.status).toBe(401);
  });
  it('404 not a member', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    const res = await handleListTeamMembers(new Request('https://x.test/'), mkEnv({ isMember: false }), 't1');
    expect(res.status).toBe(404);
  });
  it('200 returns members', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    const env = mkEnv({ isMember: true, members: [{ user_id: 'u1', email: 'a@b.test', name: 'A', role: 'owner' }] });
    const res = await handleListTeamMembers(new Request('https://x.test/'), env, 't1');
    expect(res.status).toBe(200);
    const body = await res.json() as { members: unknown[] };
    expect(body.members).toHaveLength(1);
  });
});

function jsonReq(body: unknown): Request {
  return new Request('https://x.test/', { method: 'POST', body: JSON.stringify(body) });
}

describe('handleAddTeamMember', () => {
  it('401', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleAddTeamMember(jsonReq({}), mkEnv(), 't1')).status).toBe(401);
  });
  it('403 not admin', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    expect((await handleAddTeamMember(jsonReq({}), mkEnv({ isAdmin: false }), 't1')).status).toBe(403);
  });
  it('400 bad email', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    expect((await handleAddTeamMember(jsonReq({ email: 'not-email' }), mkEnv({ isAdmin: true }), 't1')).status).toBe(400);
  });
  it('400 cannot add as owner', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    expect((await handleAddTeamMember(jsonReq({ email: 'a@b.test', role: 'owner' }), mkEnv({ isAdmin: true }), 't1')).status).toBe(400);
  });
  it('404 user not found', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    expect((await handleAddTeamMember(jsonReq({ email: 'a@b.test' }), mkEnv({ isAdmin: true, userByEmail: null }), 't1')).status).toBe(404);
  });
  it('200 happy path', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    const env = mkEnv({ isAdmin: true, userByEmail: { id: 'target' } });
    const res = await handleAddTeamMember(jsonReq({ email: 'a@b.test', role: 'admin' }), env, 't1');
    expect(res.status).toBe(200);
    const body = await res.json() as { userId: string; role: string };
    expect(body.userId).toBe('target');
    expect(body.role).toBe('admin');
  });
});

describe('handleUpdateTeamRole', () => {
  it('401', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleUpdateTeamRole(jsonReq({}), mkEnv(), 't1', 'u2')).status).toBe(401);
  });
  it('403 not admin', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    expect((await handleUpdateTeamRole(jsonReq({}), mkEnv({ isAdmin: false }), 't1', 'u2')).status).toBe(403);
  });
  it('400 self-change', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    expect((await handleUpdateTeamRole(jsonReq({ role: 'admin' }), mkEnv({ isAdmin: true }), 't1', 'u1')).status).toBe(400);
  });
  it('400 invalid role', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    expect((await handleUpdateTeamRole(jsonReq({ role: 'pirate' }), mkEnv({ isAdmin: true }), 't1', 'u2')).status).toBe(400);
  });
  it('404 member missing', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    expect((await handleUpdateTeamRole(jsonReq({ role: 'admin' }), mkEnv({ isAdmin: true, targetMemberRole: null }), 't1', 'u2')).status).toBe(404);
  });
  it('400 cannot demote owner', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    expect((await handleUpdateTeamRole(jsonReq({ role: 'admin' }), mkEnv({ isAdmin: true, targetMemberRole: 'owner' }), 't1', 'u2')).status).toBe(400);
  });
  it('200 happy', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    const env = mkEnv({ isAdmin: true, targetMemberRole: 'member' });
    expect((await handleUpdateTeamRole(jsonReq({ role: 'admin' }), env, 't1', 'u2')).status).toBe(200);
  });
});

describe('handleRemoveTeamMember', () => {
  it('401', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleRemoveTeamMember(jsonReq({}), mkEnv(), 't1', 'u2')).status).toBe(401);
  });
  it('403 not admin', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    expect((await handleRemoveTeamMember(jsonReq({}), mkEnv({ isAdmin: false }), 't1', 'u2')).status).toBe(403);
  });
  it('400 self-remove', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    expect((await handleRemoveTeamMember(jsonReq({}), mkEnv({ isAdmin: true }), 't1', 'u1')).status).toBe(400);
  });
  it('400 last-owner guard', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    expect((await handleRemoveTeamMember(jsonReq({}), mkEnv({ isAdmin: true, owners: ['u2'] }), 't1', 'u2')).status).toBe(400);
  });
  it('200 happy', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    const env = mkEnv({ isAdmin: true, owners: ['u2', 'u3'] });
    expect((await handleRemoveTeamMember(jsonReq({}), env, 't1', 'u2')).status).toBe(200);
  });
});

describe('routeTeamMembers dispatch', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
  });
  it('GET /v1/teams/:id/members -> list', async () => {
    const env = mkEnv({ isMember: true, members: [] });
    const res = await routeTeamMembers(new Request('https://x.test/'), env, '/v1/teams/t1/members', 'GET');
    expect(res?.status).toBe(200);
  });
  it('returns null for unrelated paths', async () => {
    const res = await routeTeamMembers(new Request('https://x.test/'), mkEnv(), '/v1/prompt', 'POST');
    expect(res).toBeNull();
  });
});
