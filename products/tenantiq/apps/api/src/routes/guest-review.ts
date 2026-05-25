/**
 * Guest User Review API Routes
 * GET  /results  — latest review results from KV
 * POST /run      — trigger manual review
 * POST /approve  — approve guest removal
 * GET  /history  — past review runs
 */
import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/auth.middleware';
import { getSelectedTenant } from '../lib/tenant-selector';
import { GraphClient } from '../lib/graph-client';

export const guestReviewRoutes = new Hono<AppEnv>();
guestReviewRoutes.use('*', authMiddleware);

// GET /api/guest-review/results — latest review from KV
guestReviewRoutes.get('/results', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const cached = await c.env.KV.get(`guest-review:${tenantId}`, 'json');
	if (!cached) return c.json({ results: null, message: 'No review data available. Run a review first.' });

	return c.json({ results: cached });
});

// POST /api/guest-review/run — trigger manual guest review
guestReviewRoutes.post('/run', async (c) => {
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
		const guests = await graph.fetchAll<{
			id: string; displayName: string; mail: string | null;
			userPrincipalName: string;
			signInActivity?: { lastSignInDateTime?: string };
		}>(`https://graph.microsoft.com/v1.0/users?$filter=userType eq 'Guest'&$select=id,displayName,mail,userPrincipalName,signInActivity&$top=999`);

		const now = Date.now();
		const DAY_MS = 86_400_000;
		const reviewed = guests.map((g) => {
			const lastSignIn = g.signInActivity?.lastSignInDateTime ?? null;
			const days = lastSignIn ? Math.floor((now - new Date(lastSignIn).getTime()) / DAY_MS) : null;
			let status: string = 'active';
			if (days !== null && days >= 180) status = 'remove_candidate';
			else if (days !== null && days >= 90) status = 'stale';
			else if (days === null) status = 'stale';
			return { id: g.id, displayName: g.displayName, mail: g.mail, userPrincipalName: g.userPrincipalName, lastSignIn, daysSinceSignIn: days, status };
		});

		const result = {
			tenantId,
			runAt: new Date().toISOString(),
			total: reviewed.length,
			stale: reviewed.filter((g) => g.status === 'stale').length,
			removeCandidates: reviewed.filter((g) => g.status === 'remove_candidate').length,
			guests: reviewed,
		};

		await c.env.KV.put(`guest-review:${tenantId}`, JSON.stringify(result), { expirationTtl: 90 * 24 * 3600 });
		await storeHistoryEntry(c.env.DB, tenantId, result);

		return c.json({ success: true, ...result });
	} catch (err) {
		console.error('Guest review failed:', err);
		return c.json({ error: 'Review failed' }, 500);
	}
});

// POST /api/guest-review/approve — approve removal of selected guests (admin+ only)
guestReviewRoutes.post('/approve', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const body = await c.req.json<{ guestIds: string[] }>().catch(() => ({ guestIds: [] }));
	if (!body.guestIds?.length) return c.json({ error: 'No guest IDs provided' }, 400);

	const tenant = await c.env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(tenantId).first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) return c.json({ error: 'Tenant not found' }, 404);

	for (const guestId of body.guestIds) {
		await c.env.REMEDIATION_QUEUE.send({
			type: 'remove_guest',
			tenantId,
			azureTenantId: tenant.azure_tenant_id,
			resources: [{ id: guestId }],
		});
	}

	return c.json({ success: true, queued: body.guestIds.length });
});

// GET /api/guest-review/history — past review runs
guestReviewRoutes.get('/history', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const result = await c.env.DB.prepare(
		'SELECT id, tenant_id, run_at, total_guests, stale_count, remove_candidates FROM guest_review_history WHERE tenant_id = ? ORDER BY run_at DESC LIMIT 20',
	).bind(tenantId).all().catch(() => ({ results: [] }));

	return c.json({ history: result.results });
});

async function storeHistoryEntry(db: D1Database, tenantId: string, result: any): Promise<void> {
	const id = crypto.randomUUID();
	await db.prepare(
		'INSERT INTO guest_review_history (id, tenant_id, run_at, total_guests, stale_count, remove_candidates) VALUES (?, ?, ?, ?, ?, ?)',
	).bind(id, tenantId, result.runAt, result.total, result.stale, result.removeCandidates)
		.run().catch(() => {});
}
