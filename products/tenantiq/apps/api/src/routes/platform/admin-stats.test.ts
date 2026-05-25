import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../../app/types';

vi.mock('../../middleware/auth', () => ({
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

import adminStats from './admin-stats';

const mockAll = vi.fn();
const mockPrepare = vi.fn(() => ({ all: mockAll }));

function makeEnv() {
	return { DB: { prepare: mockPrepare } as any } as any;
}

function makeApp(role = 'platform_admin') {
	const app = new Hono<AppEnv>();
	app.use('*', async (c, next) => {
		c.set('user', { role, sub: 'admin-1' } as any);
		c.set('userRole', role as any);
		await next();
	});
	app.route('/', adminStats);
	return app;
}

const sampleUsers = [
	{ id: 'u1', email: 'a@test.com', name: 'Alice', role: 'member', status: 'active', last_login_at: 1000, created_at: '2026-01-01' },
	{ id: 'u2', email: 'b@test.com', name: 'Bob', role: 'member', status: 'inactive', last_login_at: 500, created_at: '2026-01-02' },
];

const sampleOrgs = [
	{ id: 'o1', name: 'Org A', billing_plan: 'professional', status: 'active', created_at: '2026-01-01' },
	{ id: 'o2', name: 'Org B', billing_plan: 'core', status: 'active', created_at: '2026-01-02' },
];

describe('Admin Stats Routes', () => {
	beforeEach(() => vi.clearAllMocks());

	describe('GET /stats', () => {
		it('returns user and org stats', async () => {
			mockAll
				.mockResolvedValueOnce({ results: sampleUsers })
				.mockResolvedValueOnce({ results: sampleOrgs });

			const res = await makeApp().request('/stats', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.totalUsers).toBe(2);
			expect(json.activeUsers).toBe(1);
			expect(json.totalOrgs).toBe(2);
		});

		it('calculates monthly revenue from plan prices', async () => {
			mockAll
				.mockResolvedValueOnce({ results: [] })
				.mockResolvedValueOnce({ results: [
					{ id: 'o1', billing_plan: 'professional' },
					{ id: 'o2', billing_plan: 'core' },
					{ id: 'o3', billing_plan: 'security_suite' },
				]});

			const res = await makeApp().request('/stats', {}, makeEnv());
			const json: any = await res.json();
			// professional=199 + core=79 + security_suite=399
			expect(json.monthlyRevenue).toBe(677);
		});

		it('returns recent signups (first 10)', async () => {
			mockAll
				.mockResolvedValueOnce({ results: sampleUsers })
				.mockResolvedValueOnce({ results: [] });

			const res = await makeApp().request('/stats', {}, makeEnv());
			const json: any = await res.json();
			expect(json.recentSignups).toHaveLength(2);
			expect(json.recentSignups[0]).toMatchObject({ id: 'u1', email: 'a@test.com' });
		});

		it('returns recent logins sorted by last_login_at desc', async () => {
			mockAll
				.mockResolvedValueOnce({ results: sampleUsers })
				.mockResolvedValueOnce({ results: [] });

			const res = await makeApp().request('/stats', {}, makeEnv());
			const json: any = await res.json();
			// Only u1 and u2 have last_login_at; u1=1000 > u2=500
			expect(json.recentLogins[0].id).toBe('u1');
		});

		it('returns empty defaults on DB error', async () => {
			mockAll.mockRejectedValue(new Error('DB error'));
			const res = await makeApp().request('/stats', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.totalUsers).toBe(0);
			expect(json.monthlyRevenue).toBe(0);
		});

		it('blocks non-admin with 403', async () => {
			const res = await makeApp('member').request('/stats', {}, makeEnv());
			expect(res.status).toBe(403);
		});
	});
});
