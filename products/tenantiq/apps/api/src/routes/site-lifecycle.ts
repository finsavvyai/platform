/**
 * SharePoint Site Lifecycle Routes
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { GraphClient } from '../lib/graph-client';
import { getSelectedTenant } from '../lib/tenant-selector';
import { getSiteInventory, getExpiringSites, archiveSite } from '../lib/governance/site-lifecycle';

export const siteLifecycleRoutes = new Hono<AppEnv>();
siteLifecycleRoutes.use('*', authMiddleware);

// GET /api/governance/sites — Site inventory with activity
siteLifecycleRoutes.get('/', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ data: [], expiring: [] });

	const tenant = await c.env.DB.prepare(
		'SELECT azure_tenant_id FROM tenants WHERE id = ?',
	).bind(tenantId).first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) return c.json({ error: 'Tenant not found' }, 404);

	const token = await c.env.KV.get(`graph:${tenant.azure_tenant_id}:access_token`);
	if (!token) return c.json({ error: 'No Graph token', graphTokenMissing: true }, 403);

	const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
	const base = 'https://graph.microsoft.com/v1.0';
	const sites = await getSiteInventory((p, init) => graph.request(`${base}${p}`, init));
	const thresholdDays = Number(c.req.query('thresholdDays') ?? '90');
	const expiring = getExpiringSites(sites, thresholdDays);

	const status = c.req.query('status');
	let filtered = sites;
	if (status === 'expiring') filtered = expiring;
	else if (status === 'archived') filtered = sites.filter((s) => s.status === 'archived');

	return c.json({ data: filtered, expiring, total: sites.length });
});

// POST /api/governance/sites/:id/archive — Archive site
siteLifecycleRoutes.post('/:id/archive', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const tenant = await c.env.DB.prepare(
		'SELECT azure_tenant_id FROM tenants WHERE id = ?',
	).bind(tenantId).first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) return c.json({ error: 'Tenant not found' }, 404);

	const token = await c.env.KV.get(`graph:${tenant.azure_tenant_id}:access_token`);
	if (!token) return c.json({ error: 'No Graph token' }, 403);

	const siteId = c.req.param('id');
	const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
	const base = 'https://graph.microsoft.com/v1.0';
	const ok = await archiveSite((p, init) => graph.request(`${base}${p}`, init), siteId);

	return ok
		? c.json({ success: true, siteId, status: 'archived' })
		: c.json({ error: 'Archive failed' }, 500);
});

// POST /api/governance/sites/:id/renew — Extend site
siteLifecycleRoutes.post('/:id/renew', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const siteId = c.req.param('id');
	const now = new Date().toISOString();

	// Record renewal in KV
	await c.env.KV.put(
		`site-renewal-record:${siteId}`,
		JSON.stringify({ renewedAt: now, renewedBy: c.get('user').sub }),
		{ expirationTtl: 365 * 86_400 },
	);

	return c.json({ success: true, siteId, renewedAt: now });
});
