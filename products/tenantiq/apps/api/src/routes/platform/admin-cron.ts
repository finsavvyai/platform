/**
 * Admin Cron Trigger Routes
 *
 * Manual endpoints for triggering cron jobs without waiting for the schedule.
 * Useful for testing, incident response, and backfills.
 *
 * POST /cron/snapshot-all       — trigger snapshot for all active tenants
 * POST /cron/snapshot/:tenantId — trigger snapshot for a single tenant
 */

import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { authMiddleware } from '../../middleware/auth.middleware';
import { platformAdminMiddleware, logAdminAction } from '../../middleware/admin-auth';
import { captureSnapshot } from '../../lib/snapshots/capture';
import { createGraphClient } from '../../lib/graph-client';

interface TenantSnapshotResult {
	tenantId: string;
	tenantName: string;
	status: 'ok' | 'error' | 'skipped';
	driftsDetected: number;
	objectCount: number;
	error?: string;
}

type TenantRow = { id: string; name: string; azureTenantId: string | null };

const adminCron = new Hono<AppEnv>();

adminCron.use('*', authMiddleware);
adminCron.use('*', platformAdminMiddleware);

/** Build a graphFetch using GraphClient — supports refresh_token + client_credentials fallback. */
function buildGraphFetch(env: AppEnv['Bindings'], azureTenantId: string) {
	const client = createGraphClient(env as any, azureTenantId);
	return async (path: string): Promise<unknown> => {
		return client.fetch(path);
	};
}

/** Capture snapshot for one org row and return a result record. */
async function captureForTenant(
	env: AppEnv['Bindings'],
	tenant: { id: string; name: string; azureTenantId: string | null },
	triggeredBy: string,
): Promise<TenantSnapshotResult> {
	if (!tenant.azureTenantId) {
		return { tenantId: tenant.id, tenantName: tenant.name, status: 'skipped', driftsDetected: 0, objectCount: 0 };
	}

	try {
		const graphFetch = buildGraphFetch(env, tenant.azureTenantId as string);
		const manifest = await captureSnapshot(
			graphFetch,
			env.KV,
			env.DB,
			tenant.id,
			`admin:${triggeredBy}`,
			`Admin-triggered snapshot ${new Date().toISOString().slice(0, 10)}`,
		);

		// Count drift alerts created for this snapshot via the latest drift KV key
		const driftRaw = await env.KV.get(`drift:${tenant.id}:latest`, 'json') as { totalChanges?: number } | null;
		const driftsDetected = driftRaw?.totalChanges ?? 0;

		return {
			tenantId: tenant.id,
			tenantName: tenant.name,
			status: 'ok',
			driftsDetected,
			objectCount: manifest.objectCount,
		};
	} catch (err) {
		return {
			tenantId: tenant.id,
			tenantName: tenant.name,
			status: 'error',
			driftsDetected: 0,
			objectCount: 0,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

// POST /cron/snapshot-all — trigger snapshots for every active tenant
adminCron.post('/cron/snapshot-all', async (c) => {
	const user = c.get('user');
	const triggeredBy = user?.email ?? user?.sub ?? 'unknown';

	const result = await c.env.DB.prepare(
		"SELECT id, display_name, azure_tenant_id FROM tenants WHERE status = 'active'"
	).all<{ id: string; display_name: string; azure_tenant_id: string }>();

	const tenants: TenantRow[] = result.results.map((t) => ({ id: t.id, name: t.display_name, azureTenantId: t.azure_tenant_id }));

	const results: TenantSnapshotResult[] = await Promise.all(
		tenants.map((t) => captureForTenant(c.env, t, triggeredBy)),
	);

	const triggered = results.filter((r) => r.status === 'ok').length;
	const failed = results.filter((r) => r.status === 'error').length;

	await logAdminAction(c, {
		action: 'manual_cron_snapshot_all',
		resourceType: 'snapshot',
		details: { triggered, failed, total: tenants.length },
	});

	return c.json({ triggered, failed, total: tenants.length, results });
});

// POST /cron/snapshot/:tenantId — trigger snapshot for a single tenant
adminCron.post('/cron/snapshot/:tenantId', async (c) => {
	const tenantId = c.req.param('tenantId');
	const user = c.get('user');
	const triggeredBy = user?.email ?? user?.sub ?? 'unknown';

	const res = await c.env.DB.prepare(
		'SELECT id, display_name, azure_tenant_id FROM tenants WHERE id = ?'
	).bind(tenantId).all<{ id: string; display_name: string; azure_tenant_id: string }>();

	const row = res.results[0];
	if (!row) return c.json({ error: 'Tenant not found' }, 404);

	const tenant: TenantRow = { id: row.id, name: row.display_name, azureTenantId: row.azure_tenant_id };
	const result = await captureForTenant(c.env, tenant, triggeredBy);

	await logAdminAction(c, {
		action: 'manual_cron_snapshot_tenant',
		resourceType: 'snapshot',
		resourceId: tenantId,
		details: { status: result.status, objectCount: result.objectCount, driftsDetected: result.driftsDetected },
	});

	return c.json({ triggered: result.status === 'ok' ? 1 : 0, results: [result] });
});

export default adminCron;
