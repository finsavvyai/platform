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

import adminAlerts from './admin-alerts';

const mockFirst = vi.fn();
const mockBind = vi.fn((..._a: any[]) => ({ first: mockFirst }));
const mockPrepare = vi.fn(() => ({ bind: mockBind, first: mockFirst }));

function makeEnv() {
	return { DB: { prepare: mockPrepare } as any } as any;
}

describe('Admin System Alerts Routes', () => {
	let app: Hono<AppEnv>;

	beforeEach(() => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.use('*', async (c, next) => {
			c.set('user', { role: 'platform_admin' } as any);
			c.set('userRole', 'platform_admin');
			await next();
		});
		app.route('/admin', adminAlerts);
	});

	describe('GET /admin/system-alerts', () => {
		it('returns no alerts when all healthy', async () => {
			mockFirst
				.mockResolvedValueOnce({ count: 0 })   // sync failures
				.mockResolvedValueOnce({ count: 0 })   // stale tenants
				.mockResolvedValueOnce({ count: 0 });   // active alerts

			const res = await app.request('/admin/system-alerts', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.alerts).toHaveLength(0);
		});

		it('detects sync failures', async () => {
			mockFirst
				.mockResolvedValueOnce({ count: 10 })
				.mockResolvedValueOnce({ count: 0 })
				.mockResolvedValueOnce({ count: 0 });

			const res = await app.request('/admin/system-alerts', {}, makeEnv());
			const json: any = await res.json();
			const syncAlert = json.alerts.find((a: any) => a.type === 'sync_failures');
			expect(syncAlert).toBeDefined();
			expect(syncAlert.severity).toBe('high');
			expect(syncAlert.title).toContain('10');
		});

		it('escalates sync failures to critical above 20', async () => {
			mockFirst
				.mockResolvedValueOnce({ count: 25 })
				.mockResolvedValueOnce({ count: 0 })
				.mockResolvedValueOnce({ count: 0 });

			const res = await app.request('/admin/system-alerts', {}, makeEnv());
			const json: any = await res.json();
			const syncAlert = json.alerts.find((a: any) => a.type === 'sync_failures');
			expect(syncAlert.severity).toBe('critical');
		});

		it('detects stale tenants', async () => {
			mockFirst
				.mockResolvedValueOnce({ count: 0 })
				.mockResolvedValueOnce({ count: 3 })
				.mockResolvedValueOnce({ count: 0 });

			const res = await app.request('/admin/system-alerts', {}, makeEnv());
			const json: any = await res.json();
			const staleAlert = json.alerts.find((a: any) => a.type === 'stale_tenant');
			expect(staleAlert).toBeDefined();
			expect(staleAlert.severity).toBe('medium');
		});

		it('detects high active alert count', async () => {
			mockFirst
				.mockResolvedValueOnce({ count: 0 })
				.mockResolvedValueOnce({ count: 0 })
				.mockResolvedValueOnce({ count: 15 });

			const res = await app.request('/admin/system-alerts', {}, makeEnv());
			const json: any = await res.json();
			const alertsAlert = json.alerts.find((a: any) => a.type === 'error_rate');
			expect(alertsAlert).toBeDefined();
			expect(alertsAlert.title).toContain('15');
		});

		it('returns multiple alerts at once', async () => {
			mockFirst
				.mockResolvedValueOnce({ count: 8 })
				.mockResolvedValueOnce({ count: 2 })
				.mockResolvedValueOnce({ count: 12 });

			const res = await app.request('/admin/system-alerts', {}, makeEnv());
			const json: any = await res.json();
			expect(json.alerts).toHaveLength(3);
		});

		it('handles DB errors with 500', async () => {
			mockFirst.mockRejectedValue(new Error('DB'));
			const res = await app.request('/admin/system-alerts', {}, makeEnv());
			expect(res.status).toBe(500);
		});

		it('rejects non-admin users', async () => {
			const nonAdminApp = new Hono<AppEnv>();
			nonAdminApp.use('*', async (c, next) => {
				c.set('user', { role: 'tenant_admin' } as any);
				c.set('userRole', 'tenant_admin');
				await next();
			});
			nonAdminApp.route('/admin', adminAlerts);
			const res = await nonAdminApp.request('/admin/system-alerts', {}, makeEnv());
			expect(res.status).toBe(403);
		});
	});
});
