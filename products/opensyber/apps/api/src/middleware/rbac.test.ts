import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

vi.stubGlobal('fetch', mockAuthFetch());

import { requirePermission, resolveOrgContext, resolveOrgContextAutoDetect } from './rbac.js';
import { authMiddleware } from './auth.js';
import { dbMiddleware } from './db.js';

describe('resolveOrgContext', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', dbMiddleware, authMiddleware, resolveOrgContext);
    app.get('/test', (c) => c.json({
      orgId: c.get('orgId'),
      role: c.get('role'),
    }));
  });

  it('sets null orgId when no X-Org-Id (solo mode)', async () => {
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    }, mockEnv);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.orgId).toBeNull();
    expect(body.role).toBeNull();
  });

  it('resolves org context when X-Org-Id header is present', async () => {
    mockDb._setSelectResult([{
      id: 'mem_1', orgId: 'org_1', userId: 'user_test123',
      role: 'admin', status: 'active',
    }]);

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token', 'X-Org-Id': 'org_1' },
    }, mockEnv);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.orgId).toBe('org_1');
    expect(body.role).toBe('admin');
  });

  it('returns 403 if user is not a member of the org', async () => {
    mockDb._setSelectResult([]);

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token', 'X-Org-Id': 'org_unknown' },
    }, mockEnv);
    expect(res.status).toBe(403);
  });
});

describe('resolveOrgContextAutoDetect', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', dbMiddleware, authMiddleware, resolveOrgContextAutoDetect);
    app.get('/test', (c) => c.json({
      orgId: c.get('orgId'),
      role: c.get('role'),
    }));
  });

  it('sets null orgId when no X-Org-Id and no org membership', async () => {
    mockDb._setSelectResult([]);
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    }, mockEnv);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.orgId).toBeNull();
    expect(body.role).toBeNull();
  });

  it('auto-detects org when no X-Org-Id but user has membership', async () => {
    mockDb._setSelectResult([{
      id: 'mem_1', orgId: 'org_auto', userId: 'user_test123',
      role: 'admin', status: 'active',
      invitedBy: null, invitedAt: null, acceptedAt: '2026-01-01',
    }]);
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    }, mockEnv);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.orgId).toBe('org_auto');
    expect(body.role).toBe('admin');
  });
});

describe('requirePermission', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', dbMiddleware, authMiddleware);
    app.post('/test', requirePermission('instance.create'), (c) => c.json({ ok: true }));
  });

  it('denies write permission when no X-Org-Id and no org exists', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
    }, mockEnv);
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.message).toContain('organization');
  });

  it('allows read permission in solo mode (no X-Org-Id)', async () => {
    const readApp = new Hono<{ Bindings: Env; Variables: Variables }>();
    readApp.use('*', dbMiddleware, authMiddleware);
    readApp.get('/read', requirePermission('instance.view'), (c) => c.json({ ok: true }));

    const res = await readApp.request('/read', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    }, mockEnv);
    expect(res.status).toBe(200);
  });

  it('allows request when user has the required permission', async () => {
    mockDb._setSelectResult([{
      id: 'mem_1', orgId: 'org_1', userId: 'user_test123',
      role: 'admin', status: 'active',
    }]);

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'X-Org-Id': 'org_1',
        'Content-Type': 'application/json',
      },
    }, mockEnv);
    expect(res.status).toBe(200);
  });

  it('denies request when user lacks the required permission', async () => {
    mockDb._setSelectResult([{
      id: 'mem_1', orgId: 'org_1', userId: 'user_test123',
      role: 'viewer', status: 'active',
    }]);

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'X-Org-Id': 'org_1',
        'Content-Type': 'application/json',
      },
    }, mockEnv);
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toBe('Forbidden');
  });

  it('denies request when user is not in the org', async () => {
    mockDb._setSelectResult([]);

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'X-Org-Id': 'org_1',
        'Content-Type': 'application/json',
      },
    }, mockEnv);
    expect(res.status).toBe(403);
  });
});
