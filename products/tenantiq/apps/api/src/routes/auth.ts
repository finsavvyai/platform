import { Hono } from 'hono';
import * as jose from 'jose';
import type { Context } from 'hono';
import type { AppEnv } from '../index';
import { rateLimitMiddleware } from '../middleware/ratelimit';
import { GRAPH, GRAPH_PERSONAL_SCOPES } from '../lib/constants';
import { getDb } from '../lib/db';
import { getTenantsByOrganization } from '@tenantiq/db';
import { writeAuditLog } from '../lib/audit-logger';
import { handleAuthCallback } from './auth-callback';
import { linkedinLogin, linkedinCallback } from './auth-linkedin';
import { buildUserPayload } from './auth-callback-helpers';
import {
	verifyTokenWithFallback,
	signToken,
	signWSTicket,
	sessionCookieValue,
	clearSessionCookieValue,
	revokeJti,
} from './auth-session';
import { authMiddleware, extractToken, SESSION_COOKIE } from '../middleware/auth';
import { authRequired, authExpired, AppError } from '../lib/errors';

export const authRoutes = new Hono<AppEnv>();

// ─── Cookie helpers ────────────────────────────────────────────────────────
// Cookie name is imported from middleware/auth so the writer + reader stay
// in lockstep — drift between them is silent (login appears to succeed but
// every authed request 401s because the middleware looks for a different name).

function setSessionCookie(c: Context<AppEnv>, jwt: string) {
	const isSecure = new URL(c.req.url).protocol === 'https:';
	const parts = [`${SESSION_COOKIE}=${jwt}`, 'HttpOnly', 'Path=/', 'Max-Age=86400', 'SameSite=Lax'];
	if (isSecure) {
		parts.push('Secure', 'Domain=.tenantiq.app');
	}
	c.header('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(c: Context<AppEnv>) {
	const isSecure = new URL(c.req.url).protocol === 'https:';
	const parts = [`${SESSION_COOKIE}=`, 'HttpOnly', 'Path=/', 'Max-Age=0', 'SameSite=Lax'];
	if (isSecure) {
		parts.push('Secure', 'Domain=.tenantiq.app');
	}
	c.header('Set-Cookie', parts.join('; '));
}

/** Extract JWT from cookie or Authorization header. */
export function getTokenFromRequest(c: Context<AppEnv>): string | null {
	// Prefer cookie (HttpOnly, not accessible via JS)
	const cookie = c.req.header('Cookie');
	if (cookie) {
		const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
		if (match) return match[1];
	}
	// Fallback to Authorization header (for API clients / local dev)
	const authHeader = c.req.header('Authorization');
	if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
	return null;
}

// Rate limit auth endpoints — IP-based, strict (5 req/min)
authRoutes.use('/login', rateLimitMiddleware({ limit: 5, windowSeconds: 60, keyPrefix: 'auth-login' }));
authRoutes.use('/callback', rateLimitMiddleware({ limit: 5, windowSeconds: 60, keyPrefix: 'auth-callback' }));
authRoutes.use('/exchange', rateLimitMiddleware({ limit: 5, windowSeconds: 60, keyPrefix: 'auth-exchange' }));
authRoutes.use('/refresh', rateLimitMiddleware({ limit: 10, windowSeconds: 60, keyPrefix: 'auth-refresh' }));

authRoutes.get('/login', async (c) => {
	if (!c.env.AZURE_CLIENT_ID) {
		return c.json({ error: 'Azure client not configured' }, 503);
	}

	const redirectUri = `${new URL(c.req.url).origin}/api/auth/callback`;
	const state = crypto.randomUUID();
	await c.env.KV.put(`auth:state:${state}`, 'admin:nonce', { expirationTtl: 300 });

	const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
	authUrl.searchParams.set('client_id', c.env.AZURE_CLIENT_ID);
	authUrl.searchParams.set('response_type', 'code');
	authUrl.searchParams.set('redirect_uri', redirectUri);
	authUrl.searchParams.set('scope', GRAPH.OAUTH_SCOPES);
	authUrl.searchParams.set('response_mode', 'query');
	authUrl.searchParams.set('state', state);

	return c.redirect(authUrl.toString());
});

authRoutes.use('/login/personal', rateLimitMiddleware({ limit: 5, windowSeconds: 60, keyPrefix: 'auth-personal-login' }));
authRoutes.get('/login/personal', async (c) => {
	if (!c.env.AZURE_CLIENT_ID) return c.json({ error: 'Azure client not configured' }, 503);
	const redirectUri = `${new URL(c.req.url).origin}/api/auth/callback`;
	const state = crypto.randomUUID();
	await c.env.KV.put(`auth:state:${state}`, 'personal:nonce', { expirationTtl: 300 });
	const u = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
	u.searchParams.set('client_id', c.env.AZURE_CLIENT_ID);
	u.searchParams.set('response_type', 'code');
	u.searchParams.set('redirect_uri', redirectUri);
	u.searchParams.set('scope', GRAPH_PERSONAL_SCOPES);
	u.searchParams.set('response_mode', 'query');
	u.searchParams.set('state', state);
	u.searchParams.set('prompt', 'select_account');
	return c.redirect(u.toString());
});

// Admin-consent kickoff. Auth-gated: we read the caller's session to capture
// their orgId, stash it under the OAuth `state`, and the callback uses that to
// link the newly-consented Azure tenant to the right org. Without this, the
// admin-consent callback has no way to know which TenantIQ org owns the
// consent and silently no-ops, leaving the user stuck on "Permissions granted".
// Pre-check: if no session, kick off Microsoft sign-in. After login the
// callback re-creates the org, so onboard-org is no longer needed for new
// signups — but we still surface a useful flow instead of bare-401ing visitors
// who hit this URL directly (e.g., from "Onboard your organization" CTAs).
authRoutes.get('/onboard-org', async (c, next) => {
	if (!getTokenFromRequest(c)) return c.redirect(`${new URL(c.req.url).origin}/api/auth/login`);
	return authMiddleware(c, next);
}, async (c) => {
	if (!c.env.AZURE_CLIENT_ID) return c.json({ error: 'Azure client not configured' }, 503);
	const user = c.get('user');
	if (!user?.orgId) return c.json({ error: 'No organization context' }, 400);

	const redirectUri = `${new URL(c.req.url).origin}/api/auth/callback`;
	const state = crypto.randomUUID();
	await c.env.KV.put(
		`auth:onboard:${state}`,
		JSON.stringify({ orgId: user.orgId, userSub: user.sub, createdAt: Date.now() }),
		{ expirationTtl: 600 },
	);

	const u = new URL('https://login.microsoftonline.com/organizations/adminconsent');
	u.searchParams.set('client_id', c.env.AZURE_CLIENT_ID);
	u.searchParams.set('redirect_uri', redirectUri);
	u.searchParams.set('state', state);
	return c.redirect(u.toString());
});

authRoutes.use('/login/linkedin', rateLimitMiddleware({ limit: 5, windowSeconds: 60, keyPrefix: 'auth-li-login' }));
authRoutes.use('/callback/linkedin', rateLimitMiddleware({ limit: 5, windowSeconds: 60, keyPrefix: 'auth-li-cb' }));
authRoutes.get('/login/linkedin', linkedinLogin);
authRoutes.get('/callback/linkedin', linkedinCallback);

authRoutes.get('/callback', handleAuthCallback);

/** Exchange a one-time auth code for a session (sets HttpOnly cookie). */
authRoutes.post('/exchange', async (c) => {
	const body = await c.req.json<{ code?: string }>().catch(() => ({} as { code?: string }));
	if (!body.code) return c.json({ error: 'Missing code' }, 400);
	const code = body.code;

	const stored = await c.env.KV.get(`auth:code:${code}`);
	if (!stored) return c.json({ error: 'Invalid or expired code' }, 400);

	// One-time use — delete immediately
	await c.env.KV.delete(`auth:code:${code}`);
	const { jwt, user } = JSON.parse(stored);

	setSessionCookie(c, jwt);
	return c.json({ user });
});

authRoutes.post('/refresh', async (c) => {
	const token = extractToken(c);
	if (!token) throw authRequired('Missing session');

	try {
		// No extended clockTolerance — stolen tokens must not outlive their expiry.
		// skipIssAud=true during the rollout window so legacy tokens still refresh.
		const payload = await verifyTokenWithFallback(token, c.env, { skipIssAud: true });

		// Use raw D1 — getPlatformUserByAzureOid uses Postgres schema (no `status` column).
		const azureOid = payload.sub as string;
		const freshUser = await c.env.DB.prepare(
			'SELECT * FROM platform_users WHERE azure_oid = ? LIMIT 1',
		).bind(azureOid).first<Record<string, unknown>>();
		if (!freshUser || freshUser.status !== 'active') {
			throw authExpired('User is no longer active');
		}

		const db = getDb(c.env);
		const orgId = (payload.orgId as string) ?? '';
		const orgTenants = orgId ? await getTenantsByOrganization(db, orgId) : [];
		const freshTenantIds = orgTenants.map((t) => t.id);

		const jwt = await signToken(c.env, {
			sub: payload.sub, email: payload.email, name: payload.name,
			orgId: payload.orgId, tenantIds: freshTenantIds, role: payload.role,
		});

		await c.env.KV.put(`session:${payload.sub}`, jwt, { expirationTtl: 86400 });
		setSessionCookie(c, jwt);
		return c.json({ token: jwt, ok: true, success: true });
	} catch (err) {
		if (err instanceof Error && err.name === 'AppError') throw err;
		throw authExpired('Invalid or expired token');
	}
});

authRoutes.get('/ws-ticket', authMiddleware, async (c) => {
	const user = c.get('user');
	const ticket = await signWSTicket(c.env, {
		sub: user.sub,
		orgId: user.orgId,
		tenantIds: user.tenantIds,
		role: user.role,
	});
	return c.json({ ticket });
});

// Exchange a signed envelope (issued by OAuth callback) for an HttpOnly session cookie.
// The envelope is a short-lived JWT wrapping the session JWT — no KV required,
// works consistently across Cloudflare edges.
authRoutes.post('/exchange', rateLimitMiddleware({ limit: 5, windowSeconds: 60, keyPrefix: 'auth-exchange' }), async (c) => {
	const body = await c.req.json<{ code?: string }>().catch(() => ({ code: undefined }));
	const { code } = body;
	if (!code) {
		console.error('[exchange] missing code in request body');
		return c.json({ error: 'Missing code' }, 400);
	}

	let sessionJwt: string;
	try {
		const payload = await verifyTokenWithFallback(code, c.env, { clockTolerance: 30 });
		if (payload.use !== 'xcode' || typeof payload.session !== 'string') {
			console.error('[exchange] invalid xcode claims: use=', payload.use, 'session type=', typeof payload.session);
			return c.json({ error: 'Invalid exchange token' }, 400);
		}
		sessionJwt = payload.session;
	} catch (err) {
		console.error('[exchange] token verify failed:', (err as Error)?.message);
		return c.json({ error: 'Invalid or expired exchange token' }, 400);
	}

	c.header('Set-Cookie', sessionCookieValue(c, sessionJwt, 86400));
	console.log('[exchange] success — cookie set');
	return c.json({ ok: true });
});

authRoutes.get('/me', async (c) => {
	const token = extractToken(c);
	if (!token) {
		console.error('[me] no token in request (no cookie, no bearer)');
		throw authRequired('Missing session');
	}
	let payload: jose.JWTPayload;
	try {
		payload = await verifyTokenWithFallback(token, c.env, { skipIssAud: true });
	} catch (err) {
		console.error('[me] JWT verify failed:', (err as Error)?.message);
		throw authExpired('Invalid or expired session');
	}

	// Use raw D1 — getPlatformUserByAzureOid uses the Postgres schema which omits
	// the `status` column, causing user.status to always be undefined (→ 401).
	const azureOid = payload.sub as string;
	const user = await c.env.DB.prepare(
		'SELECT * FROM platform_users WHERE azure_oid = ? LIMIT 1',
	).bind(azureOid).first<Record<string, unknown>>();
	if (!user || user.status !== 'active') {
		// Hash the OID — Restricted-tier per docs/DATA_CLASSIFICATION.md.
		const oidHash = await sha256Prefix(azureOid);
		console.error('[me] user not found or inactive', { oidHash, status: user?.status ?? 'missing' });
		c.header('Set-Cookie', clearSessionCookieValue(c));
		throw authExpired('User not active');
	}

	const db = getDb(c.env);
	const orgId = (user.organization_id as string) ?? '';
	const orgTenants = orgId ? await getTenantsByOrganization(db, orgId) : [];
	const tenantIds = orgTenants.map((t) => t.id);

	const payloadUser = await buildUserPayload(
		c,
		user as unknown as Record<string, unknown>,
		orgId,
		tenantIds,
		user.email as string,
		user.name as string,
	);
	return c.json({ user: payloadUser });
});

authRoutes.post('/logout', async (c) => {
	const token = getTokenFromRequest(c);
	if (token) {
		try {
			// skipIssAud=true so we can revoke transition-window tokens that were
			// minted before iss/aud rolled out. Revocation works regardless.
			const payload = await verifyTokenWithFallback(token, c.env, { skipIssAud: true });
			await c.env.KV.delete(`session:${payload.sub}`);

			// Deny-list this JTI so subsequent presentations fail fast even though
			// the JWT signature + exp would otherwise still pass.
			if (payload.jti && typeof payload.exp === 'number') {
				await revokeJti(c.env.KV, payload.jti, payload.exp);
			}

			writeAuditLog(c, {
				tenantId: (payload.orgId as string) ?? '',
				eventType: 'auth.logout',
				actorId: payload.sub as string,
				actorType: 'user',
				action: 'logout',
				result: 'success',
				complianceCategory: 'authentication',
			}).catch(() => {});
		} catch { /* already expired */ }
	}
	clearSessionCookie(c);
	return c.json({ success: true });
});

/** Hash the first 8 hex chars of sha256(input) — for safe logging of
 *  Restricted-tier identifiers (see docs/DATA_CLASSIFICATION.md). */
async function sha256Prefix(input: string): Promise<string> {
	const bytes = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
	return hex.slice(0, 8);
}
