import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

vi.stubGlobal('fetch', mockAuthFetch('user_admin'));

import worker from '../index.js';

async function request(path: string, init: RequestInit = {}, env: Env) {
  const req = new Request(`http://localhost${path}`, init);
  return worker.fetch(req, env, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
}

describe('Admin Users Routes', () => {
  let env: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch('user_admin'));
  });

  it('GET /api/admin/users returns 403 for non-admin', async () => {
    mockDb._setSelectResults([
      [{ isAdmin: 0 }],
    ]);
    const res = await request('/api/admin/users', {
      headers: { Authorization: 'Bearer valid-token' },
    }, env);
    expect(res.status).toBe(403);
  });

  it('GET /api/admin/users returns user list for admin', async () => {
    const mockUsers = [
      { id: 'u1', email: 'alice@test.com', name: 'Alice', plan: 'pro', isAdmin: 0, isSuspended: 0, createdAt: '2026-01-01' },
    ];
    mockDb._setSelectResults([
      [{ isAdmin: 1 }], // admin check
      mockUsers,         // user list query
    ]);
    const res = await request('/api/admin/users', {
      headers: { Authorization: 'Bearer valid-token' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].email).toBe('alice@test.com');
  });

  it('PATCH /api/admin/users/:id returns 403 for non-admin', async () => {
    mockDb._setSelectResults([
      [{ isAdmin: 0 }],
    ]);
    const res = await request('/api/admin/users/u1', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSuspended: true }),
    }, env);
    expect(res.status).toBe(403);
  });

  it('PATCH /api/admin/users/:id suspends user', async () => {
    mockDb._setSelectResults([
      [{ isAdmin: 1 }], // admin check
      [{ id: 'u1' }],   // target user exists
    ]);
    const res = await request('/api/admin/users/u1', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSuspended: true }),
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.isSuspended).toBe(true);
  });

  it('PATCH /api/admin/users/:id returns 404 for non-existent user', async () => {
    mockDb._setSelectResults([
      [{ isAdmin: 1 }], // admin check
      [],                // user not found
    ]);
    const res = await request('/api/admin/users/nonexistent', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSuspended: true }),
    }, env);
    expect(res.status).toBe(404);
  });
});
