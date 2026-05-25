import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

vi.stubGlobal('fetch', mockAuthFetch());

import { orgMemberRoutes } from './org-members.js';

describe('Org Member Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;

  const ownerMember = {
    id: 'mem_owner', orgId: 'org_1', userId: 'user_test123',
    role: 'owner', status: 'active',
    invitedBy: null, invitedAt: null, acceptedAt: '2025-01-01',
  };

  const adminMember = {
    ...ownerMember, id: 'mem_admin', role: 'admin',
  };

  const viewerMember = {
    ...ownerMember, id: 'mem_viewer', role: 'viewer',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/organizations', orgMemberRoutes);
  });

  describe('PATCH /:orgId/members/:memberId (change role)', () => {
    it('changes member role successfully', async () => {
      mockDb._setSelectResults([
        [ownerMember],              // RBAC: member lookup
        [{ role: 'developer' }],    // target member lookup
      ]);

      const res = await app.request('/api/organizations/org_1/members/mem_dev', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-token',
          'X-Org-Id': 'org_1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'admin' }),
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.role).toBe('admin');
    });

    it('returns 400 when role is missing', async () => {
      mockDb._setSelectResults([[ownerMember]]);

      const res = await app.request('/api/organizations/org_1/members/mem_dev', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-token',
          'X-Org-Id': 'org_1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }, mockEnv);

      expect(res.status).toBe(400);
    });

    it('prevents privilege escalation (admin cannot assign owner)', async () => {
      mockDb._setSelectResults([[adminMember]]);

      const res = await app.request('/api/organizations/org_1/members/mem_dev', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-token',
          'X-Org-Id': 'org_1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'owner' }),
      }, mockEnv);

      expect(res.status).toBe(403);
      const body = await res.json() as any;
      expect(body.message).toContain('higher than your own');
    });

    it('returns 403 when trying to change owner role', async () => {
      mockDb._setSelectResults([
        [ownerMember],          // RBAC: current user is owner
        [{ role: 'owner' }],    // target is also owner
      ]);

      const res = await app.request('/api/organizations/org_1/members/mem_other_owner', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-token',
          'X-Org-Id': 'org_1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'admin' }),
      }, mockEnv);

      expect(res.status).toBe(403);
      const body = await res.json() as any;
      expect(body.message).toContain('owner role');
    });

    it('returns 404 when target member not found', async () => {
      mockDb._setSelectResults([
        [ownerMember],  // RBAC
        [],             // target not found
      ]);

      const res = await app.request('/api/organizations/org_1/members/mem_missing', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-token',
          'X-Org-Id': 'org_1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'admin' }),
      }, mockEnv);

      expect(res.status).toBe(404);
    });

    it('returns 403 when viewer tries to change roles', async () => {
      mockDb._setSelectResults([[viewerMember]]);

      const res = await app.request('/api/organizations/org_1/members/mem_dev', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-token',
          'X-Org-Id': 'org_1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'developer' }),
      }, mockEnv);

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /:orgId/members/:memberId (remove member)', () => {
    it('removes a member successfully', async () => {
      mockDb._setSelectResults([
        [ownerMember],
        [{ role: 'developer', userId: 'user_dev' }],
      ]);

      const res = await app.request('/api/organizations/org_1/members/mem_dev', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer valid-token', 'X-Org-Id': 'org_1' },
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.removed).toBe(true);
    });

    it('prevents removing the owner', async () => {
      mockDb._setSelectResults([
        [ownerMember],
        [{ role: 'owner', userId: 'user_other_owner' }],
      ]);

      const res = await app.request('/api/organizations/org_1/members/mem_owner2', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer valid-token', 'X-Org-Id': 'org_1' },
      }, mockEnv);

      expect(res.status).toBe(403);
      const body = await res.json() as any;
      expect(body.message).toContain('owner');
    });

    it('returns 404 when member not found', async () => {
      mockDb._setSelectResults([
        [ownerMember],
        [],
      ]);

      const res = await app.request('/api/organizations/org_1/members/mem_missing', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer valid-token', 'X-Org-Id': 'org_1' },
      }, mockEnv);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /:orgId/members/:memberId/transfer (ownership transfer)', () => {
    it('transfers ownership successfully', async () => {
      mockDb._setSelectResults([
        [ownerMember],  // RBAC: current user is owner
        [{ id: 'mem_admin', orgId: 'org_1', userId: 'user_admin', role: 'admin', status: 'active' }],
      ]);

      const res = await app.request(
        '/api/organizations/org_1/members/mem_admin/transfer',
        {
          method: 'POST',
          headers: { Authorization: 'Bearer valid-token', 'X-Org-Id': 'org_1' },
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.newOwnerId).toBe('user_admin');
    });

    it('returns 404 when target member not found', async () => {
      mockDb._setSelectResults([
        [ownerMember],
        [],  // target not found
      ]);

      const res = await app.request(
        '/api/organizations/org_1/members/mem_missing/transfer',
        {
          method: 'POST',
          headers: { Authorization: 'Bearer valid-token', 'X-Org-Id': 'org_1' },
        },
        mockEnv,
      );

      expect(res.status).toBe(404);
    });

    it('returns 403 when non-owner tries to transfer', async () => {
      mockDb._setSelectResults([[adminMember]]);

      const res = await app.request(
        '/api/organizations/org_1/members/mem_dev/transfer',
        {
          method: 'POST',
          headers: { Authorization: 'Bearer valid-token', 'X-Org-Id': 'org_1' },
        },
        mockEnv,
      );

      expect(res.status).toBe(403);
    });
  });
});
