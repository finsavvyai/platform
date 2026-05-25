/**
 * Dunning Webhook Handler
 * Processes incoming payment failure webhooks from Stripe and LemonSqueezy.
 * HMAC-SHA256 signature validation, idempotent processing.
 */

import { dunningWebhookSchema, DunningWebhookInput } from './dunning-validation';
import { DunningScheduler, DunningStore } from './dunning-scheduler';
import { maskEmail } from './dunning-templates';

// --- HMAC Signature Validation ---

export async function validateHmacSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  const computed = arrayBufferToHex(signatureBuffer);
  return timingSafeEqual(computed, signature);
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// --- Logger Interface ---

export interface WebhookLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

// --- Processed Event Tracker (idempotency) ---

export interface ProcessedEventStore {
  has(eventId: string): Promise<boolean>;
  add(eventId: string): Promise<void>;
}

// --- Webhook Handler Response ---

export interface WebhookResponse {
  status: number;
  body: unknown;
}

// --- Handler ---

export class DunningWebhookHandler {
  constructor(
    private readonly scheduler: DunningScheduler,
    private readonly store: DunningStore,
    private readonly processedEvents: ProcessedEventStore,
    private readonly webhookSecret: string,
    private readonly logger: WebhookLogger
  ) {}

  async handleWebhook(
    rawBody: string,
    signature: string
  ): Promise<WebhookResponse> {
    // Step 1: Validate HMAC signature
    const validSig = await validateHmacSignature(
      rawBody,
      signature,
      this.webhookSecret
    );
    if (!validSig) {
      this.logger.warn('Invalid webhook signature', {
        signature_prefix: signature.substring(0, 8) + '...',
      });
      return { status: 401, body: { error: 'Invalid signature' } };
    }

    // Step 2: Parse and validate payload
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { status: 400, body: { error: 'Invalid JSON' } };
    }

    const parsed = dunningWebhookSchema.safeParse(payload);
    if (!parsed.success) {
      this.logger.warn('Invalid webhook payload', {
        issues: parsed.error.issues.map((i) => i.message),
      });
      return { status: 400, body: { error: 'Invalid payload' } };
    }

    const event = parsed.data;

    // Step 3: Idempotency check
    const alreadyProcessed = await this.processedEvents.has(event.event_id);
    if (alreadyProcessed) {
      this.logger.info('Duplicate webhook ignored', {
        event_id: event.event_id,
      });
      return { status: 200, body: { status: 'already_processed' } };
    }

    // Step 4: Process asynchronously (return 200 immediately)
    this.logger.info('Processing payment failure webhook', {
      event_id: event.event_id,
      type: event.type,
      subscription_id: event.data.subscription_id,
    });

    // Step 5: Initiate dunning
    try {
      await this.initiateFromWebhook(event);
      await this.processedEvents.add(event.event_id);
    } catch (error) {
      this.logger.error('Failed to initiate dunning from webhook', {
        event_id: event.event_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return { status: 200, body: { status: 'accepted' } };
  }

  private async initiateFromWebhook(
    event: DunningWebhookInput
  ): Promise<void> {
    const existing = await this.store.findBySubscription(
      event.data.subscription_id
    );

    if (existing && existing.current_status === 'active') {
      this.logger.info('Dunning already active for subscription', {
        subscription_id: event.data.subscription_id,
        schedule_id: existing.id,
      });
      return;
    }

    await this.scheduler.initiateDunning(
      event.data.subscription_id,
      event.data.invoice_id,
      event.data.tenant_id
    );

    this.logger.info('Dunning initiated from webhook', {
      subscription_id: event.data.subscription_id,
      invoice_id: event.data.invoice_id,
    });
  }
}
