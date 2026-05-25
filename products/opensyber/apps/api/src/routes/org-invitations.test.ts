import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

vi.mock('../services/email-invitation.js', () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' }, 401);
    }
    c.set('userId', 'user_test123');
    await next();
  },
}));

import { orgInvitationRoutes } from './org-invitations.js';

describe('Org Invitation Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;

  const ownerMember = {
    id: 'mem_1', orgId: 'org_1', userId: 'user_test123',
    role: 'owner', status: 'active',
    invitedBy: null, invitedAt: null, acceptedAt: '2025-01-01',
  };

  const viewerMember = {
    ...ownerMember, id: 'mem_2', role: 'viewer',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/organizations', orgInvitationRoutes);
  });

  describe('POST /:orgId/invitations (send invitation)', () => {
    it('creates invitation and returns 201', async () => {
      mockDb._setSelectResults([
        [ownerMember],  // RBAC middleware: member lookup
        [],             // check existing pending invitation
        [{ name: 'Acme Corp' }], // org name lookup
      ]);

      const res = await app.request('/api/organizations/org_1/invitations', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'X-Org-Id': 'org_1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'bob@example.com', role: 'developer' }),
      }, mockEnv);

      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.data.email).toBe('bob@example.com');
      expect(body.data.role).toBe('developer');
    });

    it('returns 400 when email is missing', async () => {
      mockDb._setSelectResults([[ownerMember]]);

      const res = await app.request('/api/organizations/org_1/invitations', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'X-Org-Id': 'org_1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'developer' }),
      }, mockEnv);

      expect(res.status).toBe(400);
    });

    it('returns 409 when invitation already pending', async () => {
      mockDb._setSelectResults([
        [ownerMember],
        [{ id: 'inv_existing' }], // existing pending invitation
      ]);

      const res = await app.request('/api/organizations/org_1/invitations', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'X-Org-Id': 'org_1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'bob@example.com', role: 'developer' }),
      }, mockEnv);

      expect(res.status).toBe(409);
    });

    it('returns 403 when viewer tries to invite', async () => {
      mockDb._setSelectResults([[viewerMember]]);

      const res = await app.request('/api/organizations/org_1/invitations', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'X-Org-Id': 'org_1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'bob@example.com', role: 'developer' }),
      }, mockEnv);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /:orgId/invitations (list pending)', () => {
    it('returns pending invitations', async () => {
      mockDb._setSelectResults([
        [ownerMember],
        [{ id: 'inv_1', email: 'bob@example.com', role: 'developer', status: 'pending' }],
      ]);

      const res = await app.request('/api/organizations/org_1/invitations', {
        headers: { Authorization: 'Bearer valid-token', 'X-Org-Id': 'org_1' },
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(1);
    });
  });

  describe('DELETE /:orgId/invitations/:id (cancel)', () => {
    it('cancels an invitation', async () => {
      mockDb._setSelectResults([[ownerMember]]);

      const res = await app.request('/api/organizations/org_1/invitations/inv_1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer valid-token', 'X-Org-Id': 'org_1' },
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.cancelled).toBe(true);
    });

    it('returns 403 when viewer tries to cancel', async () => {
      mockDb._setSelectResults([[viewerMember]]);

      const res = await app.request('/api/organizations/org_1/invitations/inv_1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer valid-token', 'X-Org-Id': 'org_1' },
      }, mockEnv);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /invitations/:token/accept', () => {
    const pendingInvitation = {
      id: 'inv_1', orgId: 'org_1', email: 'testuser@example.com',
      role: 'developer', token: 'tok_valid', status: 'pending',
      invitedBy: 'user_other', expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };

    it('accepts a valid invitation', async () => {
      mockDb._setSelectResults([
        [pendingInvitation],                       // invitation lookup
        [{ email: 'testuser@example.com' }],       // user email lookup
      ]);

      const res = await app.request('/api/organizations/invitations/tok_valid/accept', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.orgId).toBe('org_1');
      expect(body.data.role).toBe('developer');
    });

    it('returns 404 for invalid token', async () => {
      mockDb._setSelectResults([[]]);

      const res = await app.request('/api/organizations/invitations/tok_invalid/accept', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
      }, mockEnv);

      expect(res.status).toBe(404);
    });

    it('returns 410 for expired invitation', async () => {
      const expired = {
        ...pendingInvitation,
        expiresAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      };
      mockDb._setSelectResults([[expired]]);

      const res = await app.request('/api/organizations/invitations/tok_expired/accept', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
      }, mockEnv);

      expect(res.status).toBe(410);
    });

    it('returns 403 when email does not match', async () => {
      mockDb._setSelectResults([
        [pendingInvitation],
        [{ email: 'other@example.com' }],  // different email
      ]);

      const res = await app.request('/api/organizations/invitations/tok_valid/accept', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
      }, mockEnv);

      expect(res.status).toBe(403);
    });
  });
});
