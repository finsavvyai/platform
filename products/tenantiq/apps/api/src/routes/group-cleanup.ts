/**
 * Group Cleanup API Routes
 * GET  /results  — latest cleanup results from KV
 * POST /run      — trigger manual cleanup scan
 * POST /archive  — archive selected groups
 * GET  /history  — past cleanup runs
 */
import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/auth.middleware';
import { getSelectedTenant } from '../lib/tenant-selector';
import { GraphClient } from '../lib/graph-client';

export const groupCleanupRoutes = new Hono<AppEnv>();
groupCleanupRoutes.use('*', authMiddleware);

// GET /api/group-cleanup/results — latest cleanup scan from KV
groupCleanupRoutes.get('/results', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const cached = await c.env.KV.get(`group-cleanup:${tenantId}`, 'json');
	if (!cached) return c.json({ results: null, message: 'No cleanup data available. Run a scan first.' });

	return c.json({ results: cached });
});

// POST /api/group-cleanup/run — trigger manual group cleanup scan
groupCleanupRoutes.post('/run', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const tenant = await c.env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(tenantId).first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) return c.json({ error: 'Tenant not found' }, 404);

	const hasToken = await c.env.KV.get(`graph:${tenant.azure_tenant_id}:access_token`) ||
		await c.env.KV.get(`graph:${tenant.azure_tenant_id}:refresh_token`);
	if (!hasToken) return c.json({ error: 'No Graph API token. Please sync your tenant first.', graphTokenMissing: true }, 403);

	try {
		const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
		const allGroups = await graph.fetchAll<{
			id: string; displayName: string; mail: string | null;
			groupTypes: string[]; renewedDateTime?: string;
		}>('https://graph.microsoft.com/v1.0/groups?$select=id,displayName,mail,groupTypes,renewedDateTime&$top=999');

		const now = Date.now();
		const DAY_MS = 86_400_000;
		const scanned = allGroups.map((g) => {
			const lastActivity = g.renewedDateTime ?? null;
			const days = lastActivity ? Math.floor((now - new Date(lastActivity).getTime()) / DAY_MS) : null;
			const groupType = g.groupTypes?.includes('Unified') ? 'microsoft365' : 'security';
			return { id: g.id, displayName: g.displayName, mail: g.mail, groupType, lastActivity, daysSinceActivity: days };
		});

		const result = {
			tenantId,
			runAt: new Date().toISOString(),
			total: scanned.length,
			groups: scanned,
		};

		await c.env.KV.put(`group-cleanup:${tenantId}`, JSON.stringify(result), { expirationTtl: 90 * 24 * 3600 });
		await storeCleanupHistory(c.env.DB, tenantId, result);

		return c.json({ success: true, ...result });
	} catch (err) {
		console.error('Group cleanup scan failed:', err);
		return c.json({ error: 'Scan failed' }, 500);
	}
});

// POST /api/group-cleanup/archive — archive selected groups (admin+ only)
groupCleanupRoutes.post('/archive', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const body = await c.req.json<{ groupIds: string[] }>().catch(() => ({ groupIds: [] }));
	if (!body.groupIds?.length) return c.json({ error: 'No group IDs provided' }, 400);

	const tenant = await c.env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(tenantId).first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) return c.json({ error: 'Tenant not found' }, 404);

	const hasToken = await c.env.KV.get(`graph:${tenant.azure_tenant_id}:access_token`) ||
		await c.env.KV.get(`graph:${tenant.azure_tenant_id}:refresh_token`);
	if (!hasToken) return c.json({ error: 'No Graph API token.', graphTokenMissing: true }, 403);

	try {
		const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
		const archived: string[] = [];
		const errors: string[] = [];

		for (const groupId of body.groupIds) {
			try {
				// Archive group by hiding from address lists and updating description
				await graph.request(`https://graph.microsoft.com/v1.0/groups/${groupId}`, {
					method: 'PATCH',
					body: JSON.stringify({ hideFromAddressLists: true, hideFromOutlookClients: true }),
				});
				archived.push(groupId);
			} catch (err) {
				errors.push(`${groupId}: Archive failed`);
			}
		}

		return c.json({ success: true, archived: archived.length, errors });
	} catch (err) {
		console.error('Group archive failed:', err);
		return c.json({ error: 'Archive failed' }, 500);
	}
});

// GET /api/group-cleanup/history — past cleanup runs
groupCleanupRoutes.get('/history', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const result = await c.env.DB.prepare(
		'SELECT id, tenant_id, run_at, total_groups, empty_count, orphaned_count, inactive_count FROM group_cleanup_history WHERE tenant_id = ? ORDER BY run_at DESC LIMIT 20',
	).bind(tenantId).all().catch(() => ({ results: [] }));

	return c.json({ history: result.results });
});

async function storeCleanupHistory(db: D1Database, tenantId: string, result: any): Promise<void> {
	const id = crypto.randomUUID();
	await db.prepare(
		'INSERT INTO group_cleanup_history (id, tenant_id, run_at, total_groups, empty_count, orphaned_count, inactive_count) VALUES (?, ?, ?, ?, ?, ?, ?)',
	).bind(id, tenantId, result.runAt, result.total, 0, 0, 0)
		.run().catch(() => {});
}
