'use strict';

import crypto from 'crypto';
import { WebhookConfig, WebhookEvent, WebhookDelivery, WebhookDeliveryResponse } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * Webhook Delivery Service
 * Handles HTTP delivery of webhook events with retries and signatures
 */
export class WebhookDeliveryService {
  /**
   * Deliver a webhook event to a configured endpoint
   */
  async deliver(
    webhook: WebhookConfig,
    event: WebhookEvent,
    attempt: number = 1
  ): Promise<WebhookDelivery> {
    const deliveryId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      // Generate HMAC signature
      const signature = this.generateSignature(
        JSON.stringify(event),
        webhook.secret
      );

      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'X-Qestro-Signature': `sha256=${signature}`,
        'X-Qestro-Delivery-ID': deliveryId,
        'X-Qestro-Event-Type': event.type,
        'X-Qestro-Timestamp': event.timestamp.toISOString(),
        ...webhook.headers,
      };

      // Make HTTP request
      const response = await Promise.race([
        fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(event),
        }),
        this.timeoutPromise(webhook.timeout || 30000),
      ]);

      if (!(response instanceof Response)) {
        throw new Error('Invalid response object');
      }

      const responseBody = await response.text();
      const deliveryTime = Date.now() - startTime;

      // Determine delivery status
      const isSuccess = response.ok;
      const status = isSuccess ? 'success' : attempt >= webhook.maxRetries ? 'failed' : 'retrying';

      logger.info(
        `Webhook delivery [${deliveryId}] to ${webhook.url}: ${response.status} (${deliveryTime}ms)`
      );

      return {
        id: deliveryId,
        webhookId: webhook.id,
        eventId: event.id,
        attempt,
        status,
        statusCode: response.status,
        responseBody: responseBody.substring(0, 500),
        timestamp: new Date(),
        deliveryTime,
        signature,
      };
    } catch (error) {
      const deliveryTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      logger.error(
        `Webhook delivery [${deliveryId}] failed (attempt ${attempt}): ${errorMsg}`
      );

      return {
        id: deliveryId,
        webhookId: webhook.id,
        eventId: event.id,
        attempt,
        status: attempt >= webhook.maxRetries ? 'failed' : 'retrying',
        errorMessage: errorMsg,
        timestamp: new Date(),
        deliveryTime,
        signature: this.generateSignature(JSON.stringify(event), webhook.secret),
      };
    }
  }

  /**
   * Generate HMAC-SHA256 signature for payload verification
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verify webhook signature from incoming request
   */
  static verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    );
  }

  /**
   * Create timeout promise for fetch operations
   */
  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Webhook delivery timeout')), ms)
    );
  }
}
