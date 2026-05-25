/**
 * Intune (Endpoint Manager) posture endpoints.
 *
 *   GET /api/intune/scan      → full inventory + findings (KV-cached 5min)
 *   GET /api/intune/summary   → just the rollup counts + posture score
 *   GET /api/intune/devices   → flat device list
 *   GET /api/intune/findings  → findings only
 *
 * Required Graph permissions:
 *   DeviceManagementManagedDevices.Read.All
 *   DeviceManagementConfiguration.Read.All
 *   DeviceManagementApps.Read.All
 */
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { GraphClient } from '../lib/graph-client';
import { fetchIntuneInventory } from '../lib/intune/graph-fetch';
import { assembleScan, type IntuneScanResult } from '../lib/intune/scanner';

export const intuneRoutes = new Hono<AppEnv>();
intuneRoutes.use('*', authMiddleware);

const CACHE_TTL = 300; // 5 min

intuneRoutes.get('/scan', async (c) => {
	const result = await loadScan(c.env, c.get('tenantId'));
	return c.json(result);
});

intuneRoutes.get('/summary', async (c) => {
	const result = await loadScan(c.env, c.get('tenantId'));
	if ('error' in result) return c.json(result, 503);
	return c.json({
		summary: result.summary,
		findingCount: result.findings.length,
		criticalCount: result.findings.filter((f) => f.severity === 'critical').length,
		highCount: result.findings.filter((f) => f.severity === 'high').length,
		scannedAt: result.scannedAt,
	});
});

intuneRoutes.get('/devices', async (c) => {
	const result = await loadScan(c.env, c.get('tenantId'));
	if ('error' in result) return c.json(result, 503);
	return c.json({ devices: result.devices, scannedAt: result.scannedAt });
});

intuneRoutes.get('/findings', async (c) => {
	const result = await loadScan(c.env, c.get('tenantId'));
	if ('error' in result) return c.json(result, 503);
	return c.json({ findings: result.findings, scannedAt: result.scannedAt });
});

async function loadScan(env: AppEnv['Bindings'], tenantId: string | undefined): Promise<IntuneScanResult | { error: string }> {
	if (!tenantId) return { error: 'No tenant context' };
	const cacheKey = `intune:scan:${tenantId}`;
	const cached = await env.KV.get(cacheKey, 'json') as IntuneScanResult | null;
	if (cached) return cached;
	try {
		const azureTenantId = await resolveAzureTenantId(env, tenantId);
		if (!azureTenantId) return { error: 'Tenant not connected to Microsoft Graph' };
		const graph = new GraphClient(env as unknown as ConstructorParameters<typeof GraphClient>[0], azureTenantId);
		const inventory = await fetchIntuneInventory(graph);
		const result = assembleScan(inventory.devices, inventory.compliancePolicies, inventory.appPolicies);
		await env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL });
		return result;
	} catch (err) {
		console.error('[intune.scan] failed', err);
		return { error: err instanceof Error ? err.message : 'Intune scan failed' };
	}
}

async function resolveAzureTenantId(env: AppEnv['Bindings'], tenantId: string): Promise<string | null> {
	const row = await env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ? LIMIT 1')
		.bind(tenantId)
		.first<{ azure_tenant_id: string | null }>()
		.catch(() => null);
	return row?.azure_tenant_id ?? null;
}
