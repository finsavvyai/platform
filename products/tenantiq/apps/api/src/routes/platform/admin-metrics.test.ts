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
}));

import adminMetrics from './admin-metrics';

const mockFirst = vi.fn();
const mockAll = vi.fn();
const mockBind = vi.fn((..._a: any[]) => ({ first: mockFirst, all: mockAll }));
const mockPrepare = vi.fn(() => ({ bind: mockBind, first: mockFirst, all: mockAll }));

function makeEnv() {
	return { DB: { prepare: mockPrepare } as any } as any;
}

describe('Admin Metrics Routes', () => {
	let app: Hono<AppEnv>;

	beforeEach(() => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.use('*', async (c, next) => {
			c.set('user', { role: 'platform_admin' } as any);
			c.set('userRole', 'platform_admin');
			await next();
		});
		app.route('/admin', adminMetrics);
	});

	describe('GET /admin/metrics', () => {
		it('returns metrics list', async () => {
			mockAll.mockResolvedValueOnce({
				results: [
					{ id: 'm1', metric_type: 'api_latency', value: 120, metadata: '{"path":"/api"}' },
				],
			});

			const res = await app.request('/admin/metrics', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.metrics).toHaveLength(1);
			expect(json.metrics[0].metadata).toEqual({ path: '/api' });
		});

		it('filters by metric type', async () => {
			mockAll.mockResolvedValueOnce({ results: [] });
			const res = await app.request('/admin/metrics?type=error_rate', {}, makeEnv());
			expect(res.status).toBe(200);
		});

		it('accepts hours parameter', async () => {
			mockAll.mockResolvedValueOnce({ results: [] });
			const res = await app.request('/admin/metrics?hours=48', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.hours).toBe(48);
		});

		it('handles null metadata', async () => {
			mockAll.mockResolvedValueOnce({
				results: [{ id: 'm1', metric_type: 'api_latency', value: 100, metadata: null }],
			});
			const res = await app.request('/admin/metrics', {}, makeEnv());
			const json: any = await res.json();
			expect(json.metrics[0].metadata).toBeNull();
		});

		it('handles DB errors', async () => {
			mockAll.mockRejectedValue(new Error('DB'));
			const res = await app.request('/admin/metrics', {}, makeEnv());
			expect(res.status).toBe(500);
		});
	});

	describe('GET /admin/metrics/summary', () => {
		it('returns aggregated metrics summary', async () => {
			mockFirst
				.mockResolvedValueOnce({ avg_val: 150, max_val: 500, min_val: 30 })
				.mockResolvedValueOnce({ avg_val: 0.02, count: 100 })
				.mockResolvedValueOnce({ avg_val: 45, max_val: 120 })
				.mockResolvedValueOnce({ value: 42 });

			const res = await app.request('/admin/metrics/summary', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.apiLatency.avgMs).toBe(150);
			expect(json.apiLatency.maxMs).toBe(500);
			expect(json.errorRate.avg).toBe(0.02);
			expect(json.syncDuration.avgSec).toBe(45);
			expect(json.activeUsers).toBe(42);
		});

		it('handles null DB results', async () => {
			mockFirst.mockResolvedValue(null);
			const res = await app.request('/admin/metrics/summary', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.apiLatency.avgMs).toBe(0);
			expect(json.activeUsers).toBe(0);
		});

		it('rejects non-admin users', async () => {
			const nonAdminApp = new Hono<AppEnv>();
			nonAdminApp.use('*', async (c, next) => {
				c.set('user', { role: 'viewer' } as any);
				c.set('userRole', 'viewer');
				await next();
			});
			nonAdminApp.route('/admin', adminMetrics);
			const res = await nonAdminApp.request('/admin/metrics/summary', {}, makeEnv());
			expect(res.status).toBe(403);
		});
	});
});
