import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DunningWebhookHandler,
  validateHmacSignature,
  WebhookLogger,
  ProcessedEventStore,
} from '../dunning-webhook';
import { DunningScheduler, DunningStore, PaymentProvider, DunningActionHandler } from '../dunning-scheduler';
import { DunningScheduleStatus } from '../dunning-models';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const WEBHOOK_SECRET = 'test-webhook-secret-minimum-20-chars';

const VALID_PAYLOAD = {
  type: 'invoice.payment_failed' as const,
  data: {
    subscription_id: VALID_UUID,
    invoice_id: '550e8400-e29b-41d4-a716-446655440001',
    tenant_id: '550e8400-e29b-41d4-a716-446655440002',
    amount: 49.99,
    currency: 'USD',
  },
  event_id: 'evt_test_123',
  timestamp: '2026-03-01T00:00:00Z',
};

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function createMockLogger(): WebhookLogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };
}

function createMockProcessedEvents(): ProcessedEventStore {
  const events = new Set<string>();
  return {
    has: vi.fn(async (id: string) => events.has(id)),
    add: vi.fn(async (id: string) => { events.add(id); }),
  };
}

function createMockDunningStore(): DunningStore {
  return {
    save: vi.fn(async () => {}),
    findById: vi.fn(async () => null),
    findBySubscription: vi.fn(async () => null),
    findDueRetries: vi.fn(async () => []),
    update: vi.fn(async () => {}),
  };
}

describe('validateHmacSignature', () => {
  it('validates correct HMAC signature', async () => {
    const payload = '{"test":"data"}';
    const sig = await signPayload(payload, WEBHOOK_SECRET);
    const valid = await validateHmacSignature(payload, sig, WEBHOOK_SECRET);
    expect(valid).toBe(true);
  });

  it('rejects incorrect HMAC signature', async () => {
    const payload = '{"test":"data"}';
    const valid = await validateHmacSignature(payload, 'invalid', WEBHOOK_SECRET);
    expect(valid).toBe(false);
  });

  it('rejects tampered payload', async () => {
    const original = '{"test":"data"}';
    const sig = await signPayload(original, WEBHOOK_SECRET);
    const valid = await validateHmacSignature('{"test":"tampered"}', sig, WEBHOOK_SECRET);
    expect(valid).toBe(false);
  });

  it('rejects wrong secret', async () => {
    const payload = '{"test":"data"}';
    const sig = await signPayload(payload, 'other-secret-that-is-long');
    const valid = await validateHmacSignature(payload, sig, WEBHOOK_SECRET);
    expect(valid).toBe(false);
  });
});

describe('DunningWebhookHandler', () => {
  let handler: DunningWebhookHandler;
  let store: DunningStore;
  let logger: WebhookLogger;
  let processedEvents: ProcessedEventStore;
  let scheduler: DunningScheduler;

  beforeEach(() => {
    store = createMockDunningStore();
    logger = createMockLogger();
    processedEvents = createMockProcessedEvents();
    const provider: PaymentProvider = {
      retryPayment: vi.fn(async () => ({ success: false, error: 'declined' })),
    };
    const actionHandler: DunningActionHandler = {
      executeAction: vi.fn(async () => {}),
    };
    scheduler = new DunningScheduler(store, provider, actionHandler);
    handler = new DunningWebhookHandler(
      scheduler, store, processedEvents, WEBHOOK_SECRET, logger
    );
  });

  it('processes valid Stripe payment_failed webhook', async () => {
    const body = JSON.stringify(VALID_PAYLOAD);
    const sig = await signPayload(body, WEBHOOK_SECRET);
    const res = await handler.handleWebhook(body, sig);
    expect(res.status).toBe(200);
    expect((res.body as any).status).toBe('accepted');
    expect(store.save).toHaveBeenCalledOnce();
  });

  it('processes valid LemonSqueezy webhook', async () => {
    const lsPayload = { ...VALID_PAYLOAD, type: 'subscription_payment_failed' };
    const body = JSON.stringify(lsPayload);
    const sig = await signPayload(body, WEBHOOK_SECRET);
    const res = await handler.handleWebhook(body, sig);
    expect(res.status).toBe(200);
    expect((res.body as any).status).toBe('accepted');
  });

  it('rejects invalid HMAC signature', async () => {
    const body = JSON.stringify(VALID_PAYLOAD);
    const res = await handler.handleWebhook(body, 'invalid-signature');
    expect(res.status).toBe(401);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('rejects invalid JSON body', async () => {
    const body = 'not-json{';
    const sig = await signPayload(body, WEBHOOK_SECRET);
    const res = await handler.handleWebhook(body, sig);
    expect(res.status).toBe(400);
    expect((res.body as any).error).toBe('Invalid JSON');
  });

  it('rejects invalid webhook payload', async () => {
    const body = JSON.stringify({ type: 'unsupported.event' });
    const sig = await signPayload(body, WEBHOOK_SECRET);
    const res = await handler.handleWebhook(body, sig);
    expect(res.status).toBe(400);
    expect((res.body as any).error).toBe('Invalid payload');
  });

  it('handles duplicate webhook idempotently', async () => {
    const body = JSON.stringify(VALID_PAYLOAD);
    const sig = await signPayload(body, WEBHOOK_SECRET);

    // First call
    const res1 = await handler.handleWebhook(body, sig);
    expect(res1.status).toBe(200);
    expect((res1.body as any).status).toBe('accepted');

    // Second call with same event_id
    const res2 = await handler.handleWebhook(body, sig);
    expect(res2.status).toBe(200);
    expect((res2.body as any).status).toBe('already_processed');

    // Store should only have been called once for save
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it('does not create duplicate dunning for active subscription', async () => {
    // Simulate existing active dunning
    (store.findBySubscription as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null).mockResolvedValue({
      id: 'existing-schedule',
      subscription_id: VALID_PAYLOAD.data.subscription_id,
      current_status: DunningScheduleStatus.ACTIVE,
    });

    const body = JSON.stringify(VALID_PAYLOAD);
    const sig = await signPayload(body, WEBHOOK_SECRET);
    await handler.handleWebhook(body, sig);

    // Second call with different event_id should not create new
    const payload2 = { ...VALID_PAYLOAD, event_id: 'evt_test_456' };
    const body2 = JSON.stringify(payload2);
    const sig2 = await signPayload(body2, WEBHOOK_SECRET);
    await handler.handleWebhook(body2, sig2);

    expect(logger.info).toHaveBeenCalledWith(
      'Dunning already active for subscription',
      expect.any(Object)
    );
  });

  it('logs errors without crashing on dunning initiation failure', async () => {
    (store.save as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB error'));
    const body = JSON.stringify(VALID_PAYLOAD);
    const sig = await signPayload(body, WEBHOOK_SECRET);
    const res = await handler.handleWebhook(body, sig);
    expect(res.status).toBe(200);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to initiate dunning from webhook',
      expect.objectContaining({ error: 'DB error' })
    );
  });
});
