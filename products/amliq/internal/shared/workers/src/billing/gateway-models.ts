/**
 * Payment Gateway Abstraction Layer
 * Unified interface for Stripe, PayPal, and Adyen with common types
 * for payments, refunds, webhooks, and a gateway registry.
 */

import { z } from 'zod';

// --- Zod Schemas ---

export const paymentIntentSchema = z.object({
  id: z.string().min(1, 'Payment intent ID required'),
  gateway: z.string().min(1),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/),
  customer_id: z.string().min(1),
  status: z.enum(['created', 'authorized', 'captured', 'failed', 'voided']),
  gateway_reference: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  created_at: z.string().datetime(),
});

export type PaymentIntent = z.infer<typeof paymentIntentSchema>;

export const paymentResultSchema = z.object({
  success: z.boolean(),
  intent_id: z.string().min(1),
  gateway: z.string().min(1),
  gateway_reference: z.string().optional(),
  status: z.enum(['authorized', 'captured', 'failed', 'voided', 'refunded']),
  error_code: z.string().optional(),
  error_message: z.string().optional(),
  raw_response: z.record(z.unknown()).optional(),
});

export type PaymentResult = z.infer<typeof paymentResultSchema>;

export const refundRequestSchema = z.object({
  payment_id: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/),
  reason: z.string().min(1).max(500),
  idempotency_key: z.string().min(1).optional(),
});

export type RefundRequest = z.infer<typeof refundRequestSchema>;

export const webhookEventSchema = z.object({
  id: z.string().min(1),
  gateway: z.string().min(1),
  event_type: z.string().min(1),
  payload: z.record(z.unknown()),
  received_at: z.string().datetime(),
  verified: z.boolean(),
});

export type WebhookEvent = z.infer<typeof webhookEventSchema>;

export const gatewayConfigSchema = z.object({
  provider: z.enum(['stripe', 'paypal', 'adyen']),
  api_key_env_var: z.string().min(1, 'API key env var name required'),
  environment: z.enum(['sandbox', 'production']),
  enabled: z.boolean().default(true),
  display_name: z.string().min(1),
  webhook_secret_env_var: z.string().min(1).optional(),
});

export type GatewayConfig = z.infer<typeof gatewayConfigSchema>;

// --- Error Types ---

export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly gateway: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export class PaymentDeclinedError extends GatewayError {
  constructor(gateway: string, reason: string, code?: string) {
    super(`Payment declined: ${reason}`, gateway, code);
    this.name = 'PaymentDeclinedError';
  }
}

export class WebhookVerificationError extends GatewayError {
  constructor(gateway: string, reason: string) {
    super(`Webhook verification failed: ${reason}`, gateway);
    this.name = 'WebhookVerificationError';
  }
}

// --- Payment Gateway Interface ---

export interface PaymentGateway {
  readonly name: string;
  authorize(intent: PaymentIntent): Promise<PaymentResult>;
  capture(intentId: string, amount?: number): Promise<PaymentResult>;
  refund(request: RefundRequest): Promise<PaymentResult>;
  void(intentId: string): Promise<PaymentResult>;
  verifyWebhook(headers: Record<string, string>, body: string): Promise<WebhookEvent>;
}

// --- Gateway Registry ---

export class GatewayRegistry {
  private gateways = new Map<string, PaymentGateway>();
  private defaultGateway: string | null = null;

  register(name: string, gateway: PaymentGateway, isDefault = false): void {
    this.gateways.set(name, gateway);
    if (isDefault || this.gateways.size === 1) {
      this.defaultGateway = name;
    }
  }

  get(name: string): PaymentGateway | undefined {
    return this.gateways.get(name);
  }

  getDefault(): PaymentGateway | undefined {
    return this.defaultGateway ? this.gateways.get(this.defaultGateway) : undefined;
  }

  list(): string[] {
    return Array.from(this.gateways.keys());
  }

  has(name: string): boolean {
    return this.gateways.has(name);
  }
}
