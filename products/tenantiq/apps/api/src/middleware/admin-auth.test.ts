import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import { platformAdminMiddleware, logAdminAction } from './admin-auth';

describe('platformAdminMiddleware', () => {
	function makeApp(role: string) {
		const app = new Hono<AppEnv>();
		app.use('*', async (c, next) => {
			c.set('userRole', role as any);
			c.set('user', { role } as any);
			await next();
		});
		app.get('/admin/test', platformAdminMiddleware, (c) => c.json({ ok: true }));
		return app;
	}

	it('allows platform_admin', async () => {
		const res = await makeApp('platform_admin').request('/admin/test');
		expect(res.status).toBe(200);
	});

	it('allows super_admin', async () => {
		const res = await makeApp('super_admin').request('/admin/test');
		expect(res.status).toBe(200);
	});

	it('blocks member with 403', async () => {
		const res = await makeApp('member').request('/admin/test');
		expect(res.status).toBe(403);
		const json: any = await res.json();
		expect(json.error).toBe('Forbidden');
	});

	it('blocks admin (non-platform) with 403', async () => {
		const res = await makeApp('admin').request('/admin/test');
		expect(res.status).toBe(403);
	});

	it('blocks empty role with 403', async () => {
		const res = await makeApp('').request('/admin/test');
		expect(res.status).toBe(403);
	});
});

describe('logAdminAction', () => {
	const mockRun = vi.fn().mockResolvedValue(undefined);
	const mockBind = vi.fn(() => ({ run: mockRun }));
	const mockPrepare = vi.fn(() => ({ bind: mockBind }));

	function makeContext(overrides: Record<string, unknown> = {}) {
		return {
			env: { DB: { prepare: mockPrepare } },
			get: (key: string) => {
				const map: Record<string, unknown> = {
					userId: 'user-123',
					user: { sub: 'user-123', orgId: 'org-abc' },
					...overrides,
				};
				return map[key];
			},
			req: {
				header: (name: string) => {
					if (name === 'cf-connecting-ip') return '1.2.3.4';
					return undefined;
				},
			},
		} as any;
	}

	beforeEach(() => vi.clearAllMocks());

	it('inserts audit log row with correct fields', async () => {
		const ctx = makeContext();
		await logAdminAction(ctx, {
			action: 'view_revenue',
			resourceType: 'revenue',
			resourceId: 'sub-1',
			details: { plan: 'pro' },
		});

		expect(mockPrepare).toHaveBeenCalledWith(
			expect.stringContaining('INSERT INTO audit_logs')
		);
		const bindArgs = mockBind.mock.calls[0];
		expect(bindArgs).toContain('user-123');   // userId
		expect(bindArgs).toContain('org-abc');     // orgId
		expect(bindArgs).toContain('view_revenue'); // action
		expect(bindArgs).toContain('revenue');      // resourceType
		expect(bindArgs).toContain('sub-1');        // resourceId
		expect(bindArgs).toContain('1.2.3.4');      // ip
	});

	it('uses x-forwarded-for when cf-connecting-ip absent', async () => {
		const ctx = makeContext();
		ctx.req.header = (name: string) => {
			if (name === 'x-forwarded-for') return '10.0.0.1, 10.0.0.2';
			return undefined;
		};
		await logAdminAction(ctx, { action: 'test' });
		const bindArgs = mockBind.mock.calls[0];
		expect(bindArgs).toContain('10.0.0.1');
	});

	it('falls back to "unknown" IP when no header present', async () => {
		const ctx = makeContext();
		ctx.req.header = () => undefined;
		await logAdminAction(ctx, { action: 'test' });
		const bindArgs = mockBind.mock.calls[0];
		expect(bindArgs).toContain('unknown');
	});

	it('silently swallows DB errors', async () => {
		mockRun.mockRejectedValueOnce(new Error('DB down'));
		const ctx = makeContext();
		await expect(logAdminAction(ctx, { action: 'test' })).resolves.toBeUndefined();
	});

	it('serializes details as JSON string', async () => {
		const ctx = makeContext();
		await logAdminAction(ctx, { action: 'test', details: { key: 'val' } });
		const bindArgs = mockBind.mock.calls[0];
		expect(bindArgs).toContain(JSON.stringify({ key: 'val' }));
	});

	it('passes null for missing optional fields', async () => {
		const ctx = makeContext();
		await logAdminAction(ctx, { action: 'minimal' });
		const bindArgs = mockBind.mock.calls[0];
		// resourceType, resourceId, details should be null
		const nullCount = bindArgs.filter((a: unknown) => a === null).length;
		expect(nullCount).toBeGreaterThanOrEqual(3);
	});
});
