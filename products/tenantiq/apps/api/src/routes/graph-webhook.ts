/**
 * Graph API Webhook Receiver — handles Microsoft Graph change notifications.
 *
 * Security model:
 * - `clientState` is a per-subscription shared secret (crypto.randomUUID — 128 bits).
 * - Every notification must carry the correct clientState or is rejected.
 * - Notifications without clientState are rejected at the parse layer.
 * - Rate limited to block flooding / subscription-ID probing.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app/types';
import { rateLimitMiddleware } from '../middleware/ratelimit';

export const graphWebhookRoutes = new Hono<AppEnv>();

// Rate limit webhook ingestion by source IP. Microsoft Graph usually batches
// under 100 notifications/minute/subscription; 300/min/IP is comfortably above.
graphWebhookRoutes.use('/webhook', rateLimitMiddleware({
	limit: 300,
	windowSeconds: 60,
	keyPrefix: 'graph-webhook',
}));

const notificationSchema = z.object({
	subscriptionId: z.string().uuid(),
	changeType: z.string().min(1).max(64),
	resource: z.string().min(1).max(512),
	clientState: z.string().uuid(),
	resourceData: z
		.object({
			id: z.string().optional(),
			'@odata.type': z.string().optional(),
		})
		.passthrough()
		.optional(),
	tenantId: z.string().optional(),
});

const payloadSchema = z.object({
	value: z.array(notificationSchema).max(100),
});

function mapResourceToAlertType(resource: string): string {
	if (resource.includes('security/alerts')) return 'security_alert';
	if (resource.includes('riskyUsers')) return 'risky_signin';
	if (resource.includes('conditionalAccessPolicies')) return 'policy_change';
	if (resource.includes('auditLogs')) return 'directory_audit';
	return 'graph_change';
}

function mapResourceToSeverity(resource: string): string {
	if (resource.includes('security/alerts')) return 'high';
	if (resource.includes('riskyUsers')) return 'high';
	if (resource.includes('conditionalAccessPolicies')) return 'medium';
	return 'low';
}

graphWebhookRoutes.post('/webhook', async (c) => {
	// Subscription validation handshake (plain-text echo).
	const validationToken = c.req.query('validationToken');
	if (validationToken) {
		return new Response(validationToken, {
			status: 200,
			headers: { 'Content-Type': 'text/plain' },
		});
	}

	let raw: unknown;
	try {
		raw = await c.req.json();
	} catch {
		return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } }, 400);
	}

	const parsed = payloadSchema.safeParse(raw);
	if (!parsed.success) {
		return c.json(
			{ error: { code: 'BAD_REQUEST', message: 'Invalid notification payload', details: parsed.error.errors } },
			400,
		);
	}

	const db = c.env.DB;
	const failures: string[] = [];

	for (const notification of parsed.data.value) {
		const sub = await db
			.prepare(
				'SELECT tenant_id, org_id FROM graph_subscriptions WHERE graph_subscription_id = ? AND client_state = ?',
			)
			.bind(notification.subscriptionId, notification.clientState)
			.first<{ tenant_id: string; org_id: string }>();

		// Silent drop (do not leak subscription existence): wrong clientState.
		if (!sub) continue;

		const alertType = mapResourceToAlertType(notification.resource);
		const severity = mapResourceToSeverity(notification.resource);
		const alertId = crypto.randomUUID();
		const now = new Date().toISOString();

		try {
			await db
				.prepare(
					`INSERT INTO security_alerts (id, org_id, tenant_id, type, severity, title, description, status, raw_data, created_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					alertId,
					sub.org_id,
					sub.tenant_id,
					alertType,
					severity,
					`Graph ${notification.changeType}: ${alertType.replace('_', ' ')}`,
					`Change detected on ${notification.resource} (${notification.changeType})`,
					'active',
					JSON.stringify(notification.resourceData ?? {}),
					now,
				)
				.run();
		} catch (err) {
			console.error('Alert insert failed:', err);
			failures.push(alertId);
			continue;
		}

		try {
			await c.env.NOTIFICATION_QUEUE.send({
				type: 'graph_alert',
				alertId,
				tenantId: sub.tenant_id,
				orgId: sub.org_id,
				severity,
				title: `Graph ${alertType.replace('_', ' ')}`,
				timestamp: now,
			});
		} catch (err) {
			console.error('Queue send failed:', err);
			failures.push(alertId);
		}
	}

	// 207 so Graph retries only if we failed to persist notifications.
	if (failures.length > 0) {
		return c.json({ received: true, failures: failures.length }, 207);
	}
	return c.json({ received: true });
});
