/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  handleCreateKey,
  handleListKeys,
  handleRotateKey,
  handleRevokeKey,
  handleCreateProject,
  handleListProjects,
} from './api-keys';
import { createToken } from './jwt';
import type { Env } from '../types';

const SECRET = 'test-api-keys-secret-padded-to-32chars!';

async function authReq(url: string, options: RequestInit = {}): Promise<Request> {
  const token = await createToken({ sub: 'user1', email: 'u@x.com' }, SECRET);
  const headers = new Headers(options.headers as HeadersInit);
  headers.set('Authorization', `Bearer ${token}`);
  return new Request(url, { ...options, headers });
}

interface ProjectRow {
  id: string; name: string; tier: string; api_key_hash?: string; created_at?: string;
}
interface MemberRow {
  user_id: string; project_id: string; role: string;
}

function makeDB(opts: {
  projectRow?: ProjectRow | null;
  members?: MemberRow[];
  batchCalls?: Array<unknown>;
} = {}) {
  const { projectRow = null, members = [] } = opts;
  const runCalls: Array<{ sql: string; binds: unknown[] }> = [];
  const batchCalls: Array<unknown[]> = [];

  const prepare = (sql: string) => ({
    bind: (...binds: unknown[]) => ({
      first: async <T>(): Promise<T | null> => {
        if (sql.includes('SELECT role FROM project_members')) {
          const [projectId, userId] = binds as [string, string];
          const m = members.find((r) => r.project_id === projectId && r.user_id === userId);
          return (m ? { role: m.role } : null) as T;
        }
        if (sql.includes('SELECT id, name, api_key_hash, tier')) {
          return projectRow as T;
        }
        if (sql.includes('COUNT(*)')) {
          const cnt = members.filter((m) => m.role === 'owner').length;
          return { cnt } as T;
        }
        return null as T;
      },
      all: async <T>(): Promise<{ results: T[] }> => {
        if (sql.includes('projects p JOIN project_members')) {
          return { results: members.map((m) => ({ id: 'p1', name: 'P', tier: 'free', created_at: '2026-01-01', role: m.role })) as unknown as T[] };
        }
        return { results: [] };
      },
      run: async () => {
        runCalls.push({ sql, binds });
        return { success: true };
      },
    }),
    run: async () => {
      runCalls.push({ sql, binds: [] });
      return { success: true };
    },
  });

  const batch = async (stmts: unknown[]) => {
    batchCalls.push(stmts);
    return [];
  };

  return {
    DB: { prepare, batch } as unknown as D1Database,
    _runCalls: runCalls,
    _batchCalls: batchCalls,
  };
}

function makeEnv(opts: Parameters<typeof makeDB>[0] = {}): { env: Env; db: ReturnType<typeof makeDB> } {
  const db = makeDB(opts);
  const env = {
    DB: db.DB,
    CACHE: {} as KVNamespace,
    AUTH_SECRET: SECRET,
    ENVIRONMENT: 'test',
  } as unknown as Env;
  return { env, db };
}

describe('handleCreateKey', () => {
  it('returns 401 when not authenticated', async () => {
    const { env } = makeEnv({ members: [{ user_id: 'user1', project_id: 'p1', role: 'admin' }] });
    const req = new Request('https://x/v1/projects/p1/keys', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
    const res = await handleCreateKey(req, env, 'p1');
    expect(res.status).toBe(401);
  });

  it('returns 403 when user lacks admin role', async () => {
    const { env } = makeEnv({ members: [{ user_id: 'user1', project_id: 'p1', role: 'member' }] });
    const req = await authReq('https://x/v1/projects/p1/keys', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
    const res = await handleCreateKey(req, env, 'p1');
    expect(res.status).toBe(403);
  });

  it('returns 201 with api key for admin user', async () => {
    const { env } = makeEnv({ members: [{ user_id: 'user1', project_id: 'p1', role: 'admin' }] });
    const req = await authReq('https://x/v1/projects/p1/keys', { method: 'POST', body: JSON.stringify({ name: 'My Key' }), headers: { 'Content-Type': 'application/json' } });
    const res = await handleCreateKey(req, env, 'p1');
    expect(res.status).toBe(201);
    const json = await res.json() as { key: string; prefix: string; warning: string };
    expect(json.key).toMatch(/^cp_/);
    expect(json.prefix).toContain('...');
    expect(json.warning).toBeTruthy();
  });

  it('defaults name to "Default" when body lacks name', async () => {
    const { env } = makeEnv({ members: [{ user_id: 'user1', project_id: 'p1', role: 'admin' }] });
    const req = await authReq('https://x/v1/projects/p1/keys', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
    const res = await handleCreateKey(req, env, 'p1');
    expect(res.status).toBe(201);
  });
});

describe('handleListKeys', () => {
  it('returns 401 when not authenticated', async () => {
    const { env } = makeEnv();
    const req = new Request('https://x/v1/projects/p1/keys');
    const res = await handleListKeys(req, env, 'p1');
    expect(res.status).toBe(401);
  });

  it('returns 403 when user lacks access', async () => {
    const { env } = makeEnv({ members: [] });
    const req = await authReq('https://x/v1/projects/p1/keys');
    const res = await handleListKeys(req, env, 'p1');
    expect(res.status).toBe(403);
  });

  it('returns 404 when project not found', async () => {
    const { env } = makeEnv({ members: [{ user_id: 'user1', project_id: 'p1', role: 'member' }], projectRow: null });
    const req = await authReq('https://x/v1/projects/p1/keys');
    const res = await handleListKeys(req, env, 'p1');
    expect(res.status).toBe(404);
  });

  it('returns 200 with project info for member', async () => {
    const { env } = makeEnv({
      members: [{ user_id: 'user1', project_id: 'p1', role: 'member' }],
      projectRow: { id: 'p1', name: 'My Project', tier: 'dev', api_key_hash: 'abc' },
    });
    const req = await authReq('https://x/v1/projects/p1/keys');
    const res = await handleListKeys(req, env, 'p1');
    expect(res.status).toBe(200);
    const json = await res.json() as { project: { name: string }; hasKey: boolean };
    expect(json.project.name).toBe('My Project');
    expect(json.hasKey).toBe(true);
  });
});

describe('handleRotateKey', () => {
  it('returns 401 when not authenticated', async () => {
    const { env } = makeEnv();
    const req = new Request('https://x/v1/projects/p1/keys/rotate', { method: 'POST' });
    const res = await handleRotateKey(req, env, 'p1');
    expect(res.status).toBe(401);
  });

  it('returns 403 when user lacks owner role', async () => {
    const { env } = makeEnv({ members: [{ user_id: 'user1', project_id: 'p1', role: 'admin' }] });
    const req = await authReq('https://x/v1/projects/p1/keys/rotate', { method: 'POST' });
    const res = await handleRotateKey(req, env, 'p1');
    expect(res.status).toBe(403);
  });

  it('returns 200 with new key for owner', async () => {
    const { env } = makeEnv({ members: [{ user_id: 'user1', project_id: 'p1', role: 'owner' }] });
    const req = await authReq('https://x/v1/projects/p1/keys/rotate', { method: 'POST' });
    const res = await handleRotateKey(req, env, 'p1');
    expect(res.status).toBe(200);
    const json = await res.json() as { key: string; warning: string };
    expect(json.key).toMatch(/^cp_/);
    expect(json.warning).toContain('Previous key');
  });
});

describe('handleRevokeKey', () => {
  it('returns 401 when not authenticated', async () => {
    const { env } = makeEnv();
    const req = new Request('https://x/v1/projects/p1/keys', { method: 'DELETE' });
    const res = await handleRevokeKey(req, env, 'p1');
    expect(res.status).toBe(401);
  });

  it('returns 403 when user lacks owner role', async () => {
    const { env } = makeEnv({ members: [{ user_id: 'user1', project_id: 'p1', role: 'admin' }] });
    const req = await authReq('https://x/v1/projects/p1/keys', { method: 'DELETE' });
    const res = await handleRevokeKey(req, env, 'p1');
    expect(res.status).toBe(403);
  });

  it('returns 200 on successful revoke', async () => {
    const { env } = makeEnv({ members: [{ user_id: 'user1', project_id: 'p1', role: 'owner' }] });
    const req = await authReq('https://x/v1/projects/p1/keys', { method: 'DELETE' });
    const res = await handleRevokeKey(req, env, 'p1');
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean };
    expect(json.ok).toBe(true);
  });
});

describe('handleCreateProject', () => {
  it('returns 401 when not authenticated', async () => {
    const { env } = makeEnv();
    const req = new Request('https://x/v1/projects', { method: 'POST', body: JSON.stringify({ name: 'P' }), headers: { 'Content-Type': 'application/json' } });
    const res = await handleCreateProject(req, env);
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid JSON', async () => {
    const { env } = makeEnv({ members: [{ user_id: 'user1', project_id: 'p1', role: 'owner' }] });
    const req = await authReq('https://x/v1/projects', { method: 'POST', body: 'bad-json', headers: { 'Content-Type': 'application/json' } });
    const res = await handleCreateProject(req, env);
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is missing', async () => {
    const { env } = makeEnv({ members: [{ user_id: 'user1', project_id: 'p1', role: 'owner' }] });
    const req = await authReq('https://x/v1/projects', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
    const res = await handleCreateProject(req, env);
    expect(res.status).toBe(400);
  });

  it('returns 201 with project + apiKey on success', async () => {
    const { env } = makeEnv({ members: [{ user_id: 'user1', project_id: 'p1', role: 'owner' }] });
    const req = await authReq('https://x/v1/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'My Project' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleCreateProject(req, env);
    expect(res.status).toBe(201);
    const json = await res.json() as { project: { name: string; tier: string }; apiKey: string };
    expect(json.project.name).toBe('My Project');
    expect(json.project.tier).toBe('free');
    expect(json.apiKey).toMatch(/^cp_/);
  });
});

describe('handleListProjects', () => {
  it('returns 401 when not authenticated', async () => {
    const { env } = makeEnv();
    const req = new Request('https://x/v1/projects');
    const res = await handleListProjects(req, env);
    expect(res.status).toBe(401);
  });

  it('returns 200 with project list', async () => {
    const { env } = makeEnv({ members: [{ user_id: 'user1', project_id: 'p1', role: 'owner' }] });
    const req = await authReq('https://x/v1/projects');
    const res = await handleListProjects(req, env);
    expect(res.status).toBe(200);
    const json = await res.json() as { projects: unknown[] };
    expect(Array.isArray(json.projects)).toBe(true);
  });
});
