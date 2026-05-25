/** @vitest-environment node */
/** Route-level tests for invitations.ts. The pure formatInviteEmail
 *  helper is already covered by invitations.test.ts. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleCreateInvitation, handleGetInvitation, handleAcceptInvitation,
  handleListInvitations, handleRevokeInvitation, routeInvitations,
} from './invitations';
import type { Env } from './types';

vi.mock('./auth/rbac', () => ({
  getAuthUser: vi.fn(),
  checkProjectAccess: vi.fn(),
}));
vi.mock('./email-digest', () => ({
  isValidEmail: (s: string) => /\S+@\S+\.\S+/.test(s),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import { getAuthUser, checkProjectAccess } from './auth/rbac';

interface DBState {
  project?: { name: string } | null;
  invitation?: {
    id: string; project_id: string; email: string; role: string;
    accepted_at: string | null; revoked_at: string | null;
    project_name?: string;
  } | null;
  list?: object[];
  inserts: Array<{ binds: unknown[] }>;
  updates: Array<{ binds: unknown[] }>;
  batched?: number;
}

function makeDB(state: DBState) {
  return {
    prepare: (sql: string) => {
      const stmt = {
        bind: (...binds: unknown[]) => ({
          first: async () => {
            if (sql.includes('FROM projects WHERE id = ?')) return state.project ?? null;
            if (sql.includes('JOIN projects p ON p.id = i.project_id')) {
              return state.invitation
                ? { ...state.invitation, project_name: state.invitation.project_name ?? 'P' }
                : null;
            }
            if (sql.includes('FROM project_invitations WHERE token = ?')) return state.invitation ?? null;
            return null;
          },
          all: async () => ({ results: state.list ?? [] }),
          run: async () => {
            if (sql.startsWith('INSERT')) state.inserts.push({ binds });
            if (sql.startsWith('UPDATE')) state.updates.push({ binds });
            return { success: true };
          },
        }),
      };
      return stmt;
    },
    batch: async (arr: unknown[]) => { state.batched = arr.length; return []; },
  };
}

const mkEnv = (state: Partial<DBState> = {}): Env =>
  ({ DB: makeDB({ inserts: [], updates: [], ...state }) as unknown as D1Database } as Env);

const adminUser = { sub: 'u1', email: 'a@b.test', name: 'Alice', iat: 0, exp: 0 };

beforeEach(() => {
  vi.mocked(getAuthUser).mockReset();
  vi.mocked(checkProjectAccess).mockReset();
});

function jsonReq(body: unknown, method = 'POST'): Request {
  return new Request('https://x.test/', { method, body: JSON.stringify(body) });
}

describe('handleCreateInvitation', () => {
  it('401 unauthenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleCreateInvitation(jsonReq({}), mkEnv(), 'p1')).status).toBe(401);
  });
  it('403 not admin', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    expect((await handleCreateInvitation(jsonReq({}), mkEnv(), 'p1')).status).toBe(403);
  });
  it('400 bad email', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    expect((await handleCreateInvitation(jsonReq({ email: 'not-email' }), mkEnv(), 'p1')).status).toBe(400);
  });
  it('400 invalid role', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    expect((await handleCreateInvitation(jsonReq({ email: 'b@b.test', role: 'pirate' }), mkEnv(), 'p1')).status).toBe(400);
  });
  it('404 project missing', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    expect((await handleCreateInvitation(jsonReq({ email: 'b@b.test' }), mkEnv({ project: null }), 'p1')).status).toBe(404);
  });
  it('201 happy path', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const env = mkEnv({ project: { name: 'P' } });
    const res = await handleCreateInvitation(jsonReq({ email: 'b@b.test' }), env, 'p1');
    expect(res.status).toBe(201);
    const body = await res.json() as { invitation: { token: string } };
    expect(body.invitation.token.length).toBeGreaterThan(40);
  });
});

describe('handleGetInvitation', () => {
  it('404 missing', async () => {
    expect((await handleGetInvitation(new Request('https://x.test/'), mkEnv({ invitation: null }), 'tok')).status).toBe(404);
  });
  it('410 revoked', async () => {
    const env = mkEnv({ invitation: { id: 'i', project_id: 'p1', email: 'b@b.test', role: 'member', accepted_at: null, revoked_at: '2026-01-01' } });
    expect((await handleGetInvitation(new Request('https://x.test/'), env, 'tok')).status).toBe(410);
  });
  it('410 already accepted', async () => {
    const env = mkEnv({ invitation: { id: 'i', project_id: 'p1', email: 'b@b.test', role: 'member', accepted_at: '2026-01-01', revoked_at: null } });
    expect((await handleGetInvitation(new Request('https://x.test/'), env, 'tok')).status).toBe(410);
  });
  it('200 returns email + role + projectName', async () => {
    const env = mkEnv({ invitation: { id: 'i', project_id: 'p1', email: 'b@b.test', role: 'admin', accepted_at: null, revoked_at: null, project_name: 'Proj' } });
    const body = await (await handleGetInvitation(new Request('https://x.test/'), env, 'tok')).json() as { email: string; role: string; projectName: string };
    expect(body.email).toBe('b@b.test');
    expect(body.role).toBe('admin');
    expect(body.projectName).toBe('Proj');
  });
});

describe('handleAcceptInvitation', () => {
  it('401 unauthenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleAcceptInvitation(new Request('https://x.test/', { method: 'POST' }), mkEnv(), 'tok')).status).toBe(401);
  });
  it('404 missing', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    expect((await handleAcceptInvitation(new Request('https://x.test/', { method: 'POST' }), mkEnv({ invitation: null }), 'tok')).status).toBe(404);
  });
  it('403 wrong email', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...adminUser, email: 'someone-else@b.test' });
    const env = mkEnv({ invitation: { id: 'i', project_id: 'p1', email: 'a@b.test', role: 'member', accepted_at: null, revoked_at: null } });
    expect((await handleAcceptInvitation(new Request('https://x.test/', { method: 'POST' }), env, 'tok')).status).toBe(403);
  });
  it('200 happy path with batch update', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    const state: DBState = { invitation: { id: 'i', project_id: 'p1', email: 'a@b.test', role: 'admin', accepted_at: null, revoked_at: null }, inserts: [], updates: [] };
    const env = { DB: makeDB(state) as unknown as D1Database } as Env;
    const res = await handleAcceptInvitation(new Request('https://x.test/', { method: 'POST' }), env, 'tok');
    expect(res.status).toBe(200);
    expect(state.batched).toBe(2);
  });
});

describe('handleListInvitations + handleRevokeInvitation', () => {
  it('401/403/200 list', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleListInvitations(new Request('https://x.test/'), mkEnv(), 'p1')).status).toBe(401);
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    expect((await handleListInvitations(new Request('https://x.test/'), mkEnv(), 'p1')).status).toBe(403);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const env = mkEnv({ list: [{ id: 'i1', email: 'a@b.test', role: 'member' }] });
    const body = await (await handleListInvitations(new Request('https://x.test/'), env, 'p1')).json() as { invitations: unknown[] };
    expect(body.invitations).toHaveLength(1);
  });
  it('200 revoke runs UPDATE', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const state: DBState = { inserts: [], updates: [] };
    const env = { DB: makeDB(state) as unknown as D1Database } as Env;
    const res = await handleRevokeInvitation(new Request('https://x.test/', { method: 'DELETE' }), env, 'p1', 'inv1');
    expect(res.status).toBe(200);
    expect(state.updates).toHaveLength(1);
  });
});

describe('routeInvitations', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
  });
  it('GET /v1/invitations/:token -> get', async () => {
    const env = mkEnv({ invitation: { id: 'i', project_id: 'p1', email: 'a@b.test', role: 'member', accepted_at: null, revoked_at: null, project_name: 'P' } });
    const res = await routeInvitations(new Request('https://x.test/'), env, '/v1/invitations/tok', 'GET');
    expect(res?.status).toBe(200);
  });
  it('POST /v1/invitations/:token/accept -> accept', async () => {
    const state: DBState = { invitation: { id: 'i', project_id: 'p1', email: 'a@b.test', role: 'admin', accepted_at: null, revoked_at: null }, inserts: [], updates: [] };
    const env = { DB: makeDB(state) as unknown as D1Database } as Env;
    const res = await routeInvitations(new Request('https://x.test/', { method: 'POST' }), env, '/v1/invitations/tok/accept', 'POST');
    expect(res?.status).toBe(200);
  });
  it('null on unrelated path', async () => {
    expect(await routeInvitations(new Request('https://x.test/'), mkEnv(), '/v1/prompt', 'POST')).toBeNull();
  });
});
