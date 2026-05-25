/**
 * WebSocket upgrade route.
 * Authenticates via HttpOnly session cookie (preferred) or query param (legacy fallback),
 * then proxies the connection to the tenant's Durable Object.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { verifyTokenWithFallback } from './auth-session';

export const websocketRoutes = new Hono<AppEnv>();

const SESSION_COOKIE = 'tenantiq_session';

function getTokenFromWsRequest(c: { req: { header(name: string): string | undefined; query(name: string): string | undefined } }): string | null {
	const cookie = c.req.header('Cookie');
	if (cookie) {
		const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
		if (match) return match[1];
	}
	// Legacy fallback — query param (will be removed in future)
	return c.req.query('token') ?? null;
}

websocketRoutes.get('/ws/:tenantId', async (c) => {
	const upgradeHeader = c.req.header('Upgrade');
	if (upgradeHeader !== 'websocket') {
		return c.json({ error: 'Expected WebSocket upgrade' }, 426);
	}

	const token = getTokenFromWsRequest(c);
	if (!token) {
		return c.json({ error: 'Missing authentication' }, 401);
	}

	// Verify JWT using the shared dual-algorithm fallback. WS tickets are
	// 60s-TTL with scope=ws — no revocation check needed (TTL handles it).
	try {
		const payload = await verifyTokenWithFallback(token, c.env, { skipIssAud: true });
		const user = payload as { sub: string; orgId: string; tenantIds: string[]; scope?: string };
		if (user.scope !== 'ws') {
			return c.json({ error: 'Invalid token scope' }, 401);
		}

		const tenantId = c.req.param('tenantId');

		// Verify tenant access
		if (!user.tenantIds?.includes(tenantId)) {
			return c.json({ error: 'Forbidden: no access to this tenant' }, 403);
		}

		// Forward WebSocket upgrade to the Durable Object
		const durableId = c.env.TENANT_EVENTS.idFromName(tenantId);
		const stub = c.env.TENANT_EVENTS.get(durableId);

		return stub.fetch(new Request('https://internal/ws', {
			headers: { Upgrade: 'websocket' }
		}));
	} catch {
		return c.json({ error: 'Invalid or expired token' }, 401);
	}
});
