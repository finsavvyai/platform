import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../../app/types';

// Mock the middleware modules before importing routes
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

import adminOverview from './admin-overview';

const mockFirst = vi.fn();
const mockAll = vi.fn();
const mockBind = vi.fn((..._a: any[]) => ({ first: mockFirst, all: mockAll }));
const mockPrepare = vi.fn(() => ({ bind: mockBind, first: mockFirst, all: mockAll }));

function makeEnv() {
	return { DB: { prepare: mockPrepare } as any } as any;
}

describe('Admin Overview Routes', () => {
	let app: Hono<AppEnv>;

	beforeEach(() => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		// Inject user context via middleware
		app.use('*', async (c, next) => {
			c.set('user', { role: 'platform_admin' } as any);
			c.set('userRole', 'platform_admin');
			await next();
		});
		app.route('/admin', adminOverview);
	});

	describe('GET /admin/overview', () => {
		it('returns platform stats', async () => {
			mockFirst
				.mockResolvedValueOnce({ count: 15 })   // tenants
				.mockResolvedValueOnce({ count: 200 })   // users
				.mockResolvedValueOnce({ count: 5 })     // orgs
				.mockResolvedValueOnce({ count: 3 });    // active alerts
			mockAll.mockResolvedValueOnce({
				results: [
					{ status: 'completed', count: 10 },
					{ status: 'failed', count: 2 },
				],
			});

			const res = await app.request('/admin/overview', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.totalTenants).toBe(15);
			expect(json.totalUsers).toBe(200);
			expect(json.totalOrgs).toBe(5);
			expect(json.syncJobs24h.completed).toBe(10);
			expect(json.syncJobs24h.failed).toBe(2);
		});

		it('handles DB errors with 500', async () => {
			mockFirst.mockRejectedValue(new Error('DB error'));
			const res = await app.request('/admin/overview', {}, makeEnv());
			expect(res.status).toBe(500);
		});
	});

	describe('GET /admin/tenants', () => {
		it('returns paginated tenant list', async () => {
			mockAll.mockResolvedValueOnce({
				results: [{ id: 't1', display_name: 'Tenant 1' }],
			});
			mockFirst.mockResolvedValueOnce({ count: 1 });

			const res = await app.request('/admin/tenants', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.tenants).toHaveLength(1);
			expect(json.total).toBe(1);
			expect(json.page).toBe(1);
		});

		it('respects page and limit params', async () => {
			mockAll.mockResolvedValueOnce({ results: [] });
			mockFirst.mockResolvedValueOnce({ count: 0 });

			const res = await app.request('/admin/tenants?page=2&limit=10', {}, makeEnv());
			const json: any = await res.json();
			expect(json.page).toBe(2);
			expect(json.limit).toBe(10);
		});
	});

	describe('Admin auth rejection', () => {
		it('rejects non-admin users with 403', async () => {
			const nonAdminApp = new Hono<AppEnv>();
			nonAdminApp.use('*', async (c, next) => {
				c.set('user', { role: 'viewer' } as any);
				c.set('userRole', 'viewer');
				await next();
			});
			nonAdminApp.route('/admin', adminOverview);

			const res = await nonAdminApp.request('/admin/overview', {}, makeEnv());
			expect(res.status).toBe(403);
		});
	});
});
