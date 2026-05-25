/**
 * Copilot Usage Monitoring — track M365 Copilot adoption post-deployment.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { GraphClient } from '../lib/graph-client';
import { getSelectedTenant } from '../lib/tenant-selector';
import { buildAdoption, buildRoi, flagInactive } from '../lib/copilot/usage-analytics';

export const copilotUsageRoutes = new Hono<AppEnv>();
copilotUsageRoutes.use('*', authMiddleware);

// GET /api/copilot-usage — Get usage data
copilotUsageRoutes.get('/', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ usage: null });

	const cached = await c.env.KV.get(`copilot-usage:${tenantId}`, 'json');
	if (cached) return c.json(cached);

	return c.json({ usage: null, message: 'Run a usage scan to track Copilot adoption.' });
});

// POST /api/copilot-usage/scan — Fetch Copilot usage from Graph
copilotUsageRoutes.post('/scan', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const db = c.env.DB;
	const tenant = await db.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(tenantId).first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) return c.json({ error: 'Tenant not found' }, 404);

	const hasToken = await c.env.KV.get(`graph:${tenant.azure_tenant_id}:access_token`) ||
		await c.env.KV.get(`graph:${tenant.azure_tenant_id}:refresh_token`);
	if (!hasToken) return c.json({ error: 'No Graph API token.', graphTokenMissing: true }, 403);

	try {
		const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);

		let copilotUsers: any[] = [];
		try {
			const report = await graph.fetch("/reports/getMicrosoft365CopilotUsageUserDetail(period='D30')");
			copilotUsers = report.value || [];
		} catch {
			return buildLicenseFallback(db, tenantId, c.env.KV);
		}

		const adoption = buildAdoption(copilotUsers);
		const inactive = flagInactive(copilotUsers);
		const roi = buildRoi(adoption.activeUsers, adoption.totalLicensed);

		const result = { usage: { ...adoption, source: 'graph-report' }, roi, inactive, scannedAt: new Date().toISOString() };
		await c.env.KV.put(`copilot-usage:${tenantId}`, JSON.stringify(result), { expirationTtl: 3600 });
		return c.json({ success: true, ...result });
	} catch (err) {
		console.error('Copilot usage scan failed:', err);
		return c.json({ error: 'Scan failed' }, 500);
	}
});

async function buildLicenseFallback(db: D1Database, tenantId: string, kv: KVNamespace) {
	const [users, licenses] = await Promise.all([
		db.prepare('SELECT display_name, mail FROM users_cache WHERE tenant_id = ?').bind(tenantId).all().catch(() => ({ results: [] })),
		db.prepare("SELECT sku_part_number, consumed_units FROM licenses_cache WHERE tenant_id = ? AND sku_part_number LIKE '%COPILOT%'").bind(tenantId).all().catch(() => ({ results: [] })),
	]);

	const copilotLicenses = licenses.results as Array<{ sku_part_number: string; consumed_units: number }>;
	const totalCopilotSeats = copilotLicenses.reduce((s, l) => s + Number(l.consumed_units ?? 0), 0);
	const roi = buildRoi(0, totalCopilotSeats);

	const result = {
		usage: { totalLicensed: totalCopilotSeats, activeUsers: 0, adoptionRate: 0, totalUsers: (users.results || []).length, copilotSkus: copilotLicenses.map(l => ({ sku: l.sku_part_number, seats: l.consumed_units })), source: 'license-based' as const },
		roi, inactive: [], scannedAt: new Date().toISOString(),
	};

	await kv.put(`copilot-usage:${tenantId}`, JSON.stringify(result), { expirationTtl: 3600 });
	return new Response(JSON.stringify({ success: true, ...result }), { headers: { 'Content-Type': 'application/json' } });
}
