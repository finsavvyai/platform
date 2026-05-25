/**
 * LemonSqueezy payment provider implementation.
 * Handles checkout creation and webhook event processing.
 */

import type { PaymentProvider, CheckoutSession, WebhookEvent, Plan, LemonSqueezyConfig } from './types.js';
import { getPlanConfig, isValidPlan } from './plans.js';

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

export class LemonSqueezyProvider implements PaymentProvider {
  private config: LemonSqueezyConfig;
  private baseUrl = 'https://api.lemonsqueezy.com/v1';

  constructor(config: LemonSqueezyConfig) {
    this.config = config;
  }

  async createCheckout(planId: Plan, userId: string): Promise<CheckoutSession> {
    if (!isValidPlan(planId)) throw new PaymentError(`Invalid plan: ${planId}`);

    const plan = getPlanConfig(planId);
    if (planId === 'free') {
      return {
        checkoutUrl: '/dashboard',
        sessionId: `free_${userId}`,
      };
    }

    const body = {
      data: {
        attributes: {
          product_id: Number(this.config.productId),
          variant_id: Number(plan.variantId),
          custom_price: plan.price,
          expires_at: null,
          preview: false,
          redirect_url: `https://opensyber.cloud/dashboard?session={checkout_id}`,
          checkout_data: {
            custom: { userId },
          },
        },
      },
    };

    const response = await fetch(`${this.baseUrl}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new PaymentError('Failed to create checkout');
    }

    const data = (await response.json()) as {
      data: { id: string; attributes: { url: string } };
    };

    return {
      checkoutUrl: data.data.attributes.url,
      sessionId: data.data.id,
    };
  }

  async handleWebhook(signature: string, body: string): Promise<WebhookEvent> {
    const verified = await this.verifyWebhookSignature(signature, body);
    if (!verified) throw new PaymentError('Invalid webhook signature');

    const event = JSON.parse(body) as {
      meta: { event_name: string };
      data: {
        id: string;
        attributes: Record<string, unknown>;
      };
    };

    return {
      id: event.data.id,
      type: event.meta.event_name,
      data: event.data.attributes,
      createdAt: new Date(),
    };
  }

  getPlan(planId: Plan) {
    return getPlanConfig(planId);
  }

  private async verifyWebhookSignature(signature: string, body: string): Promise<boolean> {
    if (!signature || !this.config.webhookSecret) return false;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.config.webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
    const expected = Array.from(mac).map((b) => b.toString(16).padStart(2, '0')).join('');
    const provided = signature.trim().toLowerCase().replace(/^sha256=/, '');
    if (provided.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
    return diff === 0;
  }
}

export function createPaymentProvider(config: LemonSqueezyConfig): PaymentProvider {
  return new LemonSqueezyProvider(config);
}
