import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { loadPlanConfig, requirePlanFeature, requirePlanLimit } from './plan-enforcement';
import { users, organizations } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { createMockDb, createMockEnv } from '../test/helpers.js';

vi.mock('@opensyber/db', () => ({
  users: {},
  organizations: {},
}));

describe('plan-enforcement middleware', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;
  let app: Hono<{ Bindings: Env; Variables: Variables }>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockEnv = createMockEnv();
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
  });

  describe('loadPlanConfig', () => {
    it('should load user plan in solo mode (no X-Org-Id)', async () => {
      app.use('*', async (c, next) => {
        c.set('userId', 'user-123');
        c.set('db', mockDb);
        return loadPlanConfig(c, next);
      });
      app.get('/test', (c) => c.json(c.get('planConfig')));

      vi.spyOn(mockDb, 'select').mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ plan: 'free' }]),
      } as unknown as ReturnType<typeof mockDb.select>);

      const res = await app.request('/test', {}, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.plan).toBe('free');
      expect(json.isOrg).toBe(false);
    });

    it('should load org plan when X-Org-Id header is present', async () => {
      app.use('*', async (c, next) => {
        c.set('userId', 'user-123');
        c.set('db', mockDb);
        return loadPlanConfig(c, next);
      });
      app.get('/test', (c) => c.json(c.get('planConfig')));

      vi.spyOn(mockDb, 'select').mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ plan: 'team' }]),
      } as unknown as ReturnType<typeof mockDb.select>);

      const res = await app.request('/test', {
        headers: { 'X-Org-Id': 'org-456' },
      }, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.plan).toBe('team');
      expect(json.isOrg).toBe(true);
    });

    it('should return 404 when user not found', async () => {
      app.use('*', async (c, next) => {
        c.set('userId', 'user-123');
        c.set('db', mockDb);
        return loadPlanConfig(c, next);
      });
      app.get('/test', (c) => c.json(c.get('planConfig')));

      vi.spyOn(mockDb, 'select').mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof mockDb.select>);

      const res = await app.request('/test', {}, mockEnv);

      expect(res.status).toBe(404);
    });

    it('should return 404 when org not found', async () => {
      app.use('*', async (c, next) => {
        c.set('userId', 'user-123');
        c.set('db', mockDb);
        return loadPlanConfig(c, next);
      });
      app.get('/test', (c) => c.json(c.get('planConfig')));

      vi.spyOn(mockDb, 'select').mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof mockDb.select>);

      const res = await app.request('/test', {
        headers: { 'X-Org-Id': 'org-456' },
      }, mockEnv);

      expect(res.status).toBe(404);
    });
  });

  describe('requirePlanFeature', () => {
    beforeEach(() => {
      app.use('*', async (c, next) => {
        c.set('userId', 'user-123');
        c.set('db', mockDb);
        return loadPlanConfig(c, next);
      });
    });

    it('should allow access when feature is available', async () => {
      app.get('/test', requirePlanFeature('cloudSync'), (c) => c.json({ ok: true }));

      vi.spyOn(mockDb, 'select').mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ plan: 'pro' }]), // pro has cloudSync: true
      } as unknown as ReturnType<typeof mockDb.select>);

      const res = await app.request('/test', {}, mockEnv);

      expect(res.status).toBe(200);
    });

    it('should deny access when feature is not available', async () => {
      app.get('/test', requirePlanFeature('cloudSync'), (c) => c.json({ ok: true }));

      vi.spyOn(mockDb, 'select').mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ plan: 'free' }]), // free has cloudSync: false
      } as unknown as ReturnType<typeof mockDb.select>);

      const res = await app.request('/test', {}, mockEnv);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('Forbidden');
      expect(json.upgradeRequired).toBe(true);
    });
  });

  describe('requirePlanLimit', () => {
    beforeEach(() => {
      app.use('*', async (c, next) => {
        c.set('userId', 'user-123');
        c.set('db', mockDb);
        return loadPlanConfig(c, next);
      });
    });

    it('should allow access when under limit', async () => {
      app.get('/test', requirePlanLimit('cspmAccounts', 2), (c) => c.json({ ok: true }));

      vi.spyOn(mockDb, 'select').mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ plan: 'pro' }]), // pro has cspmAccounts: 3
      } as unknown as ReturnType<typeof mockDb.select>);

      const res = await app.request('/test', {}, mockEnv);

      expect(res.status).toBe(200);
    });

    it('should deny access when at or over limit', async () => {
      app.get('/test', requirePlanLimit('cspmAccounts', 3), (c) => c.json({ ok: true }));

      vi.spyOn(mockDb, 'select').mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ plan: 'pro' }]), // pro has cspmAccounts: 3
      } as unknown as ReturnType<typeof mockDb.select>);

      const res = await app.request('/test', {}, mockEnv);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('Forbidden');
      expect(json.upgradeRequired).toBe(true);
      expect(json.limit).toBe(3);
      expect(json.current).toBe(3);
    });
  });
});
