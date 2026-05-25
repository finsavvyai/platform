import { WebhookEvent, WebhookSignatureError, PaymentError } from '../types.js';
import {
  verifyStripeSignature,
  verifyLemonSqueezySignature,
  getSignatureTimestamp,
  validateTimestamp,
} from './signature.js';

export interface WebhookHandlerConfig {
  provider: 'stripe' | 'lemonsqueezy';
  secret: string;
}

export class WebhookHandler {
  constructor(private config: WebhookHandlerConfig) {}

  async handle(signature: string, payload: string): Promise<WebhookEvent> {
    try {
      if (this.config.provider === 'stripe') {
        return this.handleStripeWebhook(signature, payload);
      } else {
        return this.handleLemonSqueezyWebhook(signature, payload);
      }
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        throw error;
      }
      throw new PaymentError('WEBHOOK_ERROR', this.config.provider, `Failed to handle webhook: ${error}`);
    }
  }

  private handleStripeWebhook(signature: string, payload: string): WebhookEvent {
    const timestamp = getSignatureTimestamp(signature);

    if (!validateTimestamp(timestamp)) {
      throw new WebhookSignatureError('Webhook timestamp outside of tolerance window');
    }

    if (!verifyStripeSignature(payload, signature, this.config.secret)) {
      throw new WebhookSignatureError('Stripe signature verification failed');
    }

    const event = JSON.parse(payload) as Record<string, unknown>;

    return this.parseStripeEvent(event);
  }

  private handleLemonSqueezyWebhook(signature: string, payload: string): WebhookEvent {
    if (!verifyLemonSqueezySignature(payload, signature, this.config.secret)) {
      throw new WebhookSignatureError('LemonSqueezy signature verification failed');
    }

    const event = JSON.parse(payload) as Record<string, unknown>;

    return this.parseLemonSqueezyEvent(event);
  }

  private parseStripeEvent(event: Record<string, unknown>): WebhookEvent {
    const type = event.type as string;
    const data = (event.data as Record<string, unknown>).object || {};

    const typeMap: Record<string, WebhookEvent['type']> = {
      'customer.subscription.created': 'subscription.created',
      'customer.subscription.updated': 'subscription.updated',
      'customer.subscription.deleted': 'subscription.cancelled',
      'charge.succeeded': 'payment.succeeded',
      'charge.failed': 'payment.failed',
    };

    return {
      type: typeMap[type] || 'payment.failed',
      data,
    };
  }

  private parseLemonSqueezyEvent(event: Record<string, unknown>): WebhookEvent {
    const type = event.meta?.event_name as string;
    const data = event.data || {};

    const typeMap: Record<string, WebhookEvent['type']> = {
      'subscription_created': 'subscription.created',
      'subscription_updated': 'subscription.updated',
      'subscription_cancelled': 'subscription.cancelled',
      'order_completed': 'payment.succeeded',
      'order_refunded': 'payment.failed',
    };

    return {
      type: typeMap[type] || 'payment.failed',
      data,
    };
  }
}
