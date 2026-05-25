import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { strictRateLimit } from '../middleware/rateLimit.middleware';
import { createGraphClient } from '../lib/graph-client';
import { getDb } from '../lib/db';
import { getTenantById } from '@tenantiq/db';
import { processNotification, ALLOWED_RESOURCES, type GraphNotification } from '../lib/webhook-processor';
import type { AppEnv } from '../app/types';

const webhooks = new Hono<AppEnv>();

/** POST /webhooks/graph — Receive Microsoft Graph change notifications */
webhooks.post('/graph', async (c) => {
	const validationToken = c.req.query('validationToken');
	if (validationToken) {
		// Sanitize: only allow alphanumeric, hyphens, and underscores
		const sanitized = validationToken.replace(/[^a-zA-Z0-9\-_]/g, '');
		return c.text(sanitized, 200, { 'Content-Type': 'text/plain' });
	}

	const body = await c.req.json<{ value: GraphNotification[] }>();
	if (!body.value || !Array.isArray(body.value)) {
		return c.json({ error: 'Invalid payload' }, 400);
	}
	// Validate clientState to ensure notifications are from our subscriptions
	for (const n of body.value) {
		if (!n.clientState?.startsWith('tenantiq-')) {
			continue; // Skip notifications without valid client state
		}
		try { await processNotification(c.env, n); } catch (err) { console.error('Notification error:', err); }
	}
	return c.json({ message: 'Notifications processed' }, 202);
});

/** GET /webhooks/subscriptions — List active Graph subscriptions */
webhooks.get('/subscriptions', authMiddleware, strictRateLimit, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const tenant = await getTenantById(db as any, tenantId);
		if (!tenant?.azureTenantId) return c.json({ error: 'Tenant not configured' }, 400);

		const graph = createGraphClient(c.env as any, tenant.azureTenantId);
		const data = await graph.fetch('/subscriptions');
		const subscriptions = (data.value || []).map((sub: any) => ({
			id: sub.id, resource: sub.resource, changeType: sub.changeType,
			expirationDateTime: sub.expirationDateTime, createdAt: sub.createdDateTime,
		}));

		return c.json({ subscriptions, total: subscriptions.length });
	} catch (error) {
		console.error('List subscriptions failed:', error);
		return c.json({ error: 'Failed to list subscriptions' }, 500);
	}
});

/** POST /webhooks/subscriptions — Create Graph webhook subscription */
webhooks.post('/subscriptions', authMiddleware, strictRateLimit, requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const { resource, changeType, expirationMinutes } = await c.req.json<{
			resource: string; changeType: string; expirationMinutes?: number;
		}>();

		if (!resource || !changeType) return c.json({ error: 'resource and changeType are required' }, 400);
		if (!ALLOWED_RESOURCES.includes(resource)) return c.json({ error: `Resource not allowed. Allowed: ${ALLOWED_RESOURCES.join(', ')}` }, 400);

		const tenant = await getTenantById(db as any, tenantId);
		if (!tenant?.azureTenantId) return c.json({ error: 'Tenant not configured' }, 400);

		const graph = createGraphClient(c.env as any, tenant.azureTenantId);
		const notificationUrl = `${c.env.FRONTEND_URL?.replace('app.', 'api.') || 'https://api.tenantiq.app'}/api/webhooks/graph`;
		const expiration = new Date(Date.now() + (expirationMinutes || 4230) * 60 * 1000);

		const subscription = await graph.request<any>('https://graph.microsoft.com/v1.0/subscriptions', {
			method: 'POST',
			body: JSON.stringify({ changeType, notificationUrl, resource, expirationDateTime: expiration.toISOString(), clientState: `tenantiq-${tenantId}` }),
		});

		return c.json({ subscription: { id: subscription.id, resource: subscription.resource, changeType: subscription.changeType, expirationDateTime: subscription.expirationDateTime }, message: 'Subscription created' });
	} catch (error) {
		console.error('Create subscription failed:', error);
		return c.json({ error: 'Failed to create subscription' }, 500);
	}
});

/** DELETE /webhooks/subscriptions/:subscriptionId — Remove subscription */
webhooks.delete('/subscriptions/:subscriptionId', authMiddleware, strictRateLimit, requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const subscriptionId = c.req.param('subscriptionId');
	if (!subscriptionId) return c.json({ error: 'Missing subscriptionId' }, 400);
	const db = getDb(c.env);

	try {
		// Validate subscriptionId format (UUID only) to prevent path traversal
		if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subscriptionId)) {
			return c.json({ error: 'Invalid subscription ID format' }, 400);
		}

		const tenant = await getTenantById(db as any, tenantId);
		if (!tenant?.azureTenantId) return c.json({ error: 'Tenant not configured' }, 400);

		const graph = createGraphClient(c.env as any, tenant.azureTenantId);
		await graph.request(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, { method: 'DELETE' });

		return c.json({ message: 'Subscription deleted', subscriptionId });
	} catch (error) {
		console.error('Delete subscription failed:', error);
		return c.json({ error: 'Failed to delete subscription' }, 500);
	}
});

export default webhooks;
