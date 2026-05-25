/**
 * PIM (Privileged Identity Management) audit endpoints.
 *
 *   GET /api/pim/scan      → full audit + findings (KV-cached 5min)
 *   GET /api/pim/summary   → just the rollup
 *   GET /api/pim/principals → list of role principals
 *
 * Required Graph permissions: RoleManagement.Read.Directory + Reports.Read.All.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { GraphClient } from '../lib/graph-client';
import { fetchPimInventory } from '../lib/pim/graph-fetch';
import { assemblePimScan, type PimScanResult } from '../lib/pim/scanner';

export const pimRoutes = new Hono<AppEnv>();
pimRoutes.use('*', authMiddleware);

const CACHE_TTL = 300;

pimRoutes.get('/scan', async (c) => {
	const result = await loadScan(c.env, c.get('tenantId'));
	return c.json(result);
});

pimRoutes.get('/summary', async (c) => {
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

pimRoutes.get('/principals', async (c) => {
	const result = await loadScan(c.env, c.get('tenantId'));
	if ('error' in result) return c.json(result, 503);
	return c.json({ principals: result.principals, scannedAt: result.scannedAt });
});

async function loadScan(env: AppEnv['Bindings'], tenantId: string | undefined): Promise<PimScanResult | { error: string }> {
	if (!tenantId) return { error: 'No tenant context' };
	const cacheKey = `pim:scan:${tenantId}`;
	const cached = await env.KV.get(cacheKey, 'json') as PimScanResult | null;
	if (cached) return cached;
	try {
		const azureTenantId = await resolveAzureTenantId(env, tenantId);
		if (!azureTenantId) return { error: 'Tenant not connected to Microsoft Graph' };
		const graph = new GraphClient(env as unknown as ConstructorParameters<typeof GraphClient>[0], azureTenantId);
		const inv = await fetchPimInventory(graph);
		const result = assemblePimScan({
			roleDefs: inv.roleDefs,
			standing: inv.standing,
			eligible: inv.eligible,
			active: inv.active,
			mfaLookup: (pid) => inv.mfaRegistered.has(pid) ? inv.mfaRegistered.get(pid)! : null,
		});
		await env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL });
		return result;
	} catch (err) {
		console.error('[pim.scan] failed', err);
		return { error: err instanceof Error ? err.message : 'PIM scan failed' };
	}
}

async function resolveAzureTenantId(env: AppEnv['Bindings'], tenantId: string): Promise<string | null> {
	const row = await env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ? LIMIT 1')
		.bind(tenantId)
		.first<{ azure_tenant_id: string | null }>()
		.catch(() => null);
	return row?.azure_tenant_id ?? null;
}
