import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../../app/types';

vi.mock('../../middleware/auth.middleware', () => ({
	authMiddleware: vi.fn(async (_c: any, next: any) => next()),
}));

vi.mock('../../middleware/admin-auth', () => ({
	platformAdminMiddleware: vi.fn(async (c: any, next: any) => {
		const role = c.get('userRole') ?? c.get('user')?.role ?? '';
		if (!['platform_admin', 'super_admin'].includes(role)) {
			return c.json({ error: 'Forbidden' }, 403);
		}
		return next();
	}),
	logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import adminSync from './admin-sync';

const mockFirst = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn();
const mockBind = vi.fn((..._a: any[]) => ({ first: mockFirst, all: mockAll, run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

function makeEnv() {
	return { DB: { prepare: mockPrepare } as any } as any;
}

describe('Admin Sync Routes', () => {
	let app: Hono<AppEnv>;

	beforeEach(() => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.use('*', async (c, next) => {
			c.set('user', { role: 'platform_admin' } as any);
			c.set('userRole', 'platform_admin');
			await next();
		});
		app.route('/admin', adminSync);
	});

	describe('GET /admin/sync-jobs', () => {
		it('returns sync jobs', async () => {
			mockAll
				.mockResolvedValueOnce({ results: [{ id: 'j1', status: 'completed' }] })
				.mockResolvedValueOnce({ results: [{ count: 1 }] });

			const res = await app.request('/admin/sync-jobs', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.jobs).toHaveLength(1);
			expect(json.total).toBe(1);
		});

		it('filters by status', async () => {
			mockAll
				.mockResolvedValueOnce({ results: [] })
				.mockResolvedValueOnce({ results: [{ count: 0 }] });

			const res = await app.request('/admin/sync-jobs?status=failed', {}, makeEnv());
			expect(res.status).toBe(200);
		});

		it('filters by tenantId', async () => {
			mockAll
				.mockResolvedValueOnce({ results: [] })
				.mockResolvedValueOnce({ results: [{ count: 0 }] });

			const res = await app.request('/admin/sync-jobs?tenantId=t1', {}, makeEnv());
			expect(res.status).toBe(200);
		});

		it('handles DB errors', async () => {
			mockAll.mockRejectedValue(new Error('DB error'));
			const res = await app.request('/admin/sync-jobs', {}, makeEnv());
			expect(res.status).toBe(500);
		});
	});

	describe('POST /admin/sync-jobs/:id/retry', () => {
		it('retries a failed job', async () => {
			mockFirst.mockResolvedValueOnce({
				id: 'j1', status: 'failed', tenant_id: 't1', type: 'full', org_id: 'org1',
			});
			mockRun.mockResolvedValueOnce({ success: true });

			const res = await app.request('/admin/sync-jobs/j1/retry', { method: 'POST' }, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.newJobId).toBeDefined();
		});

		it('returns 404 for non-existent job', async () => {
			mockFirst.mockResolvedValueOnce(null);
			const res = await app.request('/admin/sync-jobs/bad/retry', { method: 'POST' }, makeEnv());
			expect(res.status).toBe(404);
		});

		it('rejects retry of non-failed job', async () => {
			mockFirst.mockResolvedValueOnce({ id: 'j1', status: 'completed' });
			const res = await app.request('/admin/sync-jobs/j1/retry', { method: 'POST' }, makeEnv());
			expect(res.status).toBe(400);
		});

		it('rejects non-admin users', async () => {
			const nonAdminApp = new Hono<AppEnv>();
			nonAdminApp.use('*', async (c, next) => {
				c.set('user', { role: 'viewer' } as any);
				c.set('userRole', 'viewer');
				await next();
			});
			nonAdminApp.route('/admin', adminSync);
			const res = await nonAdminApp.request('/admin/sync-jobs/j1/retry', { method: 'POST' }, makeEnv());
			expect(res.status).toBe(403);
		});
	});
});
