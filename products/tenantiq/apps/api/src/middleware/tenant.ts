import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../index';

/**
 * Tenant context middleware.
 *
 * Validates the URL tenant id belongs to the authenticated user's org via a
 * fresh DB lookup — JWT `tenantIds` can be stale (user removed from org since
 * token issued). Fail-closed on any mismatch.
 *
 * Accepts either :tenantId or :id URL params (legacy routes).
 */
export const tenantMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	const tenantId = c.req.param('tenantId') ?? c.req.param('id');
	if (!tenantId) {
		return c.json({ error: { code: 'BAD_REQUEST', message: 'Tenant ID is required' } }, 400);
	}

	const user = c.get('user');
	if (!user?.orgId) {
		return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing org context' } }, 401);
	}

	// Platform / super admins bypass per-tenant gating but we still record the id.
	const role = String(user.role ?? '');
	if (role === 'platform_admin' || role === 'super_admin') {
		c.set('tenantId', tenantId);
		return next();
	}

	// Defense-in-depth — verify membership against current DB state, not JWT claims.
	const row = await c.env.DB
		.prepare('SELECT id FROM tenants WHERE id = ? AND organization_id = ?')
		.bind(tenantId, user.orgId)
		.first<{ id: string }>();
	if (!row) {
		return c.json({ error: { code: 'FORBIDDEN', message: 'Access denied to this tenant' } }, 403);
	}

	c.set('tenantId', tenantId);
	await next();
});
