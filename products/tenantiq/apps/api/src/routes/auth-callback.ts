import * as jose from 'jose';
import type { Context } from 'hono';
import type { AppEnv } from '../index';
import { GRAPH, URLS, GRAPH_PERSONAL_SCOPES } from '../lib/constants';
import { writeAuditLog } from '../lib/audit-logger';
import { getRS256PrivateKey, getHS256Secret, isRS256Configured } from '../lib/jwt-keys';
import { handleAdminConsent } from './auth-admin-consent';
import { buildUserPayload } from './auth-callback-user-payload';

/** Microsoft's JWKS endpoint for verifying ID tokens. */
const MSFT_JWKS = jose.createRemoteJWKSet(
	new URL('https://login.microsoftonline.com/common/discovery/v2.0/keys'),
);

function genId() {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Exchange auth code for tokens, upsert platform user, return JWT redirect. */
export async function handleAuthCallback(c: Context<AppEnv>) {
	const frontendUrl = c.env.FRONTEND_URL || URLS.FRONTEND;

	const adminConsent = c.req.query('admin_consent');
	const consentTenant = c.req.query('tenant');
	if (adminConsent === 'True' && consentTenant) {
		return handleAdminConsent(c, consentTenant, frontendUrl, c.req.query('state'));
	}

	const code = c.req.query('code');
	const state = c.req.query('state');
	const msError = c.req.query('error_description') || c.req.query('error');
	if (!code) {
		const msg = msError
			? `Microsoft returned an error: ${msError}`
			: 'Sign in failed — no authorization code received. Please try again.';
		return c.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(msg)}`);
	}

	let scopeLevel: 'admin' | 'personal' = 'admin';
	if (state) {
		const valid = await c.env.KV.get(`auth:state:${state}`);
		if (!valid) {
			return c.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent('Sign-in session expired or was already used. Please try again.')}`);
		}
		if (valid.startsWith('personal:')) scopeLevel = 'personal';
		await c.env.KV.delete(`auth:state:${state}`);
	}

	try {
		if (!c.env.AZURE_CLIENT_ID || !c.env.AZURE_CLIENT_SECRET) {
			console.error('Azure auth not configured');
			return c.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent('Sign in is temporarily unavailable.')}`);
		}

		const tokens = await exchangeCodeForTokens(c, code, scopeLevel);
		// Verify ID token signature against Microsoft's JWKS (not just decode)
		const { payload: idTokenPayload } = await jose.jwtVerify(tokens.id_token, MSFT_JWKS, {
			audience: c.env.AZURE_CLIENT_ID,
		});
		const azureOid = idTokenPayload.oid as string;
		const email = idTokenPayload.preferred_username as string;
		const name = idTokenPayload.name as string;
		const azureTenantId = (idTokenPayload.tid as string) || 'common';

		await storeGraphTokens(c, azureTenantId, tokens);
		const platformUser = await upsertPlatformUser(c, azureOid, email, name);

		const orgId = (platformUser.organization_id as string) ?? '';
		const existingTenants = orgId
			? await c.env.DB.prepare('SELECT id FROM tenants WHERE organization_id = ?').bind(orgId).all<{ id: string }>()
			: { results: [] };
		const tenantIds = existingTenants.results.map((t) => t.id);

		const jwt = await issueJwt(c, { azureOid, email, name, orgId, tenantIds, role: platformUser.role as string });
		await c.env.KV.put(`session:${azureOid}`, jwt, { expirationTtl: 86400 });

		writeAuditLog(c, {
			tenantId: orgId, eventType: 'auth.login', actorId: azureOid,
			actorType: 'user', action: 'login', result: 'success',
			details: { email, azureTenantId }, complianceCategory: 'authentication',
		}).catch(() => {});

		const userPayload = await buildUserPayload(c, platformUser, orgId, tenantIds, email, name);
		userPayload.scopeLevel = scopeLevel;

		// Store JWT + user behind a one-time auth code (never expose token in URL)
		const authCode = genId();
		await c.env.KV.put(`auth:code:${authCode}`, JSON.stringify({ jwt, user: userPayload }), { expirationTtl: 60 });
		return c.redirect(`${frontendUrl}/auth/callback?code=${authCode}`);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('Auth callback error:', msg);
		return c.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(`Authentication error: ${msg}`)}`);
	}
}

async function exchangeCodeForTokens(c: Context<AppEnv>, code: string, scopeLevel: 'admin' | 'personal' = 'admin') {
	const redirectUri = `${new URL(c.req.url).origin}/api/auth/callback`;
	const scope = scopeLevel === 'personal' ? GRAPH_PERSONAL_SCOPES : GRAPH.OAUTH_SCOPES;
	const resp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: c.env.AZURE_CLIENT_ID!, client_secret: c.env.AZURE_CLIENT_SECRET!,
			code, redirect_uri: redirectUri, grant_type: 'authorization_code', scope,
		}),
	});
	if (!resp.ok) {
		const errBody = await resp.text();
		console.error('Token exchange failed:', errBody);
		let userMsg = 'Sign in failed during token exchange.';
		try { const p = JSON.parse(errBody); userMsg = p.error_description || `Microsoft error: ${p.error}` || userMsg; } catch { /* not JSON */ }
		throw new Error(userMsg);
	}
	return resp.json() as Promise<{ access_token: string; refresh_token: string; id_token: string; expires_in: number }>;
}

async function storeGraphTokens(c: Context<AppEnv>, azureTenantId: string, tokens: { access_token: string; refresh_token?: string; expires_in: number }) {
	await c.env.KV.put(`graph:${azureTenantId}:access_token`, tokens.access_token, { expirationTtl: tokens.expires_in || 3600 });
	if (tokens.refresh_token) await c.env.KV.put(`graph:${azureTenantId}:refresh_token`, tokens.refresh_token);
}

async function upsertPlatformUser(c: Context<AppEnv>, azureOid: string, email: string, name: string) {
	const db = c.env.DB;
	let user = await db.prepare('SELECT * FROM platform_users WHERE azure_oid = ? LIMIT 1').bind(azureOid).first<Record<string, unknown>>();
	if (!user) {
		const orgId = genId();
		await db.prepare('INSERT INTO organizations (id, name, type) VALUES (?, ?, ?)').bind(orgId, `${name}'s Organization`, 'direct').run();
		const userId = genId();
		await db.prepare('INSERT INTO platform_users (id, organization_id, email, name, role, azure_oid, status) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(userId, orgId, email, name, 'admin', azureOid, 'active').run();
		user = { id: userId, organization_id: orgId, email, name, role: 'admin', status: 'active' };
	} else {
		await db.prepare('UPDATE platform_users SET last_login_at = ? WHERE id = ?').bind(Date.now(), user.id as string).run();
	}
	return user;
}

async function issueJwt(c: Context<AppEnv>, claims: { azureOid: string; email: string; name: string; orgId: string; tenantIds: string[]; role: string }) {
	const body = new jose.SignJWT({
		sub: claims.azureOid, email: claims.email, name: claims.name,
		orgId: claims.orgId, tenantIds: claims.tenantIds, role: claims.role,
	}).setIssuedAt().setExpirationTime('24h');

	if (isRS256Configured(c.env)) {
		const privateKey = await getRS256PrivateKey(c.env.RS256_PRIVATE_KEY!);
		return body.setProtectedHeader({ alg: 'RS256', kid: 'tenantiq-rs256-1' }).sign(privateKey);
	}

	const secret = getHS256Secret(c.env.JWT_SECRET);
	return body.setProtectedHeader({ alg: 'HS256' }).sign(secret);
}

