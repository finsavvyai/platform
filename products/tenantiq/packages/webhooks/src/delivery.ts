/**
 * Webhook Delivery Service
 * Handles reliable delivery of webhook events with retry logic
 */

import type { WebhookEvent, WebhookConfig } from './types';
import { generateSignature, verifySignature } from './signing';
import { shouldDeliver } from './filters';
import { formatForPlatform, type WebhookPlatform } from './formatters';

export interface DeliveryResult {
	success: boolean;
	statusCode?: number;
	responseBody?: string;
	error?: string;
	attempts: number;
}

export class WebhookDeliveryService {
	private maxRetries = 5;
	private retryDelays = [60, 300, 900, 3600, 21600]; // 1m, 5m, 15m, 1h, 6h

	/**
	 * Deliver webhook event
	 */
	async deliver(
		config: WebhookConfig,
		event: WebhookEvent
	): Promise<DeliveryResult> {
		const signature = await generateSignature(config.webhookSecret, event);

		try {
			const response = await fetch(config.webhookUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-TenantIQ-Signature': signature,
					'X-TenantIQ-Event': event.event,
					'X-TenantIQ-Delivery-ID': event.deliveryId || crypto.randomUUID(),
					'User-Agent': 'TenantIQ-Webhooks/1.0'
				},
				body: JSON.stringify(event),
				signal: AbortSignal.timeout(30000)
			});

			const responseBody = await response.text().catch(() => '');

			if (response.ok) {
				return { success: true, statusCode: response.status, responseBody, attempts: 1 };
			}

			return {
				success: false,
				statusCode: response.status,
				responseBody,
				error: `HTTP ${response.status}: ${response.statusText}`,
				attempts: 1
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				attempts: 1
			};
		}
	}

	/**
	 * Deliver with retry logic
	 */
	async deliverWithRetry(
		config: WebhookConfig,
		event: WebhookEvent,
		attempt: number = 1
	): Promise<DeliveryResult> {
		const result = await this.deliver(config, event);

		if (result.success) {
			return result;
		}

		if (attempt >= this.maxRetries) {
			return {
				...result,
				attempts: attempt,
				error: `Failed after ${attempt} attempts: ${result.error}`
			};
		}

		const delaySeconds = this.retryDelays[attempt - 1];
		const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

		console.log(
			`Webhook delivery failed (attempt ${attempt}/${this.maxRetries}). ` +
			`Retrying in ${delaySeconds}s at ${nextRetryAt.toISOString()}`
		);

		return {
			...result,
			attempts: attempt,
			error: `Retry scheduled for ${nextRetryAt.toISOString()}`
		};
	}

	/** Verify webhook signature */
	async verifySignature(secret: string, event: WebhookEvent, signature: string): Promise<boolean> {
		return verifySignature(secret, event, signature);
	}

	/** Check if event should be filtered based on config */
	shouldDeliver(config: WebhookConfig, event: WebhookEvent): boolean {
		return shouldDeliver(config, event);
	}

	/** Format event for different platforms */
	formatForPlatform(event: WebhookEvent, platform: WebhookPlatform): WebhookEvent {
		return formatForPlatform(event, platform);
	}
}

export const webhookDelivery = new WebhookDeliveryService();
