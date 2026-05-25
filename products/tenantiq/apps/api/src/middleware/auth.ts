import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import * as jose from 'jose';
import type { AppEnv, AppVariables } from '../index';
import { verifyTokenWithFallback } from '../routes/auth-session';
import { sha256Hex } from '../lib/hash';
import { isDemoKey, DEMO_USER } from '../lib/mcp-demo-key';

export type AuthPayload = AppVariables['user'];
export const SESSION_COOKIE = 'tenantiq_session';

export function extractToken(c: Context<AppEnv>): string | null {
	const cookieHeader = c.req.header('cookie');
	if (cookieHeader) {
		const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
		if (match) return match[1];
	}
	const authHeader = c.req.header('authorization') ?? c.req.header('Authorization');
	if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
	return null;
}

async function verifyToken(
	token: string,
	env: { RS256_PUBLIC_KEY?: string; RS256_PRIVATE_KEY?: string; JWT_SECRET: string; KV?: KVNamespace },
): Promise<jose.JWTPayload> {
	return verifyTokenWithFallback(token, env, { skipIssAud: true, checkRevocation: true });
}

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	const token = extractToken(c);
	if (!token) return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing authorization' } }, 401);

	// Demo-mode key — fixed plaintext, maps to a synthetic 3-tenant org.
	// Lets prospects paste a key into Claude Desktop and try the integration
	// in 60s without signing up.
	if (isDemoKey(token)) {
		setUserContext(c, DEMO_USER);
		await next();
		return;
	}

	// Long-lived MCP API keys: `tiq_<...>`. Look up the SHA-256 hash in
	// mcp_api_keys; on hit, build a synthetic JWT-shaped payload from the
	// key's owner so downstream handlers see a regular `user` context.
	if (token.startsWith('tiq_')) {
		const apiUser = await resolveApiKey(c, token);
		if (!apiUser) return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or revoked API key' } }, 401);
		setUserContext(c, apiUser);
		await next();
		return;
	}

	let payload: jose.JWTPayload;
	try {
		payload = await verifyToken(token, c.env);
	} catch {
		return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }, 401);
	}

	const raw = payload as jose.JWTPayload & {
		email?: string; name?: string; orgId?: string;
		tenantId?: string; tenantIds?: string[]; role?: string;
	};
	const tenantIds = raw.tenantIds ?? (raw.tenantId ? [raw.tenantId] : []);

	const headerTenantId = c.req.header('X-Tenant-Id') ?? c.req.header('x-tenant-id');
	if (headerTenantId) {
		const allowed = tenantIds.includes(headerTenantId) || raw.tenantId === headerTenantId;
		if (!allowed) {
			return c.json({ error: { code: 'FORBIDDEN', message: 'You do not have access to this tenant' } }, 403);
		}
	}
	const tenantId = headerTenantId || raw.tenantId || tenantIds[0] || '';

	c.set('userId', String(raw.sub ?? ''));
	c.set('userEmail', raw.email ?? '');
	c.set('tenantId', tenantId);
	c.set('userRole', raw.role as AppVariables['userRole']);
	c.set('user', {
		sub: String(raw.sub ?? ''),
		email: raw.email ?? '',
		name: raw.name ?? '',
		orgId: raw.orgId ?? '',
		tenantIds,
		role: String(raw.role ?? ''),
	});

	await next();
});

export const tenantScopingMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	const role = String(c.get('userRole') ?? c.get('user')?.role ?? '');
	if (role === 'super_admin' || role === 'platform_admin') return next();
	const requested = c.req.param('id') ?? c.req.param('tenantId');
	const ownedId = c.get('tenantId');
	if (!requested) return next();
	if (!ownedId || ownedId !== requested) {
		return c.json({ error: { code: 'FORBIDDEN', message: 'You do not have access to this tenant' } }, 403);
	}
	await next();
});

interface ApiKeyUser {
	sub: string; orgId: string; email: string; role: string;
	tenantIds: string[];
}

async function resolveApiKey(c: Context<AppEnv>, plaintext: string): Promise<ApiKeyUser | null> {
	const hash = await sha256Hex(plaintext);
	const row = await c.env.DB.prepare(
		`SELECT k.id, k.org_id, k.user_id, k.revoked_at, u.email, u.role
		 FROM mcp_api_keys k LEFT JOIN platform_users u ON u.id = k.user_id
		 WHERE k.key_hash = ? LIMIT 1`,
	).bind(hash).first<{ id: string; org_id: string; user_id: string; revoked_at: number | null; email: string | null; role: string | null }>().catch(() => null);
	if (!row || row.revoked_at !== null) return null;

	// Best-effort last-used stamp; never block the request.
	c.executionCtx.waitUntil(
		c.env.DB.prepare('UPDATE mcp_api_keys SET last_used_at = ? WHERE id = ?')
			.bind(Date.now(), row.id).run().catch(() => {}),
	);

	const tenants = await c.env.DB.prepare('SELECT id FROM tenants WHERE org_id = ?')
		.bind(row.org_id).all<{ id: string }>().catch(() => ({ results: [] as { id: string }[] }));

	return {
		sub: row.user_id,
		orgId: row.org_id,
		email: row.email ?? '',
		role: row.role ?? 'viewer',
		tenantIds: (tenants.results ?? []).map((t) => t.id),
	};
}

function setUserContext(c: Context<AppEnv>, u: ApiKeyUser) {
	c.set('userId', u.sub);
	c.set('userEmail', u.email);
	c.set('tenantId', u.tenantIds[0] ?? '');
	c.set('userRole', u.role as AppVariables['userRole']);
	c.set('user', { sub: u.sub, email: u.email, name: '', orgId: u.orgId, tenantIds: u.tenantIds, role: u.role });
}

export function requireRole(...roles: string[]) {
	return createMiddleware<AppEnv>(async (c, next) => {
		const role = String(c.get('userRole') ?? c.get('user')?.role ?? '');
		if (!role || !roles.includes(role)) {
			return c.json({ error: { code: 'FORBIDDEN', message: `Requires role: ${roles.join(', ')}` } }, 403);
		}
		await next();
	});
}
