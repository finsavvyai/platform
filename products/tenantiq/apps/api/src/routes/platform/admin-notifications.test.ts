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

import adminNotifications from './admin-notifications';

const mockAllUsers = vi.fn();
const mockBindUsers = vi.fn((..._a: any[]) => ({ all: mockAllUsers }));
const mockPrepare = vi.fn(() => ({ bind: mockBindUsers, all: mockAllUsers }));

const mockKvPut = vi.fn().mockResolvedValue(undefined);
const mockKvGet = vi.fn().mockResolvedValue(null);
const mockKvDelete = vi.fn().mockResolvedValue(undefined);
const mockKvList = vi.fn().mockResolvedValue({ keys: [] });

function makeEnv() {
	return {
		DB: { prepare: mockPrepare } as any,
		KV: { put: mockKvPut, get: mockKvGet, delete: mockKvDelete, list: mockKvList } as any,
	} as any;
}

function makeApp(role = 'platform_admin') {
	const app = new Hono<AppEnv>();
	app.use('*', async (c, next) => {
		c.set('user', { role, sub: 'admin-1' } as any);
		c.set('userRole', role as any);
		c.set('userId', 'admin-1' as any);
		await next();
	});
	app.route('/', adminNotifications);
	return app;
}

const validBroadcast = {
	targetType: 'all_users',
	title: 'Maintenance',
	message: 'Scheduled downtime',
	type: 'warning',
};

describe('Admin Notifications Routes', () => {
	beforeEach(() => vi.clearAllMocks());

	describe('POST /broadcast', () => {
		it('sends to all active users', async () => {
			mockAllUsers.mockResolvedValueOnce({ results: [{ id: 'u1' }, { id: 'u2' }] });

			const res = await makeApp().request('/broadcast', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(validBroadcast),
			}, makeEnv());

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.sent).toBe(2);
			expect(json.targetType).toBe('all_users');
			expect(mockKvPut).toHaveBeenCalledTimes(3); // 2 users + 1 history
		});

		it('sends to org-scoped users when targetType is org_users', async () => {
			mockAllUsers.mockResolvedValueOnce({ results: [{ id: 'u3' }] });

			const res = await makeApp().request('/broadcast', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...validBroadcast, targetType: 'org_users', orgId: 'org-1' }),
			}, makeEnv());

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.sent).toBe(1);
		});

		it('returns 400 when org_users missing orgId', async () => {
			const res = await makeApp().request('/broadcast', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...validBroadcast, targetType: 'org_users' }),
			}, makeEnv());
			expect(res.status).toBe(400);
		});

		it('returns 400 for invalid type', async () => {
			const res = await makeApp().request('/broadcast', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...validBroadcast, type: 'critical' }),
			}, makeEnv());
			expect(res.status).toBe(400);
		});

		it('returns 400 when required fields missing', async () => {
			const res = await makeApp().request('/broadcast', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetType: 'all_users' }),
			}, makeEnv());
			expect(res.status).toBe(400);
		});

		it('blocks non-admin with 403', async () => {
			const res = await makeApp('member').request('/broadcast', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(validBroadcast),
			}, makeEnv());
			expect(res.status).toBe(403);
		});
	});

	describe('GET /history', () => {
		it('returns broadcast history from KV', async () => {
			const history = [
				{ id: 'n1', title: 'Alert', message: 'msg', type: 'info', sentBy: 'u', sentAt: '2026-01-01T00:00:00Z', targetType: 'all_users' },
			];
			mockKvGet.mockResolvedValueOnce(history);

			const res = await makeApp().request('/history', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.broadcasts).toHaveLength(1);
		});

		it('returns empty when no history', async () => {
			mockKvGet.mockResolvedValueOnce(null);
			const res = await makeApp().request('/history', {}, makeEnv());
			const json: any = await res.json();
			expect(json.broadcasts).toHaveLength(0);
		});

		it('blocks non-admin with 403', async () => {
			const res = await makeApp('member').request('/history', {}, makeEnv());
			expect(res.status).toBe(403);
		});
	});

	describe('GET /mine', () => {
		it('returns notifications for current user (accessible to non-admin)', async () => {
			const notif = { id: 'n1', title: 'Hello', message: 'msg', type: 'info', sentBy: 'admin', sentAt: '2026-01-01T00:00:00Z', targetType: 'all_users' };
			mockKvList.mockResolvedValueOnce({ keys: [{ name: 'admin-notification:admin-1:n1' }] });
			mockKvGet.mockResolvedValueOnce(notif);

			const res = await makeApp('member').request('/mine', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.notifications).toHaveLength(1);
		});

		it('returns empty when no notifications', async () => {
			mockKvList.mockResolvedValueOnce({ keys: [] });
			const res = await makeApp('member').request('/mine', {}, makeEnv());
			const json: any = await res.json();
			expect(json.notifications).toHaveLength(0);
		});
	});

	describe('POST /mine/:id/read', () => {
		it('deletes notification from KV', async () => {
			const res = await makeApp('member').request('/mine/notif-123/read', {
				method: 'POST',
			}, makeEnv());
			expect(res.status).toBe(200);
			expect(mockKvDelete).toHaveBeenCalledWith('admin-notification:admin-1:notif-123');
		});
	});
});
