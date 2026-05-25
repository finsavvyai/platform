import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

vi.mock('../utils/ensure-user.js', () => ({
  ensureUser: vi.fn(),
}));

vi.stubGlobal('fetch', mockAuthFetch());

import { orgRoutes } from './organizations.js';

describe('Organization Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/organizations', orgRoutes);
  });

  describe('POST / (create organization)', () => {
    it('creates an org and returns 201', async () => {
      // First query: check slug uniqueness (no match)
      mockDb._setSelectResults([
        [], // no existing org with this slug
      ]);

      const res = await app.request('/api/organizations', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Acme Corp', slug: 'acme-corp' }),
      }, mockEnv);

      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.data).toBeDefined();
      expect(body.data.name).toBe('Acme Corp');
      expect(body.data.slug).toBe('acme-corp');
    });

    it('returns 400 when name is missing', async () => {
      const res = await app.request('/api/organizations', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'test-slug' }),
      }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('auto-generates slug when not provided', async () => {
      mockDb._setSelectResults([
        [], // no existing slug
      ]);
      const res = await app.request('/api/organizations', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Acme Corp' }),
      }, mockEnv);
      expect(res.status).toBe(201);
      const body = (await res.json()) as { data: { slug: string } };
      expect(body.data.slug).toBe('acme-corp');
    });

    it('returns 400 for invalid slug format', async () => {
      const res = await app.request('/api/organizations', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Acme', slug: 'A' }),
      }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('returns 409 when slug already taken', async () => {
      mockDb._setSelectResults([
        [{ id: 'org_existing' }], // slug exists
      ]);

      const res = await app.request('/api/organizations', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Acme Corp', slug: 'acme-corp' }),
      }, mockEnv);
      expect(res.status).toBe(409);
    });
  });

  describe('GET / (list organizations)', () => {
    it('returns user organizations', async () => {
      mockDb._setSelectResult([
        { org: { id: 'org_1', name: 'My Org', slug: 'my-org' }, role: 'owner' },
      ]);

      const res = await app.request('/api/organizations', {
        headers: { Authorization: 'Bearer valid-token' },
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('returns empty array when user has no orgs', async () => {
      mockDb._setSelectResult([]);

      const res = await app.request('/api/organizations', {
        headers: { Authorization: 'Bearer valid-token' },
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data).toEqual([]);
    });
  });

  describe('GET /:orgId (org detail)', () => {
    it('returns org with members', async () => {
      mockDb._setSelectResults([
        // requirePermission: member lookup (X-Org-Id present)
        [{ id: 'mem_1', orgId: 'org_1', userId: 'user_test123', role: 'owner', status: 'active' }],
        // org lookup
        [{ id: 'org_1', name: 'Test Org', slug: 'test-org', ownerId: 'user_test123' }],
        // members
        [{ userId: 'user_test123', role: 'owner', acceptedAt: '2025-01-01' }],
        // user lookup for member enrichment
        [{ name: 'Test User', email: 'test@example.com' }],
      ]);

      const res = await app.request('/api/organizations/org_1', {
        headers: { Authorization: 'Bearer valid-token', 'X-Org-Id': 'org_1' },
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data).toBeDefined();
      expect(body.data.members).toBeDefined();
      expect(body.data.memberCount).toBe(1);
      expect(body.data.members[0].name).toBe('Test User');
      expect(body.data.members[0].email).toBe('test@example.com');
    });

    it('returns 404 when org not found', async () => {
      mockDb._setSelectResults([
        [{ id: 'mem_1', orgId: 'org_1', userId: 'user_test123', role: 'owner', status: 'active' }],
        [],
      ]);

      const res = await app.request('/api/organizations/org_1', {
        headers: { Authorization: 'Bearer valid-token', 'X-Org-Id': 'org_1' },
      }, mockEnv);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /:orgId (delete organization)', () => {
    it('returns 403 for non-owner (viewer role lacks org.delete)', async () => {
      mockDb._setSelectResults([
        [{ id: 'mem_1', orgId: 'org_1', userId: 'user_test123', role: 'viewer', status: 'active' }],
      ]);

      const res = await app.request('/api/organizations/org_1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer valid-token', 'X-Org-Id': 'org_1' },
      }, mockEnv);

      expect(res.status).toBe(403);
    });
  });
});
