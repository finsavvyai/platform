/**
 * MCP API key management.
 *
 *   GET    /api/mcp-keys           list keys (no plaintext, ever)
 *   POST   /api/mcp-keys           create — returns plaintext ONCE
 *   DELETE /api/mcp-keys/:id       revoke
 *
 * Plaintext format: `tiq_<43 base64url chars>`. We store SHA-256 of the
 * full plaintext. The auth middleware verifies inbound `Bearer tiq_*` by
 * hashing the presented value and looking it up in mcp_api_keys.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { sha256Hex } from '../lib/hash';

export const mcpKeyRoutes = new Hono<AppEnv>();
mcpKeyRoutes.use('*', authMiddleware);

interface KeyRow {
	id: string; org_id: string; user_id: string; label: string;
	prefix: string; last_used_at: number | null; revoked_at: number | null;
	created_at: number;
}

mcpKeyRoutes.get('/', async (c) => {
	const orgId = c.get('user')?.orgId;
	if (!orgId) return c.json({ error: 'No organization context' }, 400);

	const rows = await c.env.DB.prepare(
		`SELECT id, org_id, user_id, label, prefix, last_used_at, revoked_at, created_at
		 FROM mcp_api_keys WHERE org_id = ? ORDER BY created_at DESC LIMIT 100`,
	).bind(orgId).all<KeyRow>().catch(() => ({ results: [] as KeyRow[] }));

	return c.json({
		keys: (rows.results ?? []).map((r) => ({
			id: r.id, label: r.label, prefix: r.prefix,
			lastUsedAt: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
			revokedAt: r.revoked_at ? new Date(r.revoked_at).toISOString() : null,
			createdAt: new Date(r.created_at).toISOString(),
			active: r.revoked_at === null,
		})),
	});
});

mcpKeyRoutes.post('/', async (c) => {
	const user = c.get('user');
	if (!user?.orgId) return c.json({ error: 'No organization context' }, 400);
	if (!isAdminRole(user.role)) {
		return c.json({ error: { code: 'FORBIDDEN', message: 'Admin role required to mint API keys' } }, 403);
	}

	const body = await c.req.json<{ label?: string }>().catch(() => ({} as { label?: string }));
	const label = (body.label ?? '').trim().slice(0, 80);
	if (!label) return c.json({ error: 'label required' }, 400);

	const plaintext = await generateKey();
	const hash = await sha256Hex(plaintext);
	const id = crypto.randomUUID();
	const now = Date.now();

	await c.env.DB.prepare(
		`INSERT INTO mcp_api_keys (id, org_id, user_id, label, key_hash, prefix, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).bind(id, user.orgId, user.sub, label, hash, plaintext.slice(0, 12), now).run();

	return c.json({
		id, label, plaintext,
		prefix: plaintext.slice(0, 12),
		createdAt: new Date(now).toISOString(),
		message: 'This is the only time the full key will be shown — store it now.',
	}, 201);
});

mcpKeyRoutes.delete('/:id', async (c) => {
	const user = c.get('user');
	if (!user?.orgId) return c.json({ error: 'No organization context' }, 400);
	if (!isAdminRole(user.role)) {
		return c.json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } }, 403);
	}
	const id = c.req.param('id');
	await c.env.DB.prepare(
		'UPDATE mcp_api_keys SET revoked_at = ? WHERE id = ? AND org_id = ?',
	).bind(Date.now(), id, user.orgId).run();
	return c.json({ id, revoked: true });
});

async function generateKey(): Promise<string> {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	const b64 = btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '');
	return `tiq_${b64}`;
}

function isAdminRole(role?: string): boolean {
	return role === 'admin' || role === 'tenant_admin' || role === 'super_admin' || role === 'platform_admin';
}
