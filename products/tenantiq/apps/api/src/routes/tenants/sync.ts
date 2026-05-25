/**
 * Tenant sync routes: trigger sync, poll sync status.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { bustCache } from '../../middleware/cache';
import { forbidden, notFound } from '../../lib/errors';
import { verifyTenantAccess } from './helpers';
import { trackSyncJob } from '../../lib/sync-job-tracker';

export const syncRoutes = new Hono<AppEnv>();

// POST /api/tenants/:id/sync — Force immediate data sync via Graph API
syncRoutes.post('/:id/sync', async (c) => {
	const id = c.req.param('id');
	if (!verifyTenantAccess(c, id)) throw forbidden('You do not have access to this tenant');
	const db = c.env.DB;

	const tenant = await db
		.prepare('SELECT azure_tenant_id, organization_id FROM tenants WHERE id = ?')
		.bind(id)
		.first<{ azure_tenant_id: string; organization_id: string | null }>();
	if (!tenant?.azure_tenant_id) {
		throw notFound('Tenant');
	}

	// Accept any of: cached access token, delegated refresh token, admin-consent flag
	// (enables client_credentials fallback in graph-client), or per-tenant client credentials in KV.
	const [accessTok, refreshTok, consentFlag, perTenantSecret] = await Promise.all([
		c.env.KV.get(`graph:${tenant.azure_tenant_id}:access_token`),
		c.env.KV.get(`graph:${tenant.azure_tenant_id}:refresh_token`),
		c.env.KV.get(`consent:${id}`),
		c.env.KV.get(`graph:${tenant.azure_tenant_id}:client_secret`),
	]);
	const hasAnyAuth = accessTok || refreshTok || consentFlag === 'true' || perTenantSecret;
	if (!hasAnyAuth) {
		return c.json({ error: 'No Graph API token. Please sign out and sign in again to grant Microsoft 365 access.', graphTokenMissing: true }, 403);
	}

	try {
		const user = c.get('user');
		const orgId = tenant.organization_id ?? (user && 'orgId' in user ? (user as { orgId?: string }).orgId : undefined) ?? 'unknown';

		let workspaceCount = 0;
		let users = 0;
		let licenses = 0;
		const errors: string[] = [];

		await trackSyncJob(db, { type: 'manual-sync', tenantId: id, orgId }, async () => {
			const { syncTenantData } = await import('../../lib/graph-sync');
			const result = await syncTenantData(c.env as any, id, tenant.azure_tenant_id);
			users = result.users;
			licenses = result.licenses;
			errors.push(...result.errors);

			try {
				const { GraphClient } = await import('../../lib/graph-client');
				const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
				const { syncWorkspaces } = await import('../../lib/governance/workspace-sync');
				const wsResult = await syncWorkspaces((p) => graph.fetch(p), c.env.DB, id);
				workspaceCount = wsResult.count;
				if (wsResult.errors.length) errors.push(...wsResult.errors);
			} catch (wsErr) {
				errors.push(`Workspaces: ${wsErr instanceof Error ? wsErr.message : 'Failed'}`);
			}

			return { itemsProcessed: users + licenses + workspaceCount, itemsFailed: errors.length };
		});

		await c.env.KV.put(`synced:${id}`, 'true', { expirationTtl: 86400 * 365 });
		await bustCache(c.env.KV, 'dashboard', `/api/tenants/${id}/dashboard`, id);

		return c.json({
			queued: true,
			message: 'Sync completed',
			users,
			licenses,
			workspaces: workspaceCount,
			errors,
		});
	} catch (err) {
		console.error('Sync failed:', err);
		await c.env.KV.put(`sync:${id}`, JSON.stringify({
			phase: 'error', progress: 0,
			message: 'Sync failed',
			startedAt: Date.now(),
		}), { expirationTtl: 60 });
		return c.json({ error: 'Sync failed' }, 500);
	}
});

// GET /api/tenants/:id/sync/status — Poll sync progress
syncRoutes.get('/:id/sync/status', async (c) => {
	const id = c.req.param('id');
	if (!verifyTenantAccess(c, id)) throw forbidden('You do not have access to this tenant');
	const cached = await c.env.KV.get(`sync:${id}`, 'json') as {
		phase?: string; progress?: number; message?: string; startedAt?: number;
	} | null;

	if (!cached) {
		return c.json({ status: 'idle', progress: 0, message: 'No sync in progress' });
	}

	const status = cached.phase ?? 'syncing';
	const progress = cached.progress ?? 0;
	const message = cached.message ?? 'Syncing...';

	if (status === 'complete') {
		await c.env.KV.delete(`sync:${id}`);
		await c.env.KV.put(`synced:${id}`, 'true', { expirationTtl: 86400 * 365 });
	}

	return c.json({ status, progress, message });
});
