/**
 * Defender (XDR) coverage audit endpoints.
 *
 *   GET /api/defender/scan      → full audit + findings + controls (KV-cached 5min)
 *   GET /api/defender/summary   → just rollup
 *   GET /api/defender/controls  → flat control list
 *
 * Required Graph permission: SecurityEvents.Read.All.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { GraphClient } from '../lib/graph-client';
import { fetchDefenderInventory } from '../lib/defender/graph-fetch';
import { assembleDefenderScan, type DefenderScanResult } from '../lib/defender/scanner';

export const defenderRoutes = new Hono<AppEnv>();
defenderRoutes.use('*', authMiddleware);

const CACHE_TTL = 300;

defenderRoutes.get('/scan', async (c) => {
	const result = await loadScan(c.env, c.get('tenantId'));
	return c.json(result);
});

defenderRoutes.get('/summary', async (c) => {
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

defenderRoutes.get('/controls', async (c) => {
	const result = await loadScan(c.env, c.get('tenantId'));
	if ('error' in result) return c.json(result, 503);
	return c.json({ controls: result.controls, scannedAt: result.scannedAt });
});

async function loadScan(env: AppEnv['Bindings'], tenantId: string | undefined): Promise<DefenderScanResult | { error: string }> {
	if (!tenantId) return { error: 'No tenant context' };
	const cacheKey = `defender:scan:${tenantId}`;
	const cached = await env.KV.get(cacheKey, 'json') as DefenderScanResult | null;
	if (cached) return cached;
	try {
		const azureTenantId = await resolveAzureTenantId(env, tenantId);
		if (!azureTenantId) return { error: 'Tenant not connected to Microsoft Graph' };
		const graph = new GraphClient(env as unknown as ConstructorParameters<typeof GraphClient>[0], azureTenantId);
		const inv = await fetchDefenderInventory(graph);
		const result = assembleDefenderScan({
			controlProfiles: inv.controlProfiles,
			controlScores: inv.controlScores,
		});
		await env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL });
		return result;
	} catch (err) {
		console.error('[defender.scan] failed', err);
		return { error: err instanceof Error ? err.message : 'Defender scan failed' };
	}
}

async function resolveAzureTenantId(env: AppEnv['Bindings'], tenantId: string): Promise<string | null> {
	const row = await env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ? LIMIT 1')
		.bind(tenantId)
		.first<{ azure_tenant_id: string | null }>()
		.catch(() => null);
	return row?.azure_tenant_id ?? null;
}
