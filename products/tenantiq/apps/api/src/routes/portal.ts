/**
 * Self-Service Portal Routes
 *
 * Viewer-level endpoints using cached D1 data (no Graph dependency).
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';

const portal = new Hono<AppEnv>();

portal.use('*', authMiddleware);
portal.use('*', standardRateLimit);

/** GET /api/portal/me — current user profile from D1 cache + platform_users */
portal.get('/me', async (c) => {
	const userId = c.get('userId');
	const email = c.get('userEmail');
	const tenantId = c.get('tenantId');

	if (!userId) return c.json({ error: 'User ID not found in token' }, 400);

	const db = c.env.DB;

	// Get platform user info
	const platformUser = await db
		.prepare('SELECT id, email, COALESCE(display_name, name) as display_name, role, status, organization_id FROM platform_users WHERE azure_oid = ? OR email = ? LIMIT 1')
		.bind(userId, email ?? '')
		.first<Record<string, unknown>>()
		.catch(() => null);

	// Get cached M365 user if available
	const cachedUser = tenantId
		? await db.prepare('SELECT display_name, email, job_title, department, account_enabled FROM users_cache WHERE tenant_id = ? AND email = ? LIMIT 1')
			.bind(tenantId, email ?? '').first<Record<string, unknown>>().catch(() => null)
		: null;

	// Get license count
	const licenseCount = tenantId
		? await db.prepare('SELECT COUNT(*) as count FROM user_licenses WHERE tenant_id = ? AND user_email = ?')
			.bind(tenantId, email ?? '').first<{ count: number }>().catch(() => ({ count: 0 }))
		: { count: 0 };

	return c.json({
		user: {
			id: platformUser?.id ?? userId,
			displayName: (cachedUser?.display_name ?? platformUser?.display_name ?? email) as string,
			mail: (platformUser?.email ?? email) as string,
			jobTitle: (cachedUser?.job_title ?? null) as string | null,
			department: (cachedUser?.department ?? null) as string | null,
			accountEnabled: (cachedUser?.account_enabled ?? true) as boolean,
			role: (platformUser?.role ?? 'viewer') as string,
			assignedLicenses: licenseCount?.count ?? 0,
		},
	});
});

/** GET /api/portal/me/licenses — own license assignments from cache */
portal.get('/me/licenses', async (c) => {
	const email = c.get('userEmail');
	const tenantId = c.get('tenantId');

	if (!tenantId) return c.json({ licenses: [] });

	const result = await c.env.DB
		.prepare('SELECT sku_id, sku_name FROM user_licenses WHERE tenant_id = ? AND user_email = ?')
		.bind(tenantId, email ?? '')
		.all<{ sku_id: string; sku_name: string }>()
		.catch(() => ({ results: [] }));

	return c.json({
		licenses: result.results.map(l => ({ skuId: l.sku_id, skuPartNumber: l.sku_name })),
	});
});

/** POST /api/portal/me/license-request — request additional license */
portal.post('/me/license-request', async (c) => {
	const userId = c.get('userId');
	const email = c.get('userEmail') ?? '';
	const tenantId = c.get('tenantId');
	const body = await c.req.json<{ skuId: string; reason: string }>().catch(() => ({ skuId: '', reason: '' }));

	if (!body.skuId || !body.reason) {
		return c.json({ error: 'skuId and reason are required' }, 400);
	}

	const requestId = crypto.randomUUID();
	const orgId = tenantId ?? 'default';
	await c.env.KV.put(`approval:${orgId}:${requestId}`, JSON.stringify({
		id: requestId, type: 'license_request',
		items: [{ id: 'lic-1', description: `License ${body.skuId} for ${email}`, impact: body.reason, approved: false }],
		requestedBy: userId, requestedAt: new Date().toISOString(), status: 'pending',
	}));

	const idx = JSON.parse(await c.env.KV.get(`approval-index:${orgId}:pending`) ?? '[]');
	idx.unshift(requestId);
	await c.env.KV.put(`approval-index:${orgId}:pending`, JSON.stringify(idx));

	return c.json({ requestId, status: 'pending' }, 201);
});

/** GET /api/portal/me/activity — recent sign-in activity from cached data */
portal.get('/me/activity', async (c) => {
	const email = c.get('userEmail');
	const tenantId = c.get('tenantId');

	if (!tenantId) return c.json({ signIns: [] });

	// Use audit logs as activity proxy
	const logs = await c.env.DB
		.prepare("SELECT event_type as type, created_at as date, details FROM audit_logs WHERE tenant_id = ? AND actor_id = ? ORDER BY created_at DESC LIMIT 30")
		.bind(tenantId, email ?? '')
		.all<{ type: string; date: string; details: string }>()
		.catch(() => ({ results: [] }));

	const signIns = logs.results.map(l => ({
		date: l.date,
		location: 'N/A',
		device: 'Web',
		status: 'success',
	}));

	return c.json({ signIns });
});

export { portal as portalRoutes };
export default portal;
