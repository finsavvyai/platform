/**
 * SSO-03: Login initiation endpoint.
 *
 * GET /api/sso/login/:domain
 * Public endpoint (no authMiddleware) — user is not authenticated yet.
 * Looks up the active SSO connection for the domain, creates a one-time
 * KV nonce (TTL 300s per SSO-06), then redirects to the IdP.
 */

import { Hono } from 'hono';
import { WorkOS } from '@workos-inc/node';
import type { Context } from 'hono';
import type { AppEnv } from '../app/types';
import { rateLimitMiddleware } from '../middleware/ratelimit';

export const ssoLoginRoutes = new Hono<AppEnv>();

ssoLoginRoutes.use(
	'/login/*',
	rateLimitMiddleware({ limit: 10, windowSeconds: 60, keyPrefix: 'sso-login' }),
);

/** Handle GET /api/sso/login/:domain */
export async function handleSsoLogin(c: Context<AppEnv>): Promise<Response> {
	const domain = c.req.param('domain');

	// Look up an active SSO connection for this domain
	const conn = await c.env.DB.prepare(
		'SELECT * FROM sso_connections WHERE domain = ? AND status = ? LIMIT 1',
	)
		.bind(domain, 'active')
		.first<{
			id: string;
			org_id: string;
			provider: 'oidc' | 'saml';
			issuer_url: string | null;
			client_id: string | null;
			workos_connection_id: string | null;
			status: string;
			domain: string;
		}>();

	if (!conn || conn.status !== 'active') {
		return c.json({ error: 'SSO not configured for this domain' }, 404);
	}

	// Generate a one-time nonce for CSRF protection (SSO-06)
	const nonce = crypto.randomUUID();
	await c.env.KV.put(
		`sso:state:${nonce}`,
		JSON.stringify({ orgId: conn.org_id, domain, connId: conn.id }),
		{ expirationTtl: 300 },
	);

	if (conn.provider === 'saml') {
		return handleSamlLogin(c, conn, nonce);
	}
	return handleOidcLogin(c, conn, nonce);
}

function handleOidcLogin(
	c: Context<AppEnv>,
	conn: { issuer_url: string | null; client_id: string | null },
	nonce: string,
): Response {
	const apiBaseUrl = c.env.API_BASE_URL ?? 'https://api.tenantiq.io';
	const redirectUri = `${apiBaseUrl}/api/sso/callback/oidc`;
	const params = new URLSearchParams({
		response_type: 'code',
		client_id: conn.client_id!,
		redirect_uri: redirectUri,
		scope: 'openid email profile',
		state: nonce,
	});
	return c.redirect(`${conn.issuer_url}/authorize?${params.toString()}`);
}

function handleSamlLogin(
	c: Context<AppEnv>,
	conn: { workos_connection_id: string | null },
	nonce: string,
): Response {
	const workos = new WorkOS(c.env.WORKOS_API_KEY ?? '');
	const apiBaseUrl = c.env.API_BASE_URL ?? 'https://api.tenantiq.io';
	const authUrl = workos.sso.getAuthorizationUrl({
		clientId: c.env.WORKOS_CLIENT_ID ?? '',
		connection: conn.workos_connection_id!,
		redirectUri: `${apiBaseUrl}/api/sso/callback/saml`,
		state: nonce,
	});
	return c.redirect(authUrl);
}

ssoLoginRoutes.get('/login/:domain', handleSsoLogin);
