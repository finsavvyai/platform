/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  checkProjectAccess,
  getAuthUser,
  listProjectMembers,
  addProjectMember,
  removeProjectMember,
  updateMemberRole,
} from './rbac';
import { createToken } from './jwt';
import type { Env } from '../types';

const SECRET = 'test-rbac-secret-at-least-32-chars!!';

// In-memory project_members table
function makeDB(initialMembers: Array<{ user_id: string; role: string; project_id: string; email?: string; name?: string }> = []) {
  const members = [...initialMembers];
  let idCounter = 0;

  const prepare = (sql: string) => ({
    bind: (...binds: unknown[]) => ({
      first: async <T>(): Promise<T | null> => {
        if (sql.includes('SELECT role FROM project_members') && sql.includes('project_id = ?')) {
          const [projectId, userId] = binds as [string, string];
          const m = members.find((r) => r.project_id === projectId && r.user_id === userId);
          return (m ? { role: m.role } : null) as T;
        }
        if (sql.includes('COUNT(*)') && sql.includes("role = 'owner'")) {
          const [projectId] = binds as [string];
          const cnt = members.filter((r) => r.project_id === projectId && r.role === 'owner').length;
          return { cnt } as T;
        }
        return null as T;
      },
      all: async <T>(): Promise<{ results: T[] }> => {
        if (sql.includes('project_members pm JOIN users u')) {
          const [projectId] = binds as [string];
          const rows = members.filter((r) => r.project_id === projectId).map((r) => ({
            user_id: r.user_id, role: r.role, email: r.email ?? 'u@x.com', name: r.name ?? 'User',
          }));
          return { results: rows as T[] };
        }
        return { results: [] };
      },
      run: async () => {
        if (sql.includes('INSERT OR IGNORE INTO project_members')) {
          const [id, projectId, userId, role] = binds as [string, string, string, string];
          const exists = members.find((r) => r.project_id === projectId && r.user_id === userId);
          if (!exists) members.push({ user_id: userId, role, project_id: projectId });
          return { success: true };
        }
        if (sql.includes('DELETE FROM project_members')) {
          const [projectId, userId] = binds as [string, string];
          const idx = members.findIndex((r) => r.project_id === projectId && r.user_id === userId);
          if (idx !== -1) members.splice(idx, 1);
          return { success: true };
        }
        if (sql.includes('UPDATE project_members SET role')) {
          const [newRole, projectId, userId] = binds as [string, string, string];
          const m = members.find((r) => r.project_id === projectId && r.user_id === userId);
          if (m) m.role = newRole;
          return { success: true };
        }
        return { success: true };
      },
    }),
  });

  return { DB: { prepare } as unknown as D1Database, _members: members };
}

function makeEnv(members: Parameters<typeof makeDB>[0] = [], authSecret?: string): Env {
  const db = makeDB(members);
  return {
    DB: db.DB,
    CACHE: {} as KVNamespace,
    AUTH_SECRET: authSecret ?? SECRET,
    ENVIRONMENT: 'test',
  } as unknown as Env;
}

describe('checkProjectAccess', () => {
  it('returns true when user has the required role (member)', async () => {
    const env = makeEnv([{ project_id: 'p1', user_id: 'u1', role: 'member' }]);
    expect(await checkProjectAccess(env, 'u1', 'p1', 'member')).toBe(true);
  });

  it('returns false when user is not in project', async () => {
    const env = makeEnv([]);
    expect(await checkProjectAccess(env, 'u99', 'p1')).toBe(false);
  });

  it('owner satisfies admin requirement', async () => {
    const env = makeEnv([{ project_id: 'p1', user_id: 'u1', role: 'owner' }]);
    expect(await checkProjectAccess(env, 'u1', 'p1', 'admin')).toBe(true);
  });

  it('member does NOT satisfy admin requirement', async () => {
    const env = makeEnv([{ project_id: 'p1', user_id: 'u1', role: 'member' }]);
    expect(await checkProjectAccess(env, 'u1', 'p1', 'admin')).toBe(false);
  });

  it('admin satisfies member requirement', async () => {
    const env = makeEnv([{ project_id: 'p1', user_id: 'u1', role: 'admin' }]);
    expect(await checkProjectAccess(env, 'u1', 'p1', 'member')).toBe(true);
  });

  it('defaults required role to member', async () => {
    const env = makeEnv([{ project_id: 'p1', user_id: 'u1', role: 'member' }]);
    expect(await checkProjectAccess(env, 'u1', 'p1')).toBe(true);
  });
});

describe('getAuthUser', () => {
  it('returns null when AUTH_SECRET is missing', async () => {
    const env = makeEnv([], '');
    const req = new Request('https://x/');
    expect(await getAuthUser(req, { ...env, AUTH_SECRET: '' } as unknown as Env)).toBeNull();
  });

  it('returns null when no token present', async () => {
    const env = makeEnv();
    const req = new Request('https://x/');
    expect(await getAuthUser(req, env)).toBeNull();
  });

  it('returns null for invalid token', async () => {
    const env = makeEnv();
    const req = new Request('https://x/', { headers: { Authorization: 'Bearer badtoken' } });
    expect(await getAuthUser(req, env)).toBeNull();
  });

  it('returns payload for valid token in Authorization header', async () => {
    const env = makeEnv();
    const token = await createToken({ sub: 'u1', email: 'u@x.com' }, SECRET);
    const req = new Request('https://x/', { headers: { Authorization: `Bearer ${token}` } });
    const user = await getAuthUser(req, env);
    expect(user?.sub).toBe('u1');
    expect(user?.email).toBe('u@x.com');
  });

  it('returns payload for valid token in session cookie', async () => {
    const env = makeEnv();
    const token = await createToken({ sub: 'u2', email: 'u2@x.com' }, SECRET);
    const req = new Request('https://x/', { headers: { Cookie: `clawpipe_session=${token}` } });
    const user = await getAuthUser(req, env);
    expect(user?.sub).toBe('u2');
  });
});

describe('listProjectMembers', () => {
  it('returns empty array for project with no members', async () => {
    const env = makeEnv([]);
    expect(await listProjectMembers(env, 'p_empty')).toEqual([]);
  });

  it('returns members for a project', async () => {
    const env = makeEnv([
      { project_id: 'p1', user_id: 'u1', role: 'owner', email: 'a@x.com', name: 'Alice' },
      { project_id: 'p1', user_id: 'u2', role: 'member', email: 'b@x.com', name: 'Bob' },
    ]);
    const members = await listProjectMembers(env, 'p1');
    expect(members).toHaveLength(2);
    expect(members.map((m) => m.user_id)).toContain('u1');
    expect(members.map((m) => m.user_id)).toContain('u2');
  });
});

describe('addProjectMember', () => {
  it('adds a new member', async () => {
    const db = makeDB([{ project_id: 'p1', user_id: 'u1', role: 'owner' }]);
    const env = { DB: db.DB, CACHE: {} as KVNamespace, AUTH_SECRET: SECRET, ENVIRONMENT: 'test' } as unknown as Env;
    await addProjectMember(env, 'p1', 'u2', 'member');
    expect(db._members.find((m) => m.user_id === 'u2')).toBeTruthy();
  });

  it('does not duplicate existing member (INSERT OR IGNORE)', async () => {
    const db = makeDB([{ project_id: 'p1', user_id: 'u1', role: 'owner' }]);
    const env = { DB: db.DB, CACHE: {} as KVNamespace, AUTH_SECRET: SECRET, ENVIRONMENT: 'test' } as unknown as Env;
    await addProjectMember(env, 'p1', 'u1', 'admin');
    const ownersCount = db._members.filter((m) => m.user_id === 'u1').length;
    expect(ownersCount).toBe(1);
  });
});

describe('removeProjectMember', () => {
  it('returns error when member not found', async () => {
    const env = makeEnv([]);
    const result = await removeProjectMember(env, 'p1', 'u_nonexistent');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('refuses to remove the last owner', async () => {
    const env = makeEnv([{ project_id: 'p1', user_id: 'u1', role: 'owner' }]);
    const result = await removeProjectMember(env, 'p1', 'u1');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/last owner/i);
  });

  it('removes a non-owner member successfully', async () => {
    const db = makeDB([
      { project_id: 'p1', user_id: 'owner1', role: 'owner' },
      { project_id: 'p1', user_id: 'mem1', role: 'member' },
    ]);
    const env = { DB: db.DB, CACHE: {} as KVNamespace, AUTH_SECRET: SECRET, ENVIRONMENT: 'test' } as unknown as Env;
    const result = await removeProjectMember(env, 'p1', 'mem1');
    expect(result.ok).toBe(true);
    expect(db._members.find((m) => m.user_id === 'mem1')).toBeUndefined();
  });

  it('allows removing an owner when another owner exists', async () => {
    const db = makeDB([
      { project_id: 'p1', user_id: 'owner1', role: 'owner' },
      { project_id: 'p1', user_id: 'owner2', role: 'owner' },
    ]);
    const env = { DB: db.DB, CACHE: {} as KVNamespace, AUTH_SECRET: SECRET, ENVIRONMENT: 'test' } as unknown as Env;
    const result = await removeProjectMember(env, 'p1', 'owner1');
    expect(result.ok).toBe(true);
  });
});

describe('updateMemberRole', () => {
  it('updates role for existing member', async () => {
    const db = makeDB([{ project_id: 'p1', user_id: 'u1', role: 'member' }]);
    const env = { DB: db.DB, CACHE: {} as KVNamespace, AUTH_SECRET: SECRET, ENVIRONMENT: 'test' } as unknown as Env;
    await updateMemberRole(env, 'p1', 'u1', 'admin');
    expect(db._members.find((m) => m.user_id === 'u1')?.role).toBe('admin');
  });
});
