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

import adminAnnouncements from './admin-announcements';

const mockRun = vi.fn().mockResolvedValue(undefined);
const mockFirst = vi.fn();
const mockAll = vi.fn();
const mockBind = vi.fn((..._a: any[]) => ({ run: mockRun, first: mockFirst, all: mockAll }));
const mockPrepare = vi.fn(() => ({ bind: mockBind, all: mockAll, run: mockRun }));

function makeEnv(dbOverrides: Record<string, unknown> = {}) {
	return { DB: { prepare: mockPrepare, ...dbOverrides } as any } as any;
}

function makeApp(role = 'platform_admin') {
	const app = new Hono<AppEnv>();
	app.use('*', async (c, next) => {
		c.set('user', { role, sub: 'admin-1' } as any);
		c.set('userRole', role as any);
		await next();
	});
	app.route('/', adminAnnouncements);
	return app;
}

describe('Admin Announcements Routes', () => {
	beforeEach(() => vi.clearAllMocks());

	describe('GET /active (public)', () => {
		it('returns active announcements without auth', async () => {
			const rows = [{ id: 'a1', title: 'Notice', message: 'msg', type: 'info', expires_at: null }];
			mockAll.mockResolvedValueOnce({ results: rows });

			const app = new Hono<AppEnv>();
			app.route('/', adminAnnouncements);
			const res = await app.request('/active', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.announcements).toHaveLength(1);
		});

		it('returns empty array when announcements table missing', async () => {
			mockPrepare.mockImplementationOnce(() => ({
				bind: () => ({ all: () => { throw new Error('no such table: announcements'); } }),
			}));

			const app = new Hono<AppEnv>();
			app.route('/', adminAnnouncements);
			const res = await app.request('/active', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.announcements).toEqual([]);
		});

		it('rethrows non-table errors', async () => {
			mockPrepare.mockImplementationOnce(() => ({
				bind: () => ({ all: () => { throw new Error('connection lost'); } }),
			}));

			const app = new Hono<AppEnv>();
			app.route('/', adminAnnouncements);
			const res = await app.request('/active', {}, makeEnv());
			expect(res.status).toBe(500);
		});
	});

	describe('GET /admin/list', () => {
		it('returns all announcements for admin', async () => {
			const rows = [{ id: 'a1', title: 'T', message: 'M', type: 'info', active: 1 }];
			mockAll.mockResolvedValueOnce({ results: rows });

			const res = await makeApp().request('/admin/list', {}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.announcements).toHaveLength(1);
		});

		it('blocks non-admin with 403', async () => {
			const res = await makeApp('member').request('/admin/list', {}, makeEnv());
			expect(res.status).toBe(403);
		});
	});

	describe('POST /admin/create', () => {
		const validBody = {
			title: 'Scheduled Maintenance',
			message: 'System will be down for 2 hours.',
			type: 'maintenance',
		};

		it('creates announcement and logs action', async () => {
			const { logAdminAction } = await import('../../middleware/admin-auth');
			const res = await makeApp().request('/admin/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(validBody),
			}, makeEnv());

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.id).toBeTruthy();
			expect(logAdminAction).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ action: 'create_announcement' })
			);
		});

		it('returns 422 for missing title', async () => {
			const res = await makeApp().request('/admin/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: 'msg', type: 'info' }),
			}, makeEnv());
			expect(res.status).toBe(422);
		});

		it('returns 422 for invalid type', async () => {
			const res = await makeApp().request('/admin/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...validBody, type: 'critical' }),
			}, makeEnv());
			expect(res.status).toBe(422);
		});

		it('blocks non-admin with 403', async () => {
			const res = await makeApp('member').request('/admin/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(validBody),
			}, makeEnv());
			expect(res.status).toBe(403);
		});
	});

	describe('PUT /admin/:id', () => {
		it('updates announcement fields', async () => {
			const res = await makeApp().request('/admin/ann-1', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ active: false }),
			}, makeEnv());
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
		});

		it('returns 422 for invalid partial update', async () => {
			const res = await makeApp().request('/admin/ann-1', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'unknown_type' }),
			}, makeEnv());
			expect(res.status).toBe(422);
		});
	});

	describe('DELETE /admin/:id', () => {
		it('deletes announcement and logs action', async () => {
			const { logAdminAction } = await import('../../middleware/admin-auth');
			const res = await makeApp().request('/admin/ann-1', {
				method: 'DELETE',
			}, makeEnv());
			expect(res.status).toBe(200);
			expect(logAdminAction).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ action: 'delete_announcement', resourceId: 'ann-1' })
			);
		});
	});
});
