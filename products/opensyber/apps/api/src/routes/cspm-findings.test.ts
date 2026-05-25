import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as any).__mockDb) }));
vi.stubGlobal('fetch', mockAuthFetch());

import { cspmFindingRoutes } from './cspm-findings.js';

describe('CSPM Finding Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;

  const auth = { Authorization: 'Bearer valid-token' };
  const org = { ...auth, 'X-Org-Id': 'org_test' };
  const admin = { id: 'mem1', orgId: 'org_test', userId: 'user_test123', role: 'admin', status: 'active' };
  const viewer = { ...admin, role: 'viewer' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch());
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/cloud', cspmFindingRoutes);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/cloud/findings', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  // ── GET /findings ─────────────────────────────────────────────────
  describe('GET /api/cloud/findings', () => {
    it('returns paginated findings', async () => {
      const findings = [
        { id: 'f1', severity: 'high', status: 'open', resourceType: 's3' },
        { id: 'f2', severity: 'low', status: 'open', resourceType: 'ec2' },
      ];
      mockDb._setSelectResults([[admin], findings]);
      const res = await app.request('/api/cloud/findings', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(2);
      expect(body.hasMore).toBe(false);
    });

    it('returns findings in solo mode', async () => {
      mockDb._setSelectResult([{ id: 'f1', severity: 'critical' }]);
      const res = await app.request('/api/cloud/findings', { headers: auth }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
    });

    it('returns hasMore when result count equals limit', async () => {
      const findings = Array.from({ length: 50 }, (_, i) => ({ id: `f${i}`, severity: 'medium', status: 'open' }));
      mockDb._setSelectResults([[admin], findings]);
      const res = await app.request('/api/cloud/findings', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.hasMore).toBe(true);
    });

    it('returns empty array when no findings', async () => {
      mockDb._setSelectResults([[admin], []]);
      const res = await app.request('/api/cloud/findings', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
    });
  });

  // ── GET /findings/summary ─────────────────────────────────────────
  describe('GET /api/cloud/findings/summary', () => {
    it('returns aggregate counts', async () => {
      const findings = [
        { id: 'f1', severity: 'critical', status: 'open' },
        { id: 'f2', severity: 'high', status: 'open' },
        { id: 'f3', severity: 'high', status: 'resolved' },
        { id: 'f4', severity: 'medium', status: 'muted' },
        { id: 'f5', severity: 'low', status: 'open' },
      ];
      mockDb._setSelectResults([[admin], findings]);
      const res = await app.request('/api/cloud/findings/summary', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.total).toBe(5);
      expect(body.data.critical).toBe(1);
      expect(body.data.high).toBe(2);
      expect(body.data.medium).toBe(1);
      expect(body.data.low).toBe(1);
      expect(body.data.open).toBe(3);
      expect(body.data.resolved).toBe(1);
      expect(body.data.muted).toBe(1);
    });

    it('returns zeros when no findings', async () => {
      mockDb._setSelectResults([[admin], []]);
      const res = await app.request('/api/cloud/findings/summary', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.total).toBe(0);
      expect(body.data.critical).toBe(0);
    });
  });

  // ── PATCH /findings/:id/mute ──────────────────────────────────────
  describe('PATCH /api/cloud/findings/:id/mute', () => {
    it('mutes a finding (admin has cloud.admin)', async () => {
      mockDb._setSelectResults([[admin], [{ id: 'f1', status: 'open' }]]);
      const res = await app.request('/api/cloud/findings/f1/mute', { method: 'PATCH', headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.status).toBe('muted');
      expect(body.data.mutedBy).toBe('user_test123');
      expect(body.data.mutedAt).toBeDefined();
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });

    it('returns 404 for missing finding', async () => {
      mockDb._setSelectResults([[admin], []]);
      const res = await app.request('/api/cloud/findings/f_x/mute', { method: 'PATCH', headers: org }, mockEnv);
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Finding not found');
    });

    it('returns 403 for viewer (lacks cloud.admin)', async () => {
      mockDb._setSelectResults([[viewer]]);
      const res = await app.request('/api/cloud/findings/f1/mute', { method: 'PATCH', headers: org }, mockEnv);
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.message).toContain('cloud.admin');
    });
  });

  // ── PATCH /findings/:id/resolve ───────────────────────────────────
  describe('PATCH /api/cloud/findings/:id/resolve', () => {
    it('resolves a finding (admin has cloud.write)', async () => {
      mockDb._setSelectResults([[admin], [{ id: 'f1', status: 'open' }]]);
      const res = await app.request('/api/cloud/findings/f1/resolve', { method: 'PATCH', headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.status).toBe('resolved');
      expect(body.data.resolvedAt).toBeDefined();
    });

    it('returns 404 for missing finding', async () => {
      mockDb._setSelectResults([[admin], []]);
      const res = await app.request('/api/cloud/findings/f_x/resolve', { method: 'PATCH', headers: org }, mockEnv);
      expect(res.status).toBe(404);
    });

    it('returns 403 for viewer (lacks cloud.write)', async () => {
      mockDb._setSelectResults([[viewer]]);
      const res = await app.request('/api/cloud/findings/f1/resolve', { method: 'PATCH', headers: org }, mockEnv);
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.message).toContain('cloud.write');
    });
  });
});
