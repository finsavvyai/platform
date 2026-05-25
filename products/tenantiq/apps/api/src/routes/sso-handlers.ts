/**
 * SSO Connection Handlers — update and test operations.
 * Split from sso.ts to respect 200-line file limit.
 */

import type { Context } from 'hono';
import type { AppEnv } from '../app/types';
import { forbidden, validationError, notFound } from '../lib/errors';
import { updateSchema } from './sso-schemas';

/** Require admin role or throw forbidden */
function requireAdmin(role: string): void {
	if (!['admin', 'tenant_admin', 'super_admin', 'platform_admin'].includes(role)) {
		throw forbidden('Admin role required');
	}
}

/** PATCH /api/sso/:id — Update SSO connection (admin only) */
export async function handleUpdateConnection(c: Context<AppEnv>) {
	const user = c.get('user');
	const orgId = user.orgId;
	const connId = c.req.param('id');
	if (!orgId) throw validationError('No organization');
	requireAdmin(user.role);

	const body = await c.req.json().catch(() => ({}));
	const parsed = updateSchema.safeParse(body);
	if (!parsed.success) {
		throw validationError(parsed.error.issues[0].message, { issues: parsed.error.issues });
	}

	const conn = await c.env.DB.prepare(
		'SELECT id FROM sso_connections WHERE id = ? AND org_id = ?'
	).bind(connId, orgId).first();
	if (!conn) throw notFound('SSO connection');

	const data = parsed.data;
	const sets: string[] = [];
	const vals: unknown[] = [];

	const ALLOWED_COLUMNS: Record<string, string> = {
		provider: 'provider', displayName: 'display_name', domain: 'domain',
		issuerUrl: 'issuer_url', clientId: 'client_id', metadataUrl: 'metadata_url',
		certificate: 'certificate', jitEnabled: 'jit_enabled', status: 'status',
	};

	for (const [key, val] of Object.entries(data)) {
		if (val === undefined) continue;
		const col = ALLOWED_COLUMNS[key];
		if (!col) continue;
		const dbVal = typeof val === 'boolean' ? (val ? 1 : 0) : val;
		sets.push(`${col} = ?`);
		vals.push(dbVal);
	}

	if (sets.length === 0) throw validationError('No fields to update');
	sets.push('updated_at = ?');
	vals.push(Date.now());
	vals.push(connId, orgId);

	await c.env.DB.prepare(
		`UPDATE sso_connections SET ${sets.join(', ')} WHERE id = ? AND org_id = ?`
	).bind(...vals).run();

	return c.json({ success: true });
}

/** POST /api/sso/:id/test — Test SSO connection */
export async function handleTestConnection(c: Context<AppEnv>) {
	const user = c.get('user');
	const orgId = user.orgId;
	const connId = c.req.param('id');
	if (!orgId) throw validationError('No organization');

	const conn = await c.env.DB.prepare(
		'SELECT * FROM sso_connections WHERE id = ? AND org_id = ?'
	).bind(connId, orgId).first<Record<string, unknown>>();
	if (!conn) throw notFound('SSO connection');

	const checks: Array<{ name: string; passed: boolean; message: string }> = [];

	checks.push({
		name: 'Configuration',
		passed: Boolean(conn.issuer_url || conn.metadata_url),
		message: conn.issuer_url || conn.metadata_url
			? 'Provider URL configured'
			: 'Missing issuer or metadata URL',
	});

	if (conn.provider === 'oidc') {
		checks.push({
			name: 'Client ID',
			passed: Boolean(conn.client_id),
			message: conn.client_id ? 'Client ID set' : 'Missing client ID',
		});
	}

	if (conn.provider === 'saml') {
		checks.push({
			name: 'Certificate',
			passed: Boolean(conn.certificate),
			message: conn.certificate ? 'Certificate uploaded' : 'Missing certificate',
		});
	}

	if (conn.metadata_url) {
		await validateMetadataEndpoint(conn.metadata_url as string, checks);
	}

	return c.json({ success: checks.every((ch) => ch.passed), checks });
}

// Anchored list (exact host or `.suffix`). No bare substrings — avoids
// `dev-` accidentally matching `attacker-dev-...`.
const ALLOWED_IDP_HOSTS = [
	'login.microsoftonline.com',
	'login.microsoft.com',
	'sts.windows.net',
	'accounts.google.com',
	'.okta.com',
	'.auth0.com',
	'.onelogin.com',
	'.ping-eng.com',
	'.pingone.com',
];

/** Validate metadata URL reachability (restricted to known IdP domains to prevent SSRF) */
async function validateMetadataEndpoint(
	metadataUrl: string,
	checks: Array<{ name: string; passed: boolean; message: string }>,
): Promise<void> {
	const { checkOutboundUrl } = await import('../lib/ssrf-guard');
	const guard = checkOutboundUrl(metadataUrl, {
		requireHttps: true,
		allowedHosts: ALLOWED_IDP_HOSTS,
	});
	if (!guard.ok) {
		checks.push({
			name: 'Metadata Endpoint',
			passed: false,
			message: 'URL must be HTTPS and from a known identity provider domain',
		});
		return;
	}
	try {
		const resp = await fetch(metadataUrl, {
			signal: AbortSignal.timeout(5000),
			redirect: 'error',
		});
		checks.push({
			name: 'Metadata Endpoint',
			passed: resp.ok,
			message: resp.ok
				? `Endpoint reachable (${resp.status})`
				: `Endpoint returned ${resp.status}`,
		});
	} catch {
		checks.push({
			name: 'Metadata Endpoint',
			passed: false,
			message: 'Endpoint unreachable or invalid URL',
		});
	}
}
