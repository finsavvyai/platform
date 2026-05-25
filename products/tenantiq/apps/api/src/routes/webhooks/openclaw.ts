/**
 * OpenClaw Webhook Routes
 * Handles webhook delivery for OpenClaw integration
 */

import { Hono } from 'hono';
import { WebhookDeliveryService } from '@tenantiq/webhooks';
import type { WebhookEvent } from '@tenantiq/webhooks';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { AppEnv } from '../../app/types';
import { getDb, schema } from '../../lib/db';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { deliverToConfig } from './openclaw-delivery';
import { extractTenantId, requireServiceKey, toWebhookEvent } from './openclaw-helpers';
import { buildDeliveryStats } from './openclaw-stats';

const app = new Hono<AppEnv>();
const deliveryService = new WebhookDeliveryService();

app.use('/deliveries/:tenantId', authMiddleware, tenantMiddleware);
app.use('/stats/:tenantId', authMiddleware, tenantMiddleware);
// /deliver takes tenantId from the JSON body, not the path — gate with
// authMiddleware only and verify ownership from the body in the handler.
app.use('/deliver', authMiddleware);

app.post('/receive', async (c) => {
	const signature = c.req.header('x-tenantiq-signature');
	const eventType = c.req.header('x-tenantiq-event');
	if (!signature || !eventType) {
		return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing required headers' } }, 400);
	}

	// Parse + verify + persist share one response surface: any failure returns
	// the same 401 so attackers cannot distinguish parse-error vs sig-failure
	// vs unknown-tenant and enumerate subscriptions.
	const GENERIC_REJECT = { error: { code: 'UNAUTHORIZED', message: 'Invalid webhook signature' } };

	let payload: Record<string, unknown>;
	let tenantId: string | null;
	try {
		const body = await c.req.text();
		payload = JSON.parse(body) as Record<string, unknown>;
		tenantId = extractTenantId(payload);
	} catch (error) {
		console.error('[openclaw] webhook parse error', error);
		return c.json(GENERIC_REJECT, 401);
	}
	if (!tenantId) return c.json(GENERIC_REJECT, 401);

	// Replay window — payload.timestamp must be within ±5min of now.
	// Same generic 401 to avoid leaking which check failed.
	const ts = typeof payload.timestamp === 'string' || typeof payload.timestamp === 'number'
		? Date.parse(String(payload.timestamp))
		: NaN;
	if (Number.isNaN(ts) || Math.abs(Date.now() - ts) > 5 * 60_000) {
		return c.json(GENERIC_REJECT, 401);
	}

	const db = getDb(c.env);
	const configs = await db
		.select()
		.from(schema.webhookConfigs)
		.where(and(eq(schema.webhookConfigs.tenantId, tenantId), eq(schema.webhookConfigs.enabled, 1)));
	if (configs.length === 0) return c.json(GENERIC_REJECT, 401);

	const webhookEvent = toWebhookEvent(payload, eventType);
	const verifications = await Promise.all(
		configs.map((config) =>
			deliveryService.verifySignature(config.webhookSecret, webhookEvent, signature),
		),
	);
	if (!verifications.some(Boolean)) return c.json(GENERIC_REJECT, 401);

	console.log('Webhook received:', { event: eventType, tenantId, timestamp: payload.timestamp });
	return c.json({ received: true, event: eventType, timestamp: new Date().toISOString() });
});

app.post('/deliver', async (c) => {
	const serviceKeyError = requireServiceKey(c);
	if (serviceKeyError) {
		return serviceKeyError;
	}

	try {
		const body = await c.req.json() as Record<string, unknown>;
		const tenantId = typeof body.tenantId === 'string' ? body.tenantId : '';
		const event = typeof body.event === 'string' ? body.event : '';
		const data = typeof body.data === 'object' && body.data !== null
			? body.data as Record<string, unknown>
			: null;
		if (!tenantId || !event || !data) {
			return c.json({ error: 'Missing required fields' }, 400);
		}

		// Verify caller owns the tenant (defense-in-depth with tenantMiddleware).
		const user = c.get('user') as { tenantIds?: string[] } | undefined;
		if (user?.tenantIds && !user.tenantIds.includes(tenantId)) {
			return c.json({ error: 'Forbidden: no access to this tenant' }, 403);
		}

		const db = getDb(c.env);
		const configs = await db
			.select()
			.from(schema.webhookConfigs)
			.where(eq(schema.webhookConfigs.tenantId, tenantId));
		if (configs.length === 0) {
			return c.json({ delivered: 0, message: 'No webhook configurations found for tenant' });
		}

		const eventType = event as WebhookEvent['event'];
		const results = await Promise.all(
			configs
				.filter((config) => Boolean(config.enabled))
				.map((config) => deliverToConfig(db, deliveryService, config, tenantId, eventType, data))
		);

		return c.json({
			delivered: results.filter((result) => 'success' in result && result.success).length,
			skipped: results.filter((result) => 'skipped' in result).length,
			total: configs.length,
			results,
		});
	} catch (error) {
		console.error('Webhook delivery trigger error:', error);
		return c.json({
			error: 'Failed to trigger webhook delivery',
		}, 500);
	}
});

app.get('/deliveries/:tenantId', async (c) => {
	try {
		const tenantId = c.req.param('tenantId');
		const limit = parseInt(c.req.query('limit') || '50', 10);
		const db = getDb(c.env);

		const tenantConfigs = await db
			.select({ id: schema.webhookConfigs.id })
			.from(schema.webhookConfigs)
			.where(eq(schema.webhookConfigs.tenantId, tenantId));
		const configIds = tenantConfigs.map((config) => config.id);
		if (configIds.length === 0) {
			return c.json({ tenantId, count: 0, deliveries: [] });
		}

		const deliveries = await db
			.select()
			.from(schema.webhookDeliveries)
			.where(inArray(schema.webhookDeliveries.webhookConfigId, configIds))
			.limit(limit)
			.orderBy(desc(schema.webhookDeliveries.createdAt));

		return c.json({ tenantId, count: deliveries.length, deliveries });
	} catch (error) {
		console.error('Failed to fetch deliveries:', error);
		return c.json({ error: 'Failed to fetch deliveries' }, 500);
	}
});

app.get('/stats/:tenantId', async (c) => {
	try {
		const tenantId = c.req.param('tenantId');
		const db = getDb(c.env);

		const tenantConfigs = await db
			.select({ id: schema.webhookConfigs.id })
			.from(schema.webhookConfigs)
			.where(eq(schema.webhookConfigs.tenantId, tenantId));
		const configIds = tenantConfigs.map((config) => config.id);
		if (configIds.length === 0) {
			return c.json({ total: 0, successful: 0, failed: 0, pending: 0, averageAttempts: 0, last24h: 0 });
		}

		const allDeliveries = await db
			.select()
			.from(schema.webhookDeliveries)
			.where(inArray(schema.webhookDeliveries.webhookConfigId, configIds));

		return c.json(buildDeliveryStats(allDeliveries));
	} catch (error) {
		console.error('Failed to fetch stats:', error);
		return c.json({ error: 'Failed to fetch statistics' }, 500);
	}
});

export default app;
