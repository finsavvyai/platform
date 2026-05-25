import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';

vi.mock('jose', () => ({
	jwtVerify: vi.fn(),
}));

vi.mock('../lib/jwt-keys', () => ({
	getRS256PublicKey: vi.fn(),
	getHS256Secret: vi.fn(() => new TextEncoder().encode('test-secret')),
	isRS256Configured: vi.fn(() => false),
}));

import * as jose from 'jose';
import { authMiddleware, extractToken, tenantScopingMiddleware, requireRole } from './auth';

const mockJwtVerify = vi.mocked(jose.jwtVerify);

function makeApp(opts?: { tenantId?: string }) {
	const app = new Hono<AppEnv>();
	app.use('*', authMiddleware);
	app.get('/test', (c) => c.json({
		userId: c.get('userId'),
		userEmail: c.get('userEmail'),
		tenantId: c.get('tenantId'),
		userRole: c.get('userRole'),
		user: c.get('user'),
	}));
	return app;
}

function makeEnv(extra: Record<string, unknown> = {}) {
	return { JWT_SECRET: 'test-secret', ...extra } as any;
}

describe('extractToken', () => {
	it('extracts from cookie', () => {
		const mockCtx = {
			req: {
				header: (name: string) => name === 'cookie' ? 'tenantiq_session=tok123' : undefined,
			},
		} as any;
		expect(extractToken(mockCtx)).toBe('tok123');
	});

	it('returns the raw cookie value (no URL-decode)', () => {
		// JWT charset is base64url + dots — never %-encoded. Decoding was a
		// no-op for legitimate tokens and an attack surface for malformed ones.
		const mockCtx = {
			req: {
				header: (name: string) => name === 'cookie' ? 'tenantiq_session=tok%2B456' : undefined,
			},
		} as any;
		expect(extractToken(mockCtx)).toBe('tok%2B456');
	});

	it('falls back to Authorization Bearer', () => {
		const mockCtx = {
			req: {
				header: (name: string) => name === 'authorization' ? 'Bearer mytoken' : undefined,
			},
		} as any;
		expect(extractToken(mockCtx)).toBe('mytoken');
	});

	it('returns null when no token present', () => {
		const mockCtx = {
			req: { header: () => undefined },
		} as any;
		expect(extractToken(mockCtx)).toBeNull();
	});
});

describe('authMiddleware', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns 401 with no token', async () => {
		const app = makeApp();
		const res = await app.request('/test', {}, makeEnv());
		expect(res.status).toBe(401);
		const json: any = await res.json();
		expect(json.error.code).toBe('UNAUTHORIZED');
	});

	it('returns 401 with invalid token', async () => {
		mockJwtVerify.mockRejectedValue(new Error('invalid'));
		const app = makeApp();
		const res = await app.request('/test', {
			headers: { Authorization: 'Bearer bad' },
		}, makeEnv());
		expect(res.status).toBe(401);
	});

	it('sets context variables from valid token', async () => {
		mockJwtVerify.mockResolvedValue({
			payload: {
				sub: 'user-1',
				email: 'user@test.com',
				name: 'Test User',
				orgId: 'org-1',
				tenantIds: ['tenant-1', 'tenant-2'],
				role: 'admin',
			},
		} as any);

		const app = makeApp();
		const res = await app.request('/test', {
			headers: { Authorization: 'Bearer valid' },
		}, makeEnv());

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.userId).toBe('user-1');
		expect(json.userEmail).toBe('user@test.com');
		expect(json.userRole).toBe('admin');
		expect(json.user.orgId).toBe('org-1');
		expect(json.user.tenantIds).toEqual(['tenant-1', 'tenant-2']);
	});

	it('uses first tenantId when no X-Tenant-Id header', async () => {
		mockJwtVerify.mockResolvedValue({
			payload: {
				sub: 'u1', email: '', orgId: 'o1',
				tenantIds: ['t-first', 't-second'],
			},
		} as any);

		const app = makeApp();
		const res = await app.request('/test', {
			headers: { Authorization: 'Bearer v' },
		}, makeEnv());
		const json: any = await res.json();
		expect(json.tenantId).toBe('t-first');
	});

	it('enforces X-Tenant-Id must be in tenantIds', async () => {
		mockJwtVerify.mockResolvedValue({
			payload: {
				sub: 'u1', email: '', orgId: 'o1',
				tenantIds: ['tenant-a'],
			},
		} as any);

		const app = makeApp();
		const res = await app.request('/test', {
			headers: {
				Authorization: 'Bearer v',
				'X-Tenant-Id': 'tenant-other',
			},
		}, makeEnv());
		expect(res.status).toBe(403);
		const json: any = await res.json();
		expect(json.error.code).toBe('FORBIDDEN');
	});

	it('accepts X-Tenant-Id when it is in tenantIds', async () => {
		mockJwtVerify.mockResolvedValue({
			payload: {
				sub: 'u1', email: '', orgId: 'o1',
				tenantIds: ['tenant-a', 'tenant-b'],
			},
		} as any);

		const app = makeApp();
		const res = await app.request('/test', {
			headers: {
				Authorization: 'Bearer v',
				'X-Tenant-Id': 'tenant-b',
			},
		}, makeEnv());
		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.tenantId).toBe('tenant-b');
	});
});

describe('tenantScopingMiddleware', () => {
	beforeEach(() => vi.clearAllMocks());

	function makeScopedApp() {
		const app = new Hono<AppEnv>();
		app.get('/tenants/:id/data', tenantScopingMiddleware, (c) =>
			c.json({ ok: true, tenantId: c.req.param('id') })
		);
		return app;
	}

	it('allows access when :id matches user tenantId', async () => {
		const app = makeScopedApp();
		app.use('*', async (c, next) => {
			c.set('tenantId', 'tenant-1');
			c.set('userRole', 'member' as any);
			c.set('user', { role: 'member' } as any);
			await next();
		});
		// Rebuild so middleware runs first
		const app2 = new Hono<AppEnv>();
		app2.use('*', async (c, next) => {
			c.set('tenantId', 'tenant-1');
			c.set('userRole', 'member' as any);
			c.set('user', { role: 'member' } as any);
			await next();
		});
		app2.get('/tenants/:id/data', tenantScopingMiddleware, (c) =>
			c.json({ ok: true })
		);
		const res = await app2.request('/tenants/tenant-1/data');
		expect(res.status).toBe(200);
	});

	it('blocks access when :id does not match user tenantId', async () => {
		const app = new Hono<AppEnv>();
		app.use('*', async (c, next) => {
			c.set('tenantId', 'tenant-1');
			c.set('userRole', 'member' as any);
			c.set('user', { role: 'member' } as any);
			await next();
		});
		app.get('/tenants/:id/data', tenantScopingMiddleware, (c) =>
			c.json({ ok: true })
		);
		const res = await app.request('/tenants/tenant-2/data');
		expect(res.status).toBe(403);
	});

	it('allows platform_admin to bypass tenant scoping', async () => {
		const app = new Hono<AppEnv>();
		app.use('*', async (c, next) => {
			c.set('tenantId', 'tenant-1');
			c.set('userRole', 'platform_admin' as any);
			c.set('user', { role: 'platform_admin' } as any);
			await next();
		});
		app.get('/tenants/:id/data', tenantScopingMiddleware, (c) =>
			c.json({ ok: true })
		);
		const res = await app.request('/tenants/tenant-other/data');
		expect(res.status).toBe(200);
	});

	it('allows super_admin to bypass tenant scoping', async () => {
		const app = new Hono<AppEnv>();
		app.use('*', async (c, next) => {
			c.set('tenantId', 'tenant-1');
			c.set('userRole', 'super_admin' as any);
			c.set('user', { role: 'super_admin' } as any);
			await next();
		});
		app.get('/tenants/:id/data', tenantScopingMiddleware, (c) =>
			c.json({ ok: true })
		);
		const res = await app.request('/tenants/any-tenant/data');
		expect(res.status).toBe(200);
	});
});

describe('requireRole', () => {
	function makeRoleApp(allowedRoles: string[]) {
		const app = new Hono<AppEnv>();
		app.get('/guarded', requireRole(...allowedRoles), (c) => c.json({ ok: true }));
		return app;
	}

	it('allows matching role', async () => {
		const app = makeRoleApp(['billing_admin']);
		app.use('*', async (c, next) => {
			c.set('userRole', 'billing_admin' as any);
			await next();
		});
		const app2 = new Hono<AppEnv>();
		app2.use('*', async (c, next) => {
			c.set('userRole', 'billing_admin' as any);
			await next();
		});
		app2.get('/guarded', requireRole('billing_admin'), (c) => c.json({ ok: true }));
		const res = await app2.request('/guarded');
		expect(res.status).toBe(200);
	});

	it('blocks non-matching role with 403', async () => {
		const app = new Hono<AppEnv>();
		app.use('*', async (c, next) => {
			c.set('userRole', 'member' as any);
			await next();
		});
		app.get('/guarded', requireRole('billing_admin'), (c) => c.json({ ok: true }));
		const res = await app.request('/guarded');
		expect(res.status).toBe(403);
		const json: any = await res.json();
		expect(json.error.code).toBe('FORBIDDEN');
	});

	it('blocks request with no role', async () => {
		const app = new Hono<AppEnv>();
		app.get('/guarded', requireRole('admin'), (c) => c.json({ ok: true }));
		const res = await app.request('/guarded');
		expect(res.status).toBe(403);
	});
});
