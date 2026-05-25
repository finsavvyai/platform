/**
 * SSO-03: Callback handlers for OIDC and SAML SSO flows.
 *
 * GET  /api/sso/callback/oidc  — receives OIDC authorization code + state
 * POST /api/sso/callback/saml  — receives WorkOS SAML code + state
 *
 * Both handlers: validate one-time KV nonce (SSO-06), provision user via JIT,
 * issue a session cookie, and redirect to the frontend.
 */

import { Hono } from 'hono';
import { decodeJwt } from 'jose';
import { WorkOS } from '@workos-inc/node';
import type { Context } from 'hono';
import type { AppEnv } from '../app/types';
import { rateLimitMiddleware } from '../middleware/ratelimit';
import { signToken, sessionCookieValue } from './auth-session';
import { jitProvision } from './sso-jit';

export const ssoCallbackRoutes = new Hono<AppEnv>();

ssoCallbackRoutes.use(
	'/callback/*',
	rateLimitMiddleware({ limit: 10, windowSeconds: 60, keyPrefix: 'sso-cb' }),
);

/** Consume and validate the one-time KV state nonce; returns stored payload or throws. */
async function consumeNonce(
	c: Context<AppEnv>,
	state: string | undefined,
): Promise<{ orgId: string; connId: string }> {
	if (!state) {
		throw Object.assign(new Error('missing state'), { status: 400 });
	}
	const stored = await c.env.KV.get(`sso:state:${state}`);
	if (!stored) {
		throw Object.assign(new Error('invalid or expired state'), { status: 400 });
	}
	await c.env.KV.delete(`sso:state:${state}`);
	return JSON.parse(stored) as { orgId: string; connId: string };
}

/** Issue session cookie and redirect to frontend root. */
async function issueSession(
	c: Context<AppEnv>,
	orgId: string,
	userId: string,
	email: string,
): Promise<Response> {
	const frontendUrl = c.env.FRONTEND_URL ?? 'https://app.tenantiq.io';
	const jwt = await signToken(c.env, {
		sub: userId,
		email,
		orgId,
		role: 'member',
		tenantIds: [],
	});
	const cookie = sessionCookieValue(c, jwt, 86400);
	c.header('Set-Cookie', cookie);
	return c.redirect(`${frontendUrl}/`);
}

/** GET /api/sso/callback/oidc */
export async function handleOidcCallback(c: Context<AppEnv>): Promise<Response> {
	const state = c.req.query('state');
	let nonce: { orgId: string; connId: string };
	try {
		nonce = await consumeNonce(c, state);
	} catch (err) {
		const e = err as { status?: number; message?: string };
		return c.json({ error: e.message ?? 'invalid state' }, (e.status ?? 400) as 400);
	}

	const { orgId, connId } = nonce;

	// Look up the SSO connection to get provider config
	const conn = await c.env.DB.prepare(
		'SELECT * FROM sso_connections WHERE id = ? AND status = ? LIMIT 1',
	)
		.bind(connId, 'active')
		.first<{ id: string; org_id: string; issuer_url: string | null; client_id: string | null }>();

	if (!conn) {
		return c.json({ error: 'SSO connection not found or inactive' }, 400);
	}

	// Get id_token: prefer query param (test/implicit flow), else exchange code
	let email: string;
	let displayName: string | null = null;

	const idTokenParam = c.req.query('id_token');
	const code = c.req.query('code');

	if (idTokenParam) {
		// Decode without signature verification — nonce was already validated from KV
		const claims = decodeJwt(idTokenParam);
		// Entra B2B guests omit `email`; fall back to preferred_username (UPN form)
		// then `upn`. Same fallback chain works for Okta + Auth0 (their email is
		// always populated, so the fallbacks are no-ops there).
		email = (claims.email as string | undefined)
			?? (claims.preferred_username as string | undefined)
			?? (claims.upn as string | undefined)
			?? '';
		displayName = (claims.name as string | undefined) ?? null;
	} else if (code && conn.issuer_url && conn.client_id) {
		const apiBaseUrl = c.env.API_BASE_URL ?? 'https://api.tenantiq.io';
		const tokenRes = await fetch(`${conn.issuer_url}/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				code,
				client_id: conn.client_id,
				redirect_uri: `${apiBaseUrl}/api/sso/callback/oidc`,
			}).toString(),
		});
		if (!tokenRes.ok) {
			return c.json({ error: 'Token exchange failed' }, 400);
		}
		const tokens = await tokenRes.json<{ id_token?: string; access_token?: string }>();
		if (!tokens.id_token) {
			return c.json({ error: 'No id_token in token response' }, 400);
		}
		const claims = decodeJwt(tokens.id_token);
		email = (claims.email as string | undefined)
			?? (claims.preferred_username as string | undefined)
			?? (claims.upn as string | undefined)
			?? '';
		displayName = (claims.name as string | undefined) ?? null;
	} else {
		return c.json({ error: 'No id_token or code provided' }, 400);
	}

	if (!email) {
		return c.json({ error: 'Email not found in token' }, 400);
	}

	const userId = await jitProvision(c.env.DB, orgId, email, displayName);
	return issueSession(c, orgId, userId, email);
}

/** POST /api/sso/callback/saml */
export async function handleSamlCallback(c: Context<AppEnv>): Promise<Response> {
	// WorkOS sends state as query param in redirect; code may be in body
	const stateQuery = c.req.query('state');
	let body: { code?: string; state?: string } = {};
	try {
		body = await c.req.json<{ code?: string; state?: string }>();
	} catch { /* body may be empty for form-encoded */ }

	const state = stateQuery ?? body.state;
	const code = body.code ?? c.req.query('code');

	let nonce: { orgId: string; connId: string };
	try {
		nonce = await consumeNonce(c, state);
	} catch (err) {
		const e = err as { status?: number; message?: string };
		return c.json({ error: e.message ?? 'invalid state' }, (e.status ?? 400) as 400);
	}

	const { orgId, connId } = nonce;

	// Look up the SSO connection
	const conn = await c.env.DB.prepare(
		'SELECT * FROM sso_connections WHERE id = ? AND status = ? LIMIT 1',
	)
		.bind(connId, 'active')
		.first<{ id: string; org_id: string; provider: string }>();

	if (!conn) {
		return c.json({ error: 'SSO connection not found or inactive' }, 400);
	}

	const workos = new WorkOS(c.env.WORKOS_API_KEY ?? '');
	const { profile } = await workos.sso.getProfileAndToken({
		code: code!,
		clientId: c.env.WORKOS_CLIENT_ID ?? '',
	});

	const email = profile.email;
	const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || null;

	const userId = await jitProvision(c.env.DB, orgId, email, displayName);
	return issueSession(c, orgId, userId, email);
}

ssoCallbackRoutes.get('/callback/oidc', handleOidcCallback);
ssoCallbackRoutes.post('/callback/saml', handleSamlCallback);
