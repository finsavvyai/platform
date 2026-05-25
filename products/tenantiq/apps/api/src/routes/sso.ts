/**
 * SSO Connection Management API
 * Per-org SAML/OIDC identity provider configuration.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/ratelimit';
import { forbidden, validationError, notFound } from '../lib/errors';
import { createSchema } from './sso-schemas';
import { handleUpdateConnection, handleTestConnection } from './sso-handlers';

export const ssoRoutes = new Hono<AppEnv>();
// Ratelimit before auth so unauthenticated requests still count against the
// bucket (prevents credential stuffing from bypassing the limiter at the 401).
ssoRoutes.use('*', rateLimitMiddleware({ limit: 30, windowSeconds: 60, keyPrefix: 'sso' }));
ssoRoutes.use('*', authMiddleware);

// GET /api/sso — List SSO connections for current org
ssoRoutes.get('/', async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	if (!orgId) return c.json({ connections: [] });

	const result = await c.env.DB.prepare(
		'SELECT * FROM sso_connections WHERE org_id = ? ORDER BY created_at DESC'
	).bind(orgId).all();

	return c.json({ connections: result.results });
});

// POST /api/sso — Create SSO connection (admin only)
ssoRoutes.post('/', async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	if (!orgId) throw validationError('No organization');
	if (!['admin', 'tenant_admin', 'super_admin', 'platform_admin'].includes(user.role)) {
		throw forbidden('Admin role required');
	}

	const body = await c.req.json().catch(() => ({}));
	const parsed = createSchema.safeParse(body);
	if (!parsed.success) {
		throw validationError(parsed.error.issues[0].message, { issues: parsed.error.issues });
	}

	const data = parsed.data;
	const id = crypto.randomUUID();
	const now = Date.now();

	// Check for duplicate domain within org
	const existing = await c.env.DB.prepare(
		'SELECT id FROM sso_connections WHERE org_id = ? AND domain = ?'
	).bind(orgId, data.domain).first();
	if (existing) {
		throw validationError('Domain already configured', { domain: data.domain });
	}

	await c.env.DB.prepare(
		`INSERT INTO sso_connections (id, org_id, provider, display_name, domain,
		 issuer_url, client_id, metadata_url, certificate, jit_enabled,
		 status, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'inactive', ?, ?)`
	).bind(
		id, orgId, data.provider, data.displayName, data.domain,
		data.issuerUrl ?? null, data.clientId ?? null,
		data.metadataUrl ?? null, data.certificate ?? null,
		data.jitEnabled ? 1 : 0, now, now
	).run();

	return c.json({ id, success: true }, 201);
});

// PATCH /api/sso/:id — Update SSO connection (admin only)
ssoRoutes.patch('/:id', handleUpdateConnection);

// DELETE /api/sso/:id — Delete SSO connection (admin only)
ssoRoutes.delete('/:id', async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	const connId = c.req.param('id');
	if (!orgId) throw validationError('No organization');
	if (!['admin', 'tenant_admin', 'super_admin', 'platform_admin'].includes(user.role)) {
		throw forbidden('Admin role required');
	}

	const result = await c.env.DB.prepare(
		'DELETE FROM sso_connections WHERE id = ? AND org_id = ?'
	).bind(connId, orgId).run();

	if (!result.meta.changes) throw notFound('SSO connection');
	return c.json({ success: true });
});

// POST /api/sso/:id/test — Test SSO connection
ssoRoutes.post('/:id/test', handleTestConnection);
