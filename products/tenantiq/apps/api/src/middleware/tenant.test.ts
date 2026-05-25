import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import { tenantMiddleware } from './tenant';

const mockFirst = vi.fn();
const mockBind = vi.fn(() => ({ first: mockFirst }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

function makeEnv() {
	return { DB: { prepare: mockPrepare } as any } as any;
}

function makeApp(userOverrides: Record<string, unknown> = {}) {
	const app = new Hono<AppEnv>();
	app.use('*', async (c, next) => {
		c.set('user', {
			sub: 'user-1',
			orgId: 'org-1',
			role: 'member',
			tenantIds: ['tenant-1'],
			email: '',
			name: '',
			...userOverrides,
		} as any);
		await next();
	});
	app.get('/tenants/:tenantId/data', tenantMiddleware, (c) =>
		c.json({ ok: true, tenantId: c.get('tenantId') })
	);
	return app;
}

describe('tenantMiddleware', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns 400 when no tenantId param', async () => {
		const app = new Hono<AppEnv>();
		app.use('*', async (c, next) => {
			c.set('user', { sub: 'u', orgId: 'o', role: 'member' } as any);
			await next();
		});
		app.get('/no-param', tenantMiddleware, (c) => c.json({ ok: true }));
		const res = await app.request('/no-param', {}, makeEnv());
		expect(res.status).toBe(400);
	});

	it('returns 401 when user has no orgId', async () => {
		const app = makeApp({ orgId: '' });
		const res = await app.request('/tenants/tenant-1/data', {}, makeEnv());
		expect(res.status).toBe(401);
	});

	it('returns 401 when user object missing', async () => {
		const app = new Hono<AppEnv>();
		app.get('/tenants/:tenantId/data', tenantMiddleware, (c) => c.json({ ok: true }));
		const res = await app.request('/tenants/tenant-1/data', {}, makeEnv());
		expect(res.status).toBe(401);
	});

	it('allows platform_admin to bypass DB check', async () => {
		const app = makeApp({ role: 'platform_admin', orgId: 'org-1' });
		const res = await app.request('/tenants/any-tenant/data', {}, makeEnv());
		expect(res.status).toBe(200);
		expect(mockPrepare).not.toHaveBeenCalled();
		const json: any = await res.json();
		expect(json.tenantId).toBe('any-tenant');
	});

	it('allows super_admin to bypass DB check', async () => {
		const app = makeApp({ role: 'super_admin', orgId: 'org-1' });
		const res = await app.request('/tenants/other-tenant/data', {}, makeEnv());
		expect(res.status).toBe(200);
		expect(mockPrepare).not.toHaveBeenCalled();
	});

	it('allows regular user when tenant belongs to their org (DB confirms)', async () => {
		mockFirst.mockResolvedValueOnce({ id: 'tenant-1' });
		const app = makeApp({ role: 'member', orgId: 'org-1' });
		const res = await app.request('/tenants/tenant-1/data', {}, makeEnv());
		expect(res.status).toBe(200);
		expect(mockBind).toHaveBeenCalledWith('tenant-1', 'org-1');
		const json: any = await res.json();
		expect(json.tenantId).toBe('tenant-1');
	});

	it('blocks regular user when tenant not in their org (DB returns null)', async () => {
		mockFirst.mockResolvedValueOnce(null);
		const app = makeApp({ role: 'member', orgId: 'org-1' });
		const res = await app.request('/tenants/other-org-tenant/data', {}, makeEnv());
		expect(res.status).toBe(403);
		const json: any = await res.json();
		expect(json.error.code).toBe('FORBIDDEN');
	});

	it('queries DB with correct org scoping', async () => {
		mockFirst.mockResolvedValueOnce({ id: 'tenant-x' });
		const app = makeApp({ role: 'member', orgId: 'org-99' });
		await app.request('/tenants/tenant-x/data', {}, makeEnv());
		expect(mockPrepare).toHaveBeenCalledWith(
			'SELECT id FROM tenants WHERE id = ? AND organization_id = ?'
		);
		expect(mockBind).toHaveBeenCalledWith('tenant-x', 'org-99');
	});

	it('also resolves :id param (legacy routes)', async () => {
		const app = new Hono<AppEnv>();
		app.use('*', async (c, next) => {
			c.set('user', { sub: 'u', orgId: 'org-1', role: 'platform_admin' } as any);
			await next();
		});
		app.get('/old/:id/data', tenantMiddleware, (c) => c.json({ ok: true }));
		const res = await app.request('/old/legacy-tenant/data', {}, makeEnv());
		expect(res.status).toBe(200);
	});
});
