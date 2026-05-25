/**
 * Admin Tenant Credentials Routes
 *
 * Store per-tenant Azure app credentials in KV so the Graph client
 * can use client_credentials flow for daemon snapshot capture.
 *
 * POST /admin/tenants/:tenantId/credentials
 * DELETE /admin/tenants/:tenantId/credentials
 * GET  /admin/tenants/:tenantId/credentials/status
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../app/types';
import { authMiddleware } from '../../middleware/auth.middleware';
import { platformAdminMiddleware, logAdminAction } from '../../middleware/admin-auth';
import { getDb, schema } from '../../lib/db';
import { eq } from 'drizzle-orm';

const CredentialsSchema = z.object({
	clientId: z.string().min(1),
	clientSecret: z.string().min(1),
});

const adminCredentials = new Hono<AppEnv>();

adminCredentials.use('*', authMiddleware);
adminCredentials.use('*', platformAdminMiddleware);

// POST /admin/tenants/:tenantId/credentials
adminCredentials.post('/tenants/:tenantId/credentials', async (c) => {
		const { tenantId } = c.req.param();
		const body = await c.req.json().catch(() => null);
		const parsed = CredentialsSchema.safeParse(body);
		if (!parsed.success) return c.json({ error: 'clientId and clientSecret required' }, 400);
		const { clientId, clientSecret } = parsed.data;
		const db = getDb(c.env);

		const rows = await db.select().from(schema.organizations).where(eq(schema.organizations.id, tenantId));
		if (!rows[0]) return c.json({ error: 'Tenant not found' }, 404);

		const azureTenantId = rows[0].azureTenantId;
		if (!azureTenantId) return c.json({ error: 'Tenant has no azure_tenant_id set' }, 400);

		await Promise.all([
			c.env.KV.put(`graph:${azureTenantId}:client_id`, clientId),
			c.env.KV.put(`graph:${azureTenantId}:client_secret`, clientSecret),
			// Clear any cached token so next request re-authenticates with new creds
			c.env.KV.delete(`graph:${azureTenantId}:access_token`),
		]);

		await logAdminAction(c, {
			action: 'store_tenant_credentials',
			resourceType: 'tenant',
			resourceId: tenantId,
			details: { azureTenantId, clientId },
		});

		return c.json({ ok: true, azureTenantId });
	},
);

// DELETE /admin/tenants/:tenantId/credentials
adminCredentials.delete('/tenants/:tenantId/credentials', async (c) => {
	const { tenantId } = c.req.param();
	const db = getDb(c.env);

	const rows = await db.select().from(schema.organizations).where(eq(schema.organizations.id, tenantId));
	if (!rows[0]) return c.json({ error: 'Tenant not found' }, 404);

	const azureTenantId = rows[0].azureTenantId;
	if (!azureTenantId) return c.json({ error: 'Tenant has no azure_tenant_id set' }, 400);

	await Promise.all([
		c.env.KV.delete(`graph:${azureTenantId}:client_id`),
		c.env.KV.delete(`graph:${azureTenantId}:client_secret`),
		c.env.KV.delete(`graph:${azureTenantId}:access_token`),
	]);

	await logAdminAction(c, {
		action: 'delete_tenant_credentials',
		resourceType: 'tenant',
		resourceId: tenantId,
		details: { azureTenantId },
	});

	return c.json({ ok: true });
});

// GET /admin/tenants/:tenantId/credentials/status
adminCredentials.get('/tenants/:tenantId/credentials/status', async (c) => {
	const { tenantId } = c.req.param();
	const db = getDb(c.env);

	const rows = await db.select().from(schema.organizations).where(eq(schema.organizations.id, tenantId));
	if (!rows[0]) return c.json({ error: 'Tenant not found' }, 404);

	const azureTenantId = rows[0].azureTenantId;
	if (!azureTenantId) return c.json({ hasCredentials: false, reason: 'no_azure_tenant_id' });

	const [clientId, clientSecret, accessToken] = await Promise.all([
		c.env.KV.get(`graph:${azureTenantId}:client_id`),
		c.env.KV.get(`graph:${azureTenantId}:client_secret`),
		c.env.KV.get(`graph:${azureTenantId}:access_token`),
	]);

	return c.json({
		hasCredentials: !!(clientId && clientSecret),
		hasToken: !!accessToken,
		azureTenantId,
		clientId: clientId ?? null,
	});
});

export default adminCredentials;
