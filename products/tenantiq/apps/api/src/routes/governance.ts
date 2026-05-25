/**
 * SharePoint/Teams Governance API Routes
 */

import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { GraphClient } from '../lib/graph-client';
import { syncWorkspaces } from '../lib/governance/workspace-sync';
import { getSelectedTenant } from '../lib/tenant-selector';

export const governanceRoutes = new Hono<AppEnv>();
governanceRoutes.use('*', authMiddleware);

// POST /api/governance/sync — Sync workspace inventory
governanceRoutes.post('/sync', async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const db = c.env.DB;
	const tenant = await db.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(tenantId).first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) return c.json({ error: 'Tenant not found' }, 404);

	const [accessToken, refreshToken] = await Promise.all([
		c.env.KV.get(`graph:${tenant.azure_tenant_id}:access_token`),
		c.env.KV.get(`graph:${tenant.azure_tenant_id}:refresh_token`),
	]);
	const hasToken = accessToken || refreshToken;
	if (!hasToken) return c.json({ error: 'No Graph API token. Please sync your tenant first.', graphTokenMissing: true }, 403);

	try {
		const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
		const result = await syncWorkspaces((p) => graph.fetch(p), db, tenantId);
		return c.json({ success: true, workspaces: result.count, errors: result.errors });
	} catch (err) {
		console.error('Governance sync failed:', err);
		return c.json({ error: 'Sync failed' }, 500);
	}
});

// GET /api/governance/workspaces — List workspaces
governanceRoutes.get('/workspaces', async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ workspaces: [] });

	const filter = c.req.query('filter') || 'all';
	const type = c.req.query('type') || 'all';

	let query = 'SELECT * FROM workspace_inventory WHERE tenant_id = ?';
	const params: string[] = [tenantId];

	if (filter === 'inactive') { query += ' AND status = ?'; params.push('inactive'); }
	if (filter === 'external') { query += " AND external_sharing != 'internal_only'"; }
	if (filter === 'no_owner') { query += ' AND owner_count = 0'; }
	if (type !== 'all') { query += ' AND workspace_type = ?'; params.push(type); }

	query += ' ORDER BY member_count DESC LIMIT 100';
	// Parallel: fetch filtered list + summary counts
	const [result, all] = await Promise.all([
		c.env.DB.prepare(query).bind(...params).all().catch(() => ({ results: [] })),
		c.env.DB.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN workspace_type = \'team\' THEN 1 ELSE 0 END) as teams, SUM(CASE WHEN guest_count > 0 THEN 1 ELSE 0 END) as with_guests, SUM(CASE WHEN owner_count = 0 THEN 1 ELSE 0 END) as no_owner, SUM(storage_used_bytes) as total_storage FROM workspace_inventory WHERE tenant_id = ?')
			.bind(tenantId).first().catch(() => null) as any,
	]);

	return c.json({
		workspaces: result.results,
		summary: {
			total: Number(all?.total ?? 0),
			teams: Number(all?.teams ?? 0),
			withGuests: Number(all?.with_guests ?? 0),
			noOwner: Number(all?.no_owner ?? 0),
			totalStorageBytes: Number(all?.total_storage ?? 0),
		},
	});
});

// GET /api/governance/workspaces/:id — Workspace detail
governanceRoutes.get('/workspaces/:id', async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	const wsId = c.req.param('id');
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const ws = await c.env.DB.prepare('SELECT * FROM workspace_inventory WHERE id = ? AND tenant_id = ?')
		.bind(wsId, tenantId).first();
	if (!ws) return c.json({ error: 'Workspace not found' }, 404);
	return c.json({ workspace: ws });
});
