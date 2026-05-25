/**
 * Webhook Delivery Queue
 * Manages retry queue for failed webhook deliveries
 */

import type { WebhookDelivery, WebhookConfig, WebhookEvent } from './types';
import { webhookDelivery } from './delivery';

export class WebhookQueue {
	private retryIntervals = [60, 300, 900, 3600, 21600]; // 1m, 5m, 15m, 1h, 6h

	/**
	 * Queue webhook for delivery
	 */
	async queue(
		config: WebhookConfig,
		event: WebhookEvent,
		db: any // Database connection
	): Promise<string> {
		// Create delivery record
		const delivery: Partial<WebhookDelivery> = {
			webhookConfigId: config.id,
			eventType: event.event,
			payload: event,
			status: 'pending',
			attempts: 0,
			createdAt: new Date()
		};

		// Insert into database
		const result = await db.insert('webhook_deliveries').values(delivery).returning();
		const deliveryId = result[0].id;

		// Process immediately (in production, this would be async via queue)
		this.processDelivery(deliveryId, config, event, db).catch(error => {
			console.error('Failed to process webhook delivery:', error);
		});

		return deliveryId;
	}

	/**
	 * Process a webhook delivery
	 */
	private async processDelivery(
		deliveryId: string,
		config: WebhookConfig,
		event: WebhookEvent,
		db: any
	): Promise<void> {
		// Get current delivery record
		const delivery = await db.select('webhook_deliveries').where({ id: deliveryId }).first();

		if (!delivery) {
			console.error(`Delivery ${deliveryId} not found`);
			return;
		}

		// Check if should deliver based on filters
		if (!webhookDelivery.shouldDeliver(config, event)) {
			await db.update('webhook_deliveries')
				.where({ id: deliveryId })
				.set({
					status: 'delivered',
					deliveredAt: new Date(),
					responseBody: 'Filtered out - not delivered based on config'
				});
			return;
		}

		// Attempt delivery
		const result = await webhookDelivery.deliver(config, event);

		// Update delivery record
		await db.update('webhook_deliveries')
			.where({ id: deliveryId })
			.set({
				attempts: delivery.attempts + 1,
				lastAttemptAt: new Date(),
				status: result.success ? 'delivered' : 'failed',
				responseStatus: result.statusCode,
				responseBody: result.responseBody,
				errorMessage: result.error,
				deliveredAt: result.success ? new Date() : null
			});

		// If failed and retries remaining, schedule retry
		if (!result.success && delivery.attempts < this.retryIntervals.length) {
			const delaySeconds = this.retryIntervals[delivery.attempts];
			const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

			await db.update('webhook_deliveries')
				.where({ id: deliveryId })
				.set({
					status: 'retrying',
					nextRetryAt
				});

			console.log(`Webhook delivery scheduled for retry at ${nextRetryAt.toISOString()}`);
		}
	}

	/**
	 * Process pending retries
	 * This should be called periodically (e.g., every minute)
	 */
	async processRetries(db: any): Promise<void> {
		const now = new Date();

		// Get all deliveries ready for retry
		const pendingRetries = await db
			.select('webhook_deliveries')
			.where('status', 'retrying')
			.where('next_retry_at', '<=', now)
			.all();

		for (const delivery of pendingRetries) {
			// Get webhook config
			const config = await db
				.select('webhook_configs')
				.where({ id: delivery.webhookConfigId })
				.first();

			if (!config) {
				console.error(`Webhook config ${delivery.webhookConfigId} not found`);
				continue;
			}

			// Process retry
			await this.processDelivery(delivery.id, config, delivery.payload, db);
		}
	}

	/**
	 * Get delivery statistics
	 */
	async getStats(configId: string, db: any): Promise<{
		total: number;
		delivered: number;
		failed: number;
		pending: number;
		successRate: number;
	}> {
		const stats = await db
			.select('webhook_deliveries')
			.where({ webhookConfigId: configId })
			.select([
				db.raw('COUNT(*) as total'),
				db.raw('SUM(CASE WHEN status = "delivered" THEN 1 ELSE 0 END) as delivered'),
				db.raw('SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) as failed'),
				db.raw('SUM(CASE WHEN status IN ("pending", "retrying") THEN 1 ELSE 0 END) as pending')
			])
			.first();

		const successRate = stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0;

		return {
			...stats,
			successRate
		};
	}

	/**
	 * Clean up old deliveries
	 * Remove successfully delivered webhooks older than 30 days
	 */
	async cleanup(db: any, daysToKeep: number = 30): Promise<number> {
		const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

		const result = await db
			.delete('webhook_deliveries')
			.where('status', 'delivered')
			.where('delivered_at', '<', cutoffDate);

		return result.rowCount || 0;
	}
}

export const webhookQueue = new WebhookQueue();
