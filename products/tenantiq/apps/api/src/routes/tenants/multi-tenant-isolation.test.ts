/**
 * Multi-tenant isolation tests.
 *
 * Verifies that:
 * 1. verifyTenantAccess blocks cross-tenant data access at the helper level
 * 2. tenantMiddleware enforces org-scoping via DB lookup (not just JWT claims)
 * 3. Admin users can access any tenant (bypass isolation for admin flows)
 * 4. JWT tenantIds cannot be spoofed via X-Tenant-Id header
 * 5. Org A data is completely invisible to Org B users
 */

import { Hono } from 'hono';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AppEnv } from '../../app/types';
import { verifyTenantAccess } from './helpers';
import { tenantMiddleware } from '../../middleware/tenant';

// ── verifyTenantAccess unit tests ────────────────────────────────────────────

describe('verifyTenantAccess', () => {
	function makeCtx(tenantIds: string[]) {
		return {
			get: (key: string) => key === 'user' ? { tenantIds } : undefined,
		} as any;
	}

	it('returns true when tenantId is in user list', () => {
		expect(verifyTenantAccess(makeCtx(['org-a-t1', 'org-a-t2']), 'org-a-t1')).toBe(true);
	});

	it('returns false when tenantId is NOT in user list', () => {
		expect(verifyTenantAccess(makeCtx(['org-a-t1']), 'org-b-t99')).toBe(false);
	});

	it('returns false for empty tenantIds', () => {
		expect(verifyTenantAccess(makeCtx([]), 'any-tenant')).toBe(false);
	});

	it('returns false when user has no tenantIds field', () => {
		const ctx = { get: () => ({ sub: 'u' }) } as any;
		expect(verifyTenantAccess(ctx, 'any')).toBe(false);
	});
});

// ── tenantMiddleware isolation tests ─────────────────────────────────────────

const mockFirst = vi.fn();
const mockBind = vi.fn(() => ({ first: mockFirst }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

function makeEnv() {
	return { DB: { prepare: mockPrepare } as any } as any;
}

function makeIsolationApp(userOrgId: string, userRole = 'member') {
	const app = new Hono<AppEnv>();
	app.use('*', async (c, next) => {
		c.set('user', {
			sub: 'user-x',
			orgId: userOrgId,
			role: userRole,
			tenantIds: [],
			email: '',
			name: '',
		} as any);
		await next();
	});
	app.get('/tenants/:tenantId/resource', tenantMiddleware, (c) =>
		c.json({ data: 'sensitive', tenantId: c.get('tenantId') })
	);
	return app;
}

describe('Cross-org tenant isolation (tenantMiddleware)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('Org A user CANNOT access Org B tenant', async () => {
		// DB returns null — tenant does not belong to org-a
		mockFirst.mockResolvedValueOnce(null);

		const app = makeIsolationApp('org-a');
		const res = await app.request('/tenants/org-b-tenant/resource', {}, makeEnv());

		expect(res.status).toBe(403);
		expect(mockBind).toHaveBeenCalledWith('org-b-tenant', 'org-a');
	});

	it('Org A user CAN access Org A tenant', async () => {
		mockFirst.mockResolvedValueOnce({ id: 'org-a-tenant' });

		const app = makeIsolationApp('org-a');
		const res = await app.request('/tenants/org-a-tenant/resource', {}, makeEnv());

		expect(res.status).toBe(200);
		expect(mockBind).toHaveBeenCalledWith('org-a-tenant', 'org-a');
	});

	it('DB query always scopes by BOTH tenant id AND org id', async () => {
		mockFirst.mockResolvedValueOnce({ id: 'tenant-1' });

		const app = makeIsolationApp('org-99');
		await app.request('/tenants/tenant-1/resource', {}, makeEnv());

		expect(mockPrepare).toHaveBeenCalledWith(
			'SELECT id FROM tenants WHERE id = ? AND organization_id = ?'
		);
		// Verify org_id is the second bind param — prevents tenant id-only lookups
		expect(mockBind).toHaveBeenCalledWith('tenant-1', 'org-99');
	});

	it('platform_admin can access any org tenant (admin bypass)', async () => {
		const app = makeIsolationApp('org-a', 'platform_admin');
		const res = await app.request('/tenants/org-b-tenant/resource', {}, makeEnv());

		expect(res.status).toBe(200);
		// DB was NOT queried — admin bypass skips ownership check
		expect(mockPrepare).not.toHaveBeenCalled();
	});

	it('super_admin can access any org tenant (admin bypass)', async () => {
		const app = makeIsolationApp('org-a', 'super_admin');
		const res = await app.request('/tenants/org-c-tenant/resource', {}, makeEnv());

		expect(res.status).toBe(200);
		expect(mockPrepare).not.toHaveBeenCalled();
	});

	it('user without orgId cannot access any tenant', async () => {
		const app = makeIsolationApp('');
		const res = await app.request('/tenants/any-tenant/resource', {}, makeEnv());
		expect(res.status).toBe(401);
	});
});

// ── X-Tenant-Id header spoofing prevention ──────────────────────────────────

vi.mock('jose', () => ({
	jwtVerify: vi.fn(),
}));
vi.mock('../../lib/jwt-keys', () => ({
	getRS256PublicKey: vi.fn(),
	getHS256Secret: vi.fn(() => new TextEncoder().encode('s')),
	isRS256Configured: vi.fn(() => false),
}));

import * as jose from 'jose';
import { authMiddleware } from '../../middleware/auth';

const mockJwtVerify = vi.mocked(jose.jwtVerify);

describe('X-Tenant-Id header spoofing prevention (authMiddleware)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rejects X-Tenant-Id not in JWT tenantIds claim', async () => {
		mockJwtVerify.mockResolvedValue({
			payload: {
				sub: 'u1', email: '', orgId: 'org-a',
				tenantIds: ['org-a-tenant-1', 'org-a-tenant-2'],
			},
		} as any);

		const app = new Hono<AppEnv>();
		app.use('*', authMiddleware);
		app.get('/test', (c) => c.json({ ok: true }));

		const res = await app.request('/test', {
			headers: {
				Authorization: 'Bearer tok',
				'X-Tenant-Id': 'org-b-tenant-99', // attacker injects cross-org tenant
			},
		}, { JWT_SECRET: 's' } as any);

		expect(res.status).toBe(403);
		const json: any = await res.json();
		expect(json.error.code).toBe('FORBIDDEN');
	});

	it('accepts X-Tenant-Id that is in JWT tenantIds', async () => {
		mockJwtVerify.mockResolvedValue({
			payload: {
				sub: 'u1', email: '', orgId: 'org-a',
				tenantIds: ['org-a-tenant-1', 'org-a-tenant-2'],
			},
		} as any);

		const app = new Hono<AppEnv>();
		app.use('*', authMiddleware);
		app.get('/test', (c) => c.json({ ok: true }));

		const res = await app.request('/test', {
			headers: {
				Authorization: 'Bearer tok',
				'X-Tenant-Id': 'org-a-tenant-2',
			},
		}, { JWT_SECRET: 's' } as any);

		expect(res.status).toBe(200);
	});
});

// ── verifyTenantAccess used in route handlers ────────────────────────────────

describe('Route-level tenant access check (verifyTenantAccess)', () => {
	it('blocks access when tenantId not in user list (simulated route)', async () => {
		const app = new Hono<AppEnv>();
		app.get('/tenants/:id/alerts', (c) => {
			const tenantId = c.req.param('id');
			c.set('user', { tenantIds: ['org-a-t1'] } as any);
			if (!verifyTenantAccess(c, tenantId)) {
				return c.json({ error: 'Forbidden' }, 403);
			}
			return c.json({ alerts: [] });
		});

		const res = await app.request('/tenants/org-b-t99/alerts');
		expect(res.status).toBe(403);
	});

	it('allows access when tenantId is in user list', async () => {
		const app = new Hono<AppEnv>();
		app.get('/tenants/:id/alerts', (c) => {
			const tenantId = c.req.param('id');
			c.set('user', { tenantIds: ['org-a-t1', 'org-a-t2'] } as any);
			if (!verifyTenantAccess(c, tenantId)) {
				return c.json({ error: 'Forbidden' }, 403);
			}
			return c.json({ alerts: [] });
		});

		const res = await app.request('/tenants/org-a-t2/alerts');
		expect(res.status).toBe(200);
	});
});
