/**
 * Storage Analytics API Routes — OneDrive, SharePoint usage, quotas, recommendations.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { GraphClient } from '../lib/graph-client';
import { getSelectedTenant } from '../lib/tenant-selector';
import { scanOneDriveUsage, scanSharePointUsage } from '../lib/storage/storage-scanner';
import { buildFullScanResult } from '../lib/storage/storage-analyzer';
import type { StorageScanResult } from '../lib/storage/storage-types';

export const storageAnalyticsRoutes = new Hono<AppEnv>();
storageAnalyticsRoutes.use('*', authMiddleware);

/** Resolve tenant and its Azure ID, return null tuple on failure. */
async function resolveTenant(c: any) {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return { tenantId: null, azureTenantId: null, error: 'No tenant', status: 400 };
	const row = await (c.env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(tenantId) as any).first() as { azure_tenant_id: string } | null;
	if (!row?.azure_tenant_id) return { tenantId, azureTenantId: null, error: 'Tenant not found', status: 404 };
	const hasToken = await c.env.KV.get(`graph:${row.azure_tenant_id}:access_token`) ||
		await c.env.KV.get(`graph:${row.azure_tenant_id}:refresh_token`);
	if (!hasToken) return { tenantId, azureTenantId: row.azure_tenant_id, error: 'No Graph API token', status: 403 };
	return { tenantId, azureTenantId: row.azure_tenant_id, error: null, status: 200 };
}

// GET / — cached overview
storageAnalyticsRoutes.get('/', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ overview: null, sites: [], message: 'No tenant' });
	const cached = await c.env.KV.get(`storage:${tenantId}:full`, 'json') as StorageScanResult | null;
	if (cached) return c.json(cached);
	return c.json({ overview: null, oneDriveUsers: [], sharePointSites: [], recommendations: [], unusedLicenses: [] });
});

// POST /scan — trigger full storage scan
storageAnalyticsRoutes.post('/scan', async (c) => {
	const { tenantId, azureTenantId, error, status } = await resolveTenant(c);
	if (error) return c.json({ error }, status as 400 | 403 | 404);

	try {
		const graph = new GraphClient(c.env as any, azureTenantId!);
		const [users, sites] = await Promise.all([
			scanOneDriveUsage(graph),
			scanSharePointUsage(graph),
		]);
		const result = buildFullScanResult(users, sites);
		await c.env.KV.put(`storage:${tenantId}:full`, JSON.stringify(result), { expirationTtl: 3600 });

		// Persist scan to D1
		const scanId = crypto.randomUUID();
		const now = Date.now();
		await c.env.DB.prepare(
			`INSERT INTO storage_analytics (id, org_id, tenant_id, scan_type, data, total_used_gb, total_allocated_gb, top_consumers, recommendations, scanned_at, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		).bind(
			scanId, c.get('user').orgId, tenantId, 'full',
			JSON.stringify({ oneDriveUsers: users.length, sharePointSites: sites.length }),
			result.overview.totalUsedGB, result.overview.totalAllocatedGB,
			JSON.stringify(users.slice(0, 10).map(u => ({ name: u.displayName, gb: u.usedGB }))),
			JSON.stringify(result.recommendations),
			now, now,
		).run();

		return c.json({ success: true, ...result });
	} catch (err) {
		console.error('Storage scan failed:', err);
		return c.json({ error: 'Scan failed' }, 500);
	}
});

// GET /onedrive — OneDrive per-user breakdown
storageAnalyticsRoutes.get('/onedrive', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ users: [] });
	const cached = await c.env.KV.get(`storage:${tenantId}:full`, 'json') as StorageScanResult | null;
	return c.json({ users: cached?.oneDriveUsers || [] });
});

// GET /sharepoint — SharePoint per-site breakdown
storageAnalyticsRoutes.get('/sharepoint', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ sites: [] });
	const cached = await c.env.KV.get(`storage:${tenantId}:full`, 'json') as StorageScanResult | null;
	return c.json({ sites: cached?.sharePointSites || [] });
});

// GET /recommendations — optimization suggestions
storageAnalyticsRoutes.get('/recommendations', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ recommendations: [] });
	const cached = await c.env.KV.get(`storage:${tenantId}:full`, 'json') as StorageScanResult | null;
	return c.json({ recommendations: cached?.recommendations || [] });
});

// GET /unused-licenses — unused storage license report
storageAnalyticsRoutes.get('/unused-licenses', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ licenses: [] });
	const cached = await c.env.KV.get(`storage:${tenantId}:full`, 'json') as StorageScanResult | null;
	return c.json({ licenses: cached?.unusedLicenses || [] });
});
