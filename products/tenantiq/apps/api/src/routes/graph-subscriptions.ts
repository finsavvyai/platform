/**
 * Graph API Change Notification Subscriptions — subscribe to security alerts,
 * risky sign-ins, and policy changes via Microsoft Graph.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { GraphClient } from '../lib/graph-client';
import { getSelectedTenant } from '../lib/tenant-selector';
import { notFound, validationError } from '../lib/errors';

export const graphSubscriptionRoutes = new Hono<AppEnv>();
graphSubscriptionRoutes.use('*', authMiddleware);

const RESOURCE_MAP: Record<string, string> = {
	securityAlerts: '/security/alerts',
	riskyUsers: '/identityProtection/riskyUsers',
	policyChanges: '/policies/conditionalAccessPolicies',
	directoryAudits: '/auditLogs/directoryAudits',
};

const subscribeSchema = z.object({
	resources: z.array(z.enum(['securityAlerts', 'riskyUsers', 'policyChanges', 'directoryAudits'])).min(1),
	expirationMinutes: z.number().min(60).max(4230).optional().default(4230),
});

async function resolveTenant(c: any) {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return { tenantId: null, azureId: null, err: 'No tenant' };
	const row = (await c.env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(tenantId).first()) as { azure_tenant_id: string } | null;
	if (!row?.azure_tenant_id) return { tenantId, azureId: null, err: 'Tenant not found' };
	return { tenantId, azureId: row.azure_tenant_id, err: null };
}

// POST /api/tenants/:tenantId/graph-subscriptions — create subscriptions
graphSubscriptionRoutes.post('/', async (c) => {
	const { tenantId, azureId, err } = await resolveTenant(c);
	if (err) return c.json({ error: err }, tenantId ? 404 : 400);

	const body = await c.req.json().catch(() => ({}));
	const parsed = subscribeSchema.safeParse(body);
	if (!parsed.success) throw validationError('Invalid input', { issues: parsed.error.issues });

	const { resources, expirationMinutes } = parsed.data;
	const graph = new GraphClient(c.env as any, azureId!);
	const clientState = crypto.randomUUID();
	const expiration = new Date(Date.now() + expirationMinutes * 60_000).toISOString();
	const webhookUrl = `${c.env.FRONTEND_URL?.replace(/\/$/, '') || 'https://api.tenantiq.app'}/api/graph/webhook`;

	const results: { resource: string; subscriptionId: string | null; error?: string }[] = [];

	for (const key of resources) {
		try {
			const data = await graph.request<{ id?: string }>('https://graph.microsoft.com/v1.0/subscriptions', {
				method: 'POST',
				body: JSON.stringify({
					changeType: 'created,updated',
					notificationUrl: webhookUrl,
					resource: RESOURCE_MAP[key],
					expirationDateTime: expiration,
					clientState,
				}),
			});
			const subId = data.id ?? null;

			if (subId) {
				await c.env.DB.prepare(
					`INSERT INTO graph_subscriptions (id, org_id, tenant_id, resource_key, graph_subscription_id, client_state, expires_at, created_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
				).bind(crypto.randomUUID(), c.get('user').orgId, tenantId, key, subId, clientState, expiration, new Date().toISOString()).run();
			}
			results.push({ resource: key, subscriptionId: subId });
		} catch (e) {
			results.push({ resource: key, subscriptionId: null, error: e instanceof Error ? e.message : 'Failed' });
		}
	}

	return c.json({ success: true, subscriptions: results });
});

// GET /api/tenants/:tenantId/graph-subscriptions — list active subscriptions
graphSubscriptionRoutes.get('/', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ subscriptions: [] });

	const rows = await c.env.DB.prepare(
		`SELECT id, resource_key, graph_subscription_id, expires_at, created_at
		 FROM graph_subscriptions WHERE tenant_id = ? AND org_id = ? ORDER BY created_at DESC`
	).bind(tenantId, c.get('user').orgId).all();

	return c.json({ subscriptions: rows.results ?? [] });
});

// DELETE /api/tenants/:tenantId/graph-subscriptions/:id — remove subscription
graphSubscriptionRoutes.delete('/:id', async (c) => {
	const tenantId = getSelectedTenant(c);
	const subId = c.req.param('id');
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const row = await c.env.DB.prepare(
		'SELECT graph_subscription_id, tenant_id FROM graph_subscriptions WHERE id = ? AND org_id = ?'
	).bind(subId, c.get('user').orgId).first<{ graph_subscription_id: string; tenant_id: string }>();

	if (!row) throw notFound('Subscription');

	// Try to delete from Graph API
	const tenant = await c.env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(row.tenant_id).first<{ azure_tenant_id: string }>();
	if (tenant?.azure_tenant_id) {
		const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
		await graph.request(`https://graph.microsoft.com/v1.0/subscriptions/${row.graph_subscription_id}`, { method: 'DELETE' }).catch(() => {});
	}

	await c.env.DB.prepare('DELETE FROM graph_subscriptions WHERE id = ?').bind(subId).run();
	return c.json({ success: true });
});
