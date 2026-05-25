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

import adminAudit from './admin-audit';

const mockAll = vi.fn();
const mockBind = vi.fn((..._a: any[]) => ({ all: mockAll }));
const mockPrepare = vi.fn(() => ({ bind: mockBind, all: mockAll }));

function makeEnv() {
	return { DB: { prepare: mockPrepare } as any } as any;
}

describe('Admin Audit Routes', () => {
	let app: Hono<AppEnv>;

	beforeEach(() => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.use('*', async (c, next) => {
			c.set('user', { role: 'super_admin' } as any);
			c.set('userRole', 'super_admin');
			await next();
		});
		app.route('/admin', adminAudit);
	});

	describe('GET /admin/audit-logs', () => {
		it('returns paginated audit logs', async () => {
			mockAll
				.mockResolvedValueOnce({
					results: [{
						id: 'log1', action: 'view_tenants', user_id: 'u1',
						user_email: 'a@t.com', details: '{"page":1}',
					}],
				})
				.mockResolvedValueOnce({ results: [{ count: 1 }] });

			const res = await app.request('/admin/audit-logs', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.logs).toHaveLength(1);
			expect(json.logs[0].details).toEqual({ page: 1 });
			expect(json.total).toBe(1);
		});

		it('filters by action', async () => {
			mockAll
				.mockResolvedValueOnce({ results: [] })
				.mockResolvedValueOnce({ results: [{ count: 0 }] });

			const res = await app.request('/admin/audit-logs?action=retry_sync_job', {}, makeEnv());
			expect(res.status).toBe(200);
		});

		it('filters by userId', async () => {
			mockAll
				.mockResolvedValueOnce({ results: [] })
				.mockResolvedValueOnce({ results: [{ count: 0 }] });

			const res = await app.request('/admin/audit-logs?userId=u1', {}, makeEnv());
			expect(res.status).toBe(200);
		});

		it('filters by resourceType', async () => {
			mockAll
				.mockResolvedValueOnce({ results: [] })
				.mockResolvedValueOnce({ results: [{ count: 0 }] });

			const res = await app.request('/admin/audit-logs?resourceType=tenant', {}, makeEnv());
			expect(res.status).toBe(200);
		});

		it('handles null details', async () => {
			mockAll
				.mockResolvedValueOnce({ results: [{ id: 'log1', details: null }] })
				.mockResolvedValueOnce({ results: [{ count: 1 }] });

			const res = await app.request('/admin/audit-logs', {}, makeEnv());
			const json: any = await res.json();
			expect(json.logs[0].details).toBeNull();
		});

		it('handles DB errors', async () => {
			mockAll.mockRejectedValue(new Error('DB'));
			const res = await app.request('/admin/audit-logs', {}, makeEnv());
			expect(res.status).toBe(500);
		});

		it('rejects non-admin users', async () => {
			const nonAdminApp = new Hono<AppEnv>();
			nonAdminApp.use('*', async (c, next) => {
				c.set('user', { role: 'viewer' } as any);
				c.set('userRole', 'viewer');
				await next();
			});
			nonAdminApp.route('/admin', adminAudit);
			const res = await nonAdminApp.request('/admin/audit-logs', {}, makeEnv());
			expect(res.status).toBe(403);
		});
	});

	describe('GET /admin/audit-logs/actions', () => {
		it('returns distinct action types', async () => {
			mockAll.mockResolvedValueOnce({
				results: [{ action: 'view_tenants' }, { action: 'retry_sync_job' }],
			});

			const res = await app.request('/admin/audit-logs/actions', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.actions).toEqual(['view_tenants', 'retry_sync_job']);
		});

		it('handles DB errors', async () => {
			mockAll.mockRejectedValue(new Error('DB'));
			const res = await app.request('/admin/audit-logs/actions', {}, makeEnv());
			expect(res.status).toBe(500);
		});
	});
});
