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

import adminRevenue from './admin-revenue';

const mockFirst = vi.fn();
const mockAll = vi.fn();
const mockBind = vi.fn((..._a: any[]) => ({ first: mockFirst, all: mockAll }));
const mockPrepare = vi.fn(() => ({ bind: mockBind, first: mockFirst, all: mockAll }));

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
	app.route('/', adminRevenue);
	return app;
}

describe('Admin Revenue Routes', () => {
	beforeEach(() => vi.clearAllMocks());

	describe('GET /revenue', () => {
		it('returns full revenue metrics', async () => {
			mockAll
				.mockResolvedValueOnce({
					results: [
						{ tier: 'professional', count: 6 }, // 6 × $199 = $1194
						{ tier: 'core', count: 4 },          // 4 × $79  = $316
					],
				})
				.mockResolvedValueOnce({ results: [] }); // recent subs
			mockFirst.mockResolvedValueOnce({ count: 2 }); // churned last 30d

			const res = await makeApp().request('/revenue', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.mrr).toBeCloseTo(1510); // 6*199 + 4*79
			expect(json.arr).toBeCloseTo(1510 * 12);
			expect(json.activeSubs).toBe(10);
			expect(json.planDistribution).toHaveLength(2);
			expect(json.planDistribution[0].plan).toBe('professional');
		});

		it('handles zero subscriptions without division error', async () => {
			mockAll
				.mockResolvedValueOnce({ results: [] })
				.mockResolvedValueOnce({ results: [] });
			mockFirst.mockResolvedValueOnce({ count: 0 });

			const res = await makeApp().request('/revenue', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.mrr).toBe(0);
			expect(json.arpu).toBe(0);
			expect(json.churnRate).toBe(0);
		});

		it('calculates churn rate correctly', async () => {
			// 8 active + 2 churned = 10 at start → 20% churn
			mockAll
				.mockResolvedValueOnce({ results: [{ tier: 'core', count: 8 }] })
				.mockResolvedValueOnce({ results: [] });
			mockFirst.mockResolvedValueOnce({ count: 2 });

			const res = await makeApp().request('/revenue', {}, makeEnv());
			const json: any = await res.json();
			expect(json.churnRate).toBe(20);
			expect(json.churnedLast30d).toBe(2);
		});

		it('returns 500 on DB error', async () => {
			mockAll.mockRejectedValue(new Error('DB failure'));
			const res = await makeApp().request('/revenue', {}, makeEnv());
			expect(res.status).toBe(500);
		});

		it('blocks non-admin with 403', async () => {
			const res = await makeApp('member').request('/revenue', {}, makeEnv());
			expect(res.status).toBe(403);
		});
	});
});
