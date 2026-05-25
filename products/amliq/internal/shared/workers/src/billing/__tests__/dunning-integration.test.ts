import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DunningWebhookHandler,
  WebhookLogger,
  ProcessedEventStore,
} from '../dunning-webhook';
import {
  DunningScheduler,
  DunningStore,
  PaymentProvider,
  DunningActionHandler,
} from '../dunning-scheduler';
import { DunningScheduleStatus } from '../dunning-models';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const INVOICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const TENANT_UUID = '550e8400-e29b-41d4-a716-446655440002';
const WEBHOOK_SECRET = 'test-webhook-secret-minimum-20-chars';

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
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function createMockLogger(): WebhookLogger {
  return { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
}

function createMockProcessedEvents(): ProcessedEventStore {
  const events = new Set<string>();
  return {
    has: vi.fn(async (id: string) => events.has(id)),
    add: vi.fn(async (id: string) => { events.add(id); }),
  };
}

function createInMemoryDunningStore(): DunningStore {
  const schedules = new Map<string, Record<string, unknown>>();
  return {
    save: vi.fn(async (schedule: Record<string, unknown>) => {
      schedules.set(schedule.id as string, schedule);
    }),
    findById: vi.fn(async (id: string) => schedules.get(id) ?? null),
    findBySubscription: vi.fn(async (subId: string) => {
      for (const s of schedules.values()) {
        if (s.subscription_id === subId) return s;
      }
      return null;
    }),
    findDueRetries: vi.fn(async () => []),
    update: vi.fn(async (schedule: Record<string, unknown>) => {
      schedules.set(schedule.id as string, schedule);
    }),
  };
}

describe('Dunning Integration: Webhook -> Scheduler -> Retry', () => {
  let handler: DunningWebhookHandler;
  let store: DunningStore;
  let provider: PaymentProvider;
  let scheduler: DunningScheduler;
  let logger: WebhookLogger;

  beforeEach(() => {
    store = createInMemoryDunningStore();
    logger = createMockLogger();
    provider = {
      retryPayment: vi.fn(async () => ({ success: false, error: 'declined' })),
    };
    const actionHandler: DunningActionHandler = {
      executeAction: vi.fn(async () => {}),
    };
    scheduler = new DunningScheduler(store, provider, actionHandler);
    const processedEvents = createMockProcessedEvents();
    handler = new DunningWebhookHandler(
      scheduler, store, processedEvents, WEBHOOK_SECRET, logger
    );
  });

  it('webhook creates dunning schedule then retry executes', async () => {
    const payload = {
      type: 'invoice.payment_failed' as const,
      data: {
        subscription_id: VALID_UUID,
        invoice_id: INVOICE_UUID,
        tenant_id: TENANT_UUID,
        amount: 49.99,
        currency: 'USD',
      },
      event_id: 'evt_int_001',
      timestamp: '2026-03-01T00:00:00Z',
    };

    const body = JSON.stringify(payload);
    const sig = await signPayload(body, WEBHOOK_SECRET);
    const res = await handler.handleWebhook(body, sig);

    expect(res.status).toBe(200);
    expect((res.body as Record<string, unknown>).status).toBe('accepted');
    expect(store.save).toHaveBeenCalledOnce();

    // Retrieve the created schedule
    const saved = await store.findBySubscription(VALID_UUID);
    expect(saved).not.toBeNull();
    expect(saved!.current_status).toBe(DunningScheduleStatus.ACTIVE);

    // Execute retry -- payment fails, schedule stays active
    const attempt = await scheduler.executeRetry(saved!.id as string);
    expect(attempt.status).toBe('failed');
    expect(attempt.error_message).toBe('declined');
  });

  it('successful retry resolves dunning schedule', async () => {
    // Create schedule directly
    const schedule = await scheduler.initiateDunning(
      VALID_UUID, INVOICE_UUID, TENANT_UUID
    );
    expect(schedule.current_status).toBe(DunningScheduleStatus.ACTIVE);

    // Mock payment success for retry
    (provider.retryPayment as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ success: true });

    const attempt = await scheduler.executeRetry(schedule.id);
    expect(attempt.status).toBe('succeeded');

    const updated = await store.findById(schedule.id);
    expect(updated).not.toBeNull();
    expect(updated!.current_status).toBe(DunningScheduleStatus.SUCCEEDED);
  });

  it('duplicate webhook does not create second schedule', async () => {
    const payload = {
      type: 'invoice.payment_failed' as const,
      data: {
        subscription_id: VALID_UUID,
        invoice_id: INVOICE_UUID,
        tenant_id: TENANT_UUID,
        amount: 99.99,
        currency: 'USD',
      },
      event_id: 'evt_int_dup_001',
      timestamp: '2026-03-01T12:00:00Z',
    };

    const body = JSON.stringify(payload);
    const sig = await signPayload(body, WEBHOOK_SECRET);

    // First webhook
    await handler.handleWebhook(body, sig);
    expect(store.save).toHaveBeenCalledTimes(1);

    // Second webhook with same event_id
    await handler.handleWebhook(body, sig);
    // save should NOT be called again due to idempotency
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it('invalid signature rejects webhook before dunning', async () => {
    const body = JSON.stringify({ type: 'invoice.payment_failed', data: {} });
    const res = await handler.handleWebhook(body, 'bad-signature');

    expect(res.status).toBe(401);
    expect(store.save).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
