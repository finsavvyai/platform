/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleListMembers, handleUpdateRole, handleRemoveMember, routeMembers,
} from './members-routes';
import type { Env } from './types';

vi.mock('./auth/rbac', () => ({
  getAuthUser: vi.fn(),
  checkProjectAccess: vi.fn(),
  listProjectMembers: vi.fn(),
  removeProjectMember: vi.fn(),
  updateMemberRole: vi.fn(),
}));

import {
  getAuthUser, checkProjectAccess, listProjectMembers,
  removeProjectMember, updateMemberRole,
} from './auth/rbac';

const env = {} as Env;

function jsonReq(body: unknown = {}): Request {
  return new Request('https://x.test/v1/projects/p1/members/u2', { method: 'PUT', body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.mocked(getAuthUser).mockReset();
  vi.mocked(checkProjectAccess).mockReset();
  vi.mocked(listProjectMembers).mockReset();
  vi.mocked(removeProjectMember).mockReset();
  vi.mocked(updateMemberRole).mockReset();
});

describe('handleListMembers', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const res = await handleListMembers(jsonReq(), env, 'p1');
    expect(res.status).toBe(401);
  });
  it('404 when no project access', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ sub: 'u1', email: 'a@b', iat: 0, exp: 0 });
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    const res = await handleListMembers(jsonReq(), env, 'p1');
    expect(res.status).toBe(404);
  });
  it('returns the member list on success', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ sub: 'u1', email: 'a@b', iat: 0, exp: 0 });
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    vi.mocked(listProjectMembers).mockResolvedValue([
      { user_id: 'u1', role: 'owner', email: 'a@b', name: 'A' },
    ]);
    const res = await handleListMembers(jsonReq(), env, 'p1');
    expect(res.status).toBe(200);
    const body = await res.json() as { members: unknown[] };
    expect(body.members).toHaveLength(1);
  });
});

describe('handleUpdateRole', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const res = await handleUpdateRole(jsonReq({ role: 'admin' }), env, 'p1', 'u2');
    expect(res.status).toBe(401);
  });
  it('403 when caller is not admin', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ sub: 'u1', email: 'a@b', iat: 0, exp: 0 });
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    const res = await handleUpdateRole(jsonReq({ role: 'admin' }), env, 'p1', 'u2');
    expect(res.status).toBe(403);
  });
  it('400 on invalid role', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ sub: 'u1', email: 'a@b', iat: 0, exp: 0 });
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const res = await handleUpdateRole(jsonReq({ role: 'pirate' }), env, 'p1', 'u2');
    expect(res.status).toBe(400);
  });
  it('400 when promoting to owner', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ sub: 'u1', email: 'a@b', iat: 0, exp: 0 });
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const res = await handleUpdateRole(jsonReq({ role: 'owner' }), env, 'p1', 'u2');
    expect(res.status).toBe(400);
  });
  it('400 when changing own role', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ sub: 'u1', email: 'a@b', iat: 0, exp: 0 });
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const res = await handleUpdateRole(jsonReq({ role: 'admin' }), env, 'p1', 'u1');
    expect(res.status).toBe(400);
  });
  it('200 + calls updateMemberRole on success', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ sub: 'u1', email: 'a@b', iat: 0, exp: 0 });
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    vi.mocked(updateMemberRole).mockResolvedValue();
    const res = await handleUpdateRole(jsonReq({ role: 'admin' }), env, 'p1', 'u2');
    expect(res.status).toBe(200);
    expect(updateMemberRole).toHaveBeenCalledWith(env, 'p1', 'u2', 'admin');
  });
});

describe('handleRemoveMember', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const res = await handleRemoveMember(jsonReq(), env, 'p1', 'u2');
    expect(res.status).toBe(401);
  });
  it('403 when caller is not admin', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ sub: 'u1', email: 'a@b', iat: 0, exp: 0 });
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    const res = await handleRemoveMember(jsonReq(), env, 'p1', 'u2');
    expect(res.status).toBe(403);
  });
  it('400 when removing self', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ sub: 'u1', email: 'a@b', iat: 0, exp: 0 });
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const res = await handleRemoveMember(jsonReq(), env, 'p1', 'u1');
    expect(res.status).toBe(400);
  });
  it('400 when removing the last owner', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ sub: 'admin', email: 'a@b', iat: 0, exp: 0 });
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    vi.mocked(listProjectMembers).mockResolvedValue([
      { user_id: 'owner1', role: 'owner', email: 'o@b', name: 'O' },
    ]);
    const res = await handleRemoveMember(jsonReq(), env, 'p1', 'owner1');
    expect(res.status).toBe(400);
  });
  it('200 + calls removeProjectMember on success', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ sub: 'admin', email: 'a@b', iat: 0, exp: 0 });
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    vi.mocked(listProjectMembers).mockResolvedValue([
      { user_id: 'u2', role: 'member', email: '2@b', name: '2' },
      { user_id: 'owner1', role: 'owner', email: 'o@b', name: 'O' },
    ]);
    vi.mocked(removeProjectMember).mockResolvedValue({ ok: true });
    const res = await handleRemoveMember(jsonReq(), env, 'p1', 'u2');
    expect(res.status).toBe(200);
    expect(removeProjectMember).toHaveBeenCalledWith(env, 'p1', 'u2');
  });
});

describe('routeMembers', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue({ sub: 'u1', email: 'a@b', iat: 0, exp: 0 });
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    vi.mocked(listProjectMembers).mockResolvedValue([]);
  });
  it('GET /v1/projects/:id/members returns 200', async () => {
    const req = new Request('https://x.test/v1/projects/p1/members');
    const res = await routeMembers(req, env, '/v1/projects/p1/members', 'GET');
    expect(res?.status).toBe(200);
  });
  it('returns null for unrelated path', async () => {
    const req = new Request('https://x.test/v1/prompt');
    const res = await routeMembers(req, env, '/v1/prompt', 'POST');
    expect(res).toBeNull();
  });
  it('returns null for wrong method on /members', async () => {
    const req = new Request('https://x.test/v1/projects/p1/members', { method: 'POST' });
    const res = await routeMembers(req, env, '/v1/projects/p1/members', 'POST');
    expect(res).toBeNull();
  });
});
