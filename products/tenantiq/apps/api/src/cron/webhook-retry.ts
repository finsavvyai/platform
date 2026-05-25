import { and, eq, lte } from 'drizzle-orm';
import { WebhookDeliveryService } from '@tenantiq/webhooks';
import type { WebhookConfig, WebhookEvent } from '@tenantiq/webhooks';
import type { Env } from '../index';
import { getDb, schema } from '../lib/db';

const RETRY_DELAYS_SECONDS = [60, 300, 900, 3600, 21600];
const RETRY_BATCH_LIMIT = 100;
const deliveryService = new WebhookDeliveryService();

function parseCategories(value: unknown): string[] {
	if (typeof value !== 'string' || value.trim().length === 0) return [];
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
	} catch {
		return [];
	}
}

function normalizeNotificationMode(value: string | null): WebhookConfig['notificationMode'] {
	if (value === 'digest' || value === 'digest_daily') return 'digest_daily';
	if (value === 'digest_hourly') return 'digest_hourly';
	return 'realtime';
}

function toWebhookConfig(config: typeof schema.webhookConfigs.$inferSelect): WebhookConfig {
	return {
		id: config.id,
		tenantId: config.tenantId,
		userId: config.userId || undefined,
		webhookUrl: config.webhookUrl,
		webhookSecret: config.webhookSecret,
		enabled: Boolean(config.enabled),
		notificationMode: normalizeNotificationMode(config.notificationMode),
		minSeverity: (config.minSeverity || undefined) as WebhookConfig['minSeverity'],
		categories: parseCategories(config.categories),
		quietHoursStart: config.quietHoursStart || undefined,
		quietHoursEnd: config.quietHoursEnd || undefined,
		quietHoursTimezone: config.quietHoursTimezone || undefined,
		createdAt: new Date(config.createdAt),
		updatedAt: new Date(config.updatedAt),
	};
}

function getNextRetryAt(attempts: number): string | null {
	const delaySeconds = RETRY_DELAYS_SECONDS[Math.max(0, attempts - 1)];
	if (!delaySeconds) return null;
	return new Date(Date.now() + (delaySeconds * 1000)).toISOString();
}

function parseWebhookEvent(payload: string): WebhookEvent | null {
	try {
		const parsed = JSON.parse(payload) as WebhookEvent;
		if (!parsed || typeof parsed !== 'object') return null;
		if (!parsed.event || !parsed.tenant || !parsed.data || !parsed.timestamp) return null;
		return parsed;
	} catch {
		return null;
	}
}

export async function runWebhookRetries(env: Env) {
	const db = getDb(env);
	const nowIso = new Date().toISOString();
	console.log('[WebhookRetry] Checking for due retries');

	const dueDeliveries = await db
		.select()
		.from(schema.webhookDeliveries)
		.where(and(eq(schema.webhookDeliveries.status, 'retrying'), lte(schema.webhookDeliveries.nextRetryAt, nowIso)))
		.limit(RETRY_BATCH_LIMIT);

	// No per-org assertOrgId needed — webhook retry processes delivery records, not tenant queries.
	// Delivery records are scoped to webhookConfigId; org isolation is enforced at the config level.
	for (const delivery of dueDeliveries) {
		const nextAttempts = (delivery.attempts || 0) + 1;
		const retryNowIso = new Date().toISOString();

		try {
			const config = await db
				.select()
				.from(schema.webhookConfigs)
				.where(and(eq(schema.webhookConfigs.id, delivery.webhookConfigId), eq(schema.webhookConfigs.enabled, 1)))
				.limit(1);

			if (config.length === 0) {
				await db
					.update(schema.webhookDeliveries)
					.set({
						status: 'failed',
						attempts: nextAttempts,
						lastAttemptAt: retryNowIso,
						nextRetryAt: null,
						errorMessage: 'Webhook configuration unavailable or disabled',
					})
					.where(eq(schema.webhookDeliveries.id, delivery.id));
				continue;
			}

			const event = parseWebhookEvent(delivery.payload);
			if (!event) {
				await db
					.update(schema.webhookDeliveries)
					.set({
						status: 'failed',
						attempts: nextAttempts,
						lastAttemptAt: retryNowIso,
						nextRetryAt: null,
						errorMessage: 'Invalid webhook payload',
					})
					.where(eq(schema.webhookDeliveries.id, delivery.id));
				continue;
			}

			const result = await deliveryService.deliver(toWebhookConfig(config[0]), event);
			const nextRetryAt = result.success ? null : getNextRetryAt(nextAttempts);

			await db
				.update(schema.webhookDeliveries)
				.set({
					status: result.success ? 'delivered' : (nextRetryAt ? 'retrying' : 'failed'),
					attempts: nextAttempts,
					lastAttemptAt: retryNowIso,
					nextRetryAt,
					responseStatus: result.statusCode || null,
					responseBody: result.responseBody || null,
					errorMessage: result.error || null,
					deliveredAt: result.success ? retryNowIso : null,
				})
				.where(eq(schema.webhookDeliveries.id, delivery.id));
		} catch (error) {
			const nextRetryAt = getNextRetryAt(nextAttempts);
			await db
				.update(schema.webhookDeliveries)
				.set({
					status: nextRetryAt ? 'retrying' : 'failed',
					attempts: nextAttempts,
					lastAttemptAt: retryNowIso,
					nextRetryAt,
					errorMessage: error instanceof Error ? error.message : 'Unknown retry failure',
				})
				.where(eq(schema.webhookDeliveries.id, delivery.id));
		}
	}

	console.log(`[WebhookRetry] Processed ${dueDeliveries.length} due delivery retries`);
}
