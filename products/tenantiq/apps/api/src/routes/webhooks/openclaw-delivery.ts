import type { WebhookDeliveryService } from '@tenantiq/webhooks';
import type { WebhookEvent } from '@tenantiq/webhooks';
import { getDb, schema } from '../../lib/db';
import { getNextRetryAt, toWebhookConfig } from './openclaw-helpers';

type DbClient = ReturnType<typeof getDb>;
type WebhookConfigRow = typeof schema.webhookConfigs.$inferSelect;

type DeliveryResult = {
	success: boolean;
	webhookId: string;
	statusCode?: number;
	attempts?: number;
	error?: string;
};

type SkipResult = {
	skipped: true;
	reason: string;
};

function createSkippedDeliveryRow(
	configId: string,
	deliveryId: string,
	eventType: WebhookEvent['event'],
	data: Record<string, unknown>,
	nowIso: string,
	reason: string
) {
	return {
		id: deliveryId,
		webhookConfigId: configId,
		eventType,
		payload: JSON.stringify(data),
		status: 'delivered',
		attempts: 1,
		lastAttemptAt: nowIso,
		responseBody: reason,
		createdAt: nowIso,
		deliveredAt: nowIso,
	} as const;
}

export async function deliverToConfig(
	db: DbClient,
	service: WebhookDeliveryService,
	config: WebhookConfigRow,
	tenantId: string,
	eventType: WebhookEvent['event'],
	data: Record<string, unknown>
): Promise<DeliveryResult | SkipResult> {
	const deliveryId = crypto.randomUUID();
	const nowIso = new Date().toISOString();

	try {
		const normalizedConfig = toWebhookConfig(config);
		const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };

		if (normalizedConfig.minSeverity && data.severity) {
			const minLevel = severityOrder[normalizedConfig.minSeverity as keyof typeof severityOrder];
			const dataLevel = severityOrder[String(data.severity) as keyof typeof severityOrder];
			if (dataLevel < minLevel) {
				await db.insert(schema.webhookDeliveries).values(
					createSkippedDeliveryRow(config.id, deliveryId, eventType, data, nowIso, 'Skipped: below minimum severity')
				);
				return { skipped: true, reason: 'Below minimum severity' };
			}
		}

		const categoryFilters = normalizedConfig.categories ?? [];
		if (categoryFilters.length > 0 && data.category && !categoryFilters.includes(String(data.category))) {
			await db.insert(schema.webhookDeliveries).values(
				createSkippedDeliveryRow(config.id, deliveryId, eventType, data, nowIso, 'Skipped: category not in filter')
			);
			return { skipped: true, reason: 'Category not in filter' };
		}

		if (normalizedConfig.quietHoursStart && normalizedConfig.quietHoursEnd) {
			const now = new Date();
			const currentTime = (now.getHours() * 60) + now.getMinutes();
			const [startHour, startMin] = normalizedConfig.quietHoursStart.split(':').map(Number);
			const [endHour, endMin] = normalizedConfig.quietHoursEnd.split(':').map(Number);
			const quietStart = (startHour * 60) + startMin;
			const quietEnd = (endHour * 60) + endMin;
			if (currentTime >= quietStart && currentTime < quietEnd) {
				await db.insert(schema.webhookDeliveries).values(
					createSkippedDeliveryRow(config.id, deliveryId, eventType, data, nowIso, 'Skipped: quiet hours active')
				);
				return { skipped: true, reason: 'Quiet hours active' };
			}
		}

		const webhookEvent: WebhookEvent = {
			event: eventType,
			deliveryId,
			tenant: { id: tenantId, name: 'TenantIQ Tenant' },
			data,
			timestamp: nowIso,
		};
		const result = await service.deliver(normalizedConfig, webhookEvent);
		const nextRetryAt = result.success ? null : getNextRetryAt(result.attempts);
		await db.insert(schema.webhookDeliveries).values({
			id: deliveryId,
			webhookConfigId: config.id,
			eventType,
			payload: JSON.stringify(webhookEvent),
			status: result.success ? 'delivered' : (nextRetryAt ? 'retrying' : 'failed'),
			attempts: result.attempts,
			lastAttemptAt: nowIso,
			nextRetryAt,
			responseStatus: result.statusCode || null,
			responseBody: result.responseBody || null,
			errorMessage: result.error || null,
			createdAt: nowIso,
			deliveredAt: result.success ? nowIso : null,
		});

		return {
			success: result.success,
			webhookId: config.id,
			statusCode: result.statusCode,
			attempts: result.attempts,
		};
	} catch (error) {
		const nextRetryAt = getNextRetryAt(1);
		await db.insert(schema.webhookDeliveries).values({
			id: deliveryId,
			webhookConfigId: config.id,
			eventType,
			payload: JSON.stringify(data),
			status: nextRetryAt ? 'retrying' : 'failed',
			attempts: 1,
			lastAttemptAt: nowIso,
			nextRetryAt,
			errorMessage: error instanceof Error ? error.message : 'Unknown error',
			createdAt: nowIso,
		});

		return {
			success: false,
			webhookId: config.id,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}
