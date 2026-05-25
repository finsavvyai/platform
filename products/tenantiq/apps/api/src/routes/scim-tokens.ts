/**
 * SCIM Bearer Token Admin API.
 *
 * Auth'd by the regular user JWT (NOT the SCIM token itself). Admins generate
 * a SCIM bearer token that they hand to Okta/Entra to drive provisioning.
 *
 * - GET    /api/sso/scim-tokens         — list tokens for current org
 * - POST   /api/sso/scim-tokens         — generate new token (plaintext shown ONCE)
 * - DELETE /api/sso/scim-tokens/:id     — revoke token (soft delete)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/ratelimit';
import { forbidden, validationError, notFound } from '../lib/errors';
import { generateScimTokenPlaintext, sha256Hex } from '../middleware/scim-auth';

export const scimTokensRoutes = new Hono<AppEnv>();
scimTokensRoutes.use('*', rateLimitMiddleware({ limit: 30, windowSeconds: 60, keyPrefix: 'scim-tokens' }));
scimTokensRoutes.use('*', authMiddleware);

const ADMIN_ROLES = ['admin', 'tenant_admin', 'super_admin', 'platform_admin'];

const createSchema = z.object({
	displayName: z.string().min(1).max(100),
	scopes: z.array(z.string()).optional(),
});

const DEFAULT_SCOPES = ['users:read', 'users:write', 'groups:read', 'groups:write'];
const ALLOWED_SCOPES = new Set(DEFAULT_SCOPES);

scimTokensRoutes.get('/', async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	if (!orgId) return c.json({ tokens: [] });

	const r = await c.env.DB.prepare(
		`SELECT id, display_name, scopes_json, created_at, created_by, last_used_at, revoked_at, revoked_by
		 FROM scim_bearer_tokens WHERE org_id = ? ORDER BY created_at DESC`,
	).bind(orgId).all<{
		id: string; display_name: string; scopes_json: string;
		created_at: number; created_by: string; last_used_at: number | null;
		revoked_at: number | null; revoked_by: string | null;
	}>();

	const tokens = (r.results ?? []).map((row) => ({
		id: row.id,
		displayName: row.display_name,
		scopes: safeParseScopes(row.scopes_json),
		createdAt: row.created_at,
		createdBy: row.created_by,
		lastUsedAt: row.last_used_at,
		revokedAt: row.revoked_at,
		revokedBy: row.revoked_by,
		status: row.revoked_at ? 'revoked' : 'active',
	}));
	return c.json({ tokens });
});

scimTokensRoutes.post('/', async (c) => {
	const user = c.get('user');
	if (!user.orgId) throw validationError('No organization');
	if (!ADMIN_ROLES.includes(user.role)) throw forbidden('Admin role required');

	const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
	if (!parsed.success) throw validationError(parsed.error.message);

	const requestedScopes = parsed.data.scopes ?? DEFAULT_SCOPES;
	const scopes = requestedScopes.filter((s) => ALLOWED_SCOPES.has(s));
	if (scopes.length === 0) throw validationError('At least one valid scope required');

	const plaintext = generateScimTokenPlaintext();
	const hash = await sha256Hex(plaintext);
	const id = crypto.randomUUID();
	const now = Math.floor(Date.now() / 1000);

	await c.env.DB.prepare(
		`INSERT INTO scim_bearer_tokens (id, org_id, token_hash, display_name, scopes_json, created_at, created_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).bind(id, user.orgId, hash, parsed.data.displayName, JSON.stringify(scopes), now, user.email).run();

	// Plaintext returned ONCE. Frontend must surface and warn user it cannot be retrieved later.
	return c.json({
		id, displayName: parsed.data.displayName, scopes,
		createdAt: now, createdBy: user.email, plaintextToken: plaintext,
	}, 201);
});

scimTokensRoutes.delete('/:id', async (c) => {
	const user = c.get('user');
	if (!user.orgId) throw validationError('No organization');
	if (!ADMIN_ROLES.includes(user.role)) throw forbidden('Admin role required');

	const id = c.req.param('id');
	const now = Math.floor(Date.now() / 1000);
	const result = await c.env.DB.prepare(
		`UPDATE scim_bearer_tokens SET revoked_at = ?, revoked_by = ?
		 WHERE id = ? AND org_id = ? AND revoked_at IS NULL`,
	).bind(now, user.email, id, user.orgId).run();

	if (!result.meta.changes) throw notFound('Token');
	return c.json({ success: true });
});

function safeParseScopes(json: string): string[] {
	try {
		const v = JSON.parse(json);
		return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [];
	} catch {
		return [];
	}
}
