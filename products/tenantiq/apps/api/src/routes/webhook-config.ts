/**
 * Webhook Configuration API — configure Slack/Teams/custom webhook notifications.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { sendWebhookNotification } from '../lib/webhook-notify';
import { getSelectedTenant } from '../lib/tenant-selector';

export const webhookConfigRoutes = new Hono<AppEnv>();
webhookConfigRoutes.use('*', authMiddleware);

// GET /api/webhook-config — Get current webhook config
webhookConfigRoutes.get('/', async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ config: null });

	const config = await c.env.KV.get(`webhook:${tenantId}`, 'json');
	return c.json({ config: config || { url: '', enabled: false } });
});

// POST /api/webhook-config — Save webhook config
webhookConfigRoutes.post('/', async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const body = await c.req.json().catch(() => ({})) as { url?: string; enabled?: boolean };
	if (!body.url) return c.json({ error: 'URL required' }, 400);

	const { checkOutboundUrl } = await import('../lib/ssrf-guard');
	const guard = checkOutboundUrl(body.url, { requireHttps: true });
	if (!guard.ok) {
		return c.json({ error: guard.reason || 'Invalid URL' }, 400);
	}

	await c.env.KV.put(`webhook:${tenantId}`, JSON.stringify({
		url: body.url, enabled: body.enabled !== false,
	}));

	return c.json({ success: true });
});

// POST /api/webhook-config/test — Send a test notification
webhookConfigRoutes.post('/test', async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const result = await sendWebhookNotification(c.env.KV, tenantId, {
		type: 'alert',
		title: 'TenantIQ Test Notification',
		message: 'This is a test webhook from TenantIQ. If you see this, your webhook is configured correctly.',
		severity: 'low',
		url: 'https://app.tenantiq.app',
		timestamp: new Date().toISOString(),
	});

	return c.json(result);
});
