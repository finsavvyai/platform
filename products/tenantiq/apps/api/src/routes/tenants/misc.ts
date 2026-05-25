/**
 * Miscellaneous tenant routes: MSP, secure score, notifications, SSE.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import * as jose from 'jose';
import { verifyTokenWithFallback } from '../auth-session';

export const miscRoutes = new Hono<AppEnv>();

// GET /api/tenants/:id/msp
miscRoutes.get('/:id/msp', async (c) => {
	return c.json({ tenants: [], summary: { totalTenants: 0, healthyTenants: 0 } });
});

// GET /api/tenants/:id/secure-score
miscRoutes.get('/:id/secure-score', async (c) => {
	const id = c.req.param('id');
	const cached = await c.env.KV.get(`securescore:${id}`, 'json');
	if (cached) return c.json(cached);

	const db = c.env.DB;
	const userResult = await db.prepare(
		'SELECT COUNT(*) as total, SUM(CASE WHEN account_enabled = 1 THEN 1 ELSE 0 END) as active FROM users_cache WHERE tenant_id = ?'
	).bind(id).first().catch(() => null);
	const alertResult = await db.prepare(
		"SELECT COUNT(*) as count FROM alerts WHERE tenant_id = ? AND status = 'active' AND severity IN ('critical','high')"
	).bind(id).first().catch(() => null);

	const total = Number((userResult as any)?.total ?? 0);
	const active = Number((userResult as any)?.active ?? 0);
	const critHigh = Number((alertResult as any)?.count ?? 0);

	if (total === 0) return c.json({ current: null, trend: [] });

	const inactiveRatio = total > 0 ? (total - active) / total : 0;
	const score = Math.max(0, Math.min(100, Math.round(80 - inactiveRatio * 30 - critHigh * 5)));
	return c.json({ current: score, trend: [] });
});

// GET /api/tenants/:id/notifications — Recent notifications
miscRoutes.get('/:id/notifications', async (c) => {
	const id = c.req.param('id');
	const { getNotifications } = await import('../../lib/notifications');
	const notifications = await getNotifications(c.env.KV, id, 20);
	return c.json({ notifications });
});

// POST /api/tenants/:id/notifications/:nid/read — Mark single as read
miscRoutes.post('/:id/notifications/:nid/read', async (c) => {
	const id = c.req.param('id');
	const nid = c.req.param('nid');
	const { markNotificationRead } = await import('../../lib/notifications');
	const found = await markNotificationRead(c.env.KV, id, nid);
	return c.json({ success: found });
});

// POST /api/tenants/:id/notifications/read-all — Mark all as read
miscRoutes.post('/:id/notifications/read-all', async (c) => {
	const id = c.req.param('id');
	const { markAllRead } = await import('../../lib/notifications');
	const count = await markAllRead(c.env.KV, id);
	return c.json({ success: true, marked: count });
});

// GET /api/tenants/:id/events/stream — SSE endpoint
// Auth: HttpOnly session cookie (preferred), Authorization Bearer, or
// short-lived ws-ticket via ?token=... (browsers can't set Authorization
// on EventSource, so the cookie path is the primary one).
miscRoutes.get('/:id/events/stream', async (c) => {
	let token: string | null = null;
	const cookie = c.req.header('Cookie');
	if (cookie) {
		const match = cookie.match(/(?:^|;\s*)tenantiq_session=([^;]+)/);
		if (match) token = match[1];
	}
	if (!token) {
		const authHeader = c.req.header('Authorization');
		token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (c.req.query('token') ?? null);
	}

	if (!token) return c.json({ error: 'Missing authentication' }, 401);

	try {
		// Use the shared dual-alg verifier so RS256-configured envs work too.
		// skipIssAud=true keeps legacy session JWTs working during rollouts.
		await verifyTokenWithFallback(token, c.env, { skipIssAud: true });
	} catch {
		return c.json({ error: 'Invalid or expired token' }, 401);
	}

	const id = c.req.param('id');
	const durableId = c.env.TENANT_EVENTS.idFromName(id);
	const stub = c.env.TENANT_EVENTS.get(durableId);
	return stub.fetch(c.req.raw);
});
