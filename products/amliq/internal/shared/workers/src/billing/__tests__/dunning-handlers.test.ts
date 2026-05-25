import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGetConfigHandler,
  createUpdateConfigHandler,
  createGetSubscriptionDunningHandler,
  createManualRetryHandler,
  createDashboardHandler,
  DunningRequest,
  DunningConfigStore,
} from '../dunning-handlers';
import { DunningStore, DunningScheduler, PaymentProvider, DunningActionHandler } from '../dunning-scheduler';
import { DunningConfig, DunningSchedule, DunningScheduleStatus } from '../dunning-models';

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const SUB_ID = '550e8400-e29b-41d4-a716-446655440001';
const SCHEDULE_ID = '550e8400-e29b-41d4-a716-446655440099';

const DEFAULT_CONFIG: DunningConfig = {
  retry_intervals_days: [1, 3, 5, 7],
  max_retries: 4,
  grace_period_days: 3,
  final_action: 'cancel',
};

const ACTIVE_SCHEDULE: DunningSchedule = {
  id: SCHEDULE_ID,
  subscription_id: SUB_ID,
  invoice_id: '550e8400-e29b-41d4-a716-446655440002',
  tenant_id: TENANT_ID,
  config: DEFAULT_CONFIG,
  attempts: [],
  current_status: DunningScheduleStatus.ACTIVE,
  next_retry_at: '2026-03-05T00:00:00Z',
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
};

function createMockConfigStore(existing?: DunningConfig): DunningConfigStore {
  let stored = existing ?? null;
  return {
    getConfig: vi.fn(async () => stored ? { ...stored } : null),
    saveConfig: vi.fn(async (_tid: string, config: DunningConfig) => { stored = config; }),
  };
}

function createMockDunningStore(schedule?: DunningSchedule): DunningStore {
  return {
    save: vi.fn(async () => {}),
    findById: vi.fn(async () => schedule ? { ...schedule } : null),
    findBySubscription: vi.fn(async () => schedule ? { ...schedule } : null),
    findDueRetries: vi.fn(async () => []),
    update: vi.fn(async () => {}),
  };
}

function adminRequest(overrides?: Partial<DunningRequest>): DunningRequest {
  return { tenantId: TENANT_ID, userRole: 'admin', ...overrides };
}

function viewerRequest(overrides?: Partial<DunningRequest>): DunningRequest {
  return { tenantId: TENANT_ID, userRole: 'viewer', ...overrides };
}

describe('GET /dunning/config', () => {
  it('returns existing config', async () => {
    const handler = createGetConfigHandler(createMockConfigStore(DEFAULT_CONFIG));
    const res = await handler(adminRequest());
    expect(res.status).toBe(200);
    expect((res.body as any).data).toEqual(DEFAULT_CONFIG);
  });

  it('returns 404 when no config exists', async () => {
    const handler = createGetConfigHandler(createMockConfigStore());
    const res = await handler(adminRequest());
    expect(res.status).toBe(404);
  });
});

describe('PUT /dunning/config', () => {
  it('creates new config as admin', async () => {
    const store = createMockConfigStore();
    const handler = createUpdateConfigHandler(store);
    const res = await handler(adminRequest({ body: DEFAULT_CONFIG }));
    expect(res.status).toBe(200);
    expect(store.saveConfig).toHaveBeenCalledOnce();
  });

  it('updates existing config with partial data', async () => {
    const store = createMockConfigStore(DEFAULT_CONFIG);
    const handler = createUpdateConfigHandler(store);
    const res = await handler(adminRequest({ body: { max_retries: 5 } }));
    expect(res.status).toBe(200);
    expect((res.body as any).data.max_retries).toBe(5);
    expect((res.body as any).data.grace_period_days).toBe(3);
  });

  it('rejects non-admin user', async () => {
    const handler = createUpdateConfigHandler(createMockConfigStore());
    const res = await handler(viewerRequest({ body: DEFAULT_CONFIG }));
    expect(res.status).toBe(403);
  });

  it('rejects invalid config data', async () => {
    const handler = createUpdateConfigHandler(createMockConfigStore());
    const res = await handler(adminRequest({ body: { retry_intervals_days: [] } }));
    expect(res.status).toBe(400);
  });
});

describe('GET /dunning/subscriptions/:id', () => {
  it('returns dunning schedule for subscription', async () => {
    const store = createMockDunningStore(ACTIVE_SCHEDULE);
    const handler = createGetSubscriptionDunningHandler(store);
    const res = await handler(adminRequest({ params: { id: SUB_ID } }));
    expect(res.status).toBe(200);
    expect((res.body as any).data.subscription_id).toBe(SUB_ID);
  });

  it('returns 404 when no schedule exists', async () => {
    const store = createMockDunningStore();
    const handler = createGetSubscriptionDunningHandler(store);
    const res = await handler(adminRequest({ params: { id: SUB_ID } }));
    expect(res.status).toBe(404);
  });

  it('returns 400 when subscription ID missing', async () => {
    const store = createMockDunningStore();
    const handler = createGetSubscriptionDunningHandler(store);
    const res = await handler(adminRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 403 for cross-tenant access', async () => {
    const otherTenantSchedule = { ...ACTIVE_SCHEDULE, tenant_id: '550e8400-e29b-41d4-a716-000000000000' };
    const store = createMockDunningStore(otherTenantSchedule);
    const handler = createGetSubscriptionDunningHandler(store);
    const res = await handler(adminRequest({ params: { id: SUB_ID } }));
    expect(res.status).toBe(403);
  });
});

describe('POST /dunning/subscriptions/:id/retry', () => {
  it('triggers manual retry as admin', async () => {
    const store = createMockDunningStore(ACTIVE_SCHEDULE);
    const provider: PaymentProvider = {
      retryPayment: vi.fn(async () => ({ success: true })),
    };
    const actionHandler: DunningActionHandler = { executeAction: vi.fn(async () => {}) };
    const scheduler = new DunningScheduler(store, provider, actionHandler);
    const handler = createManualRetryHandler(scheduler, store);
    const res = await handler(adminRequest({
      params: { id: SUB_ID },
      body: { reason: 'Customer updated card' },
    }));
    expect(res.status).toBe(200);
  });

  it('rejects non-admin user', async () => {
    const store = createMockDunningStore(ACTIVE_SCHEDULE);
    const provider: PaymentProvider = { retryPayment: vi.fn(async () => ({ success: true })) };
    const actionHandler: DunningActionHandler = { executeAction: vi.fn(async () => {}) };
    const scheduler = new DunningScheduler(store, provider, actionHandler);
    const handler = createManualRetryHandler(scheduler, store);
    const res = await handler(viewerRequest({
      params: { id: SUB_ID },
      body: { reason: 'test' },
    }));
    expect(res.status).toBe(403);
  });

  it('rejects invalid body', async () => {
    const store = createMockDunningStore(ACTIVE_SCHEDULE);
    const provider: PaymentProvider = { retryPayment: vi.fn(async () => ({ success: true })) };
    const actionHandler: DunningActionHandler = { executeAction: vi.fn(async () => {}) };
    const scheduler = new DunningScheduler(store, provider, actionHandler);
    const handler = createManualRetryHandler(scheduler, store);
    const res = await handler(adminRequest({
      params: { id: SUB_ID },
      body: { reason: '' },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when no schedule found', async () => {
    const store = createMockDunningStore();
    const provider: PaymentProvider = { retryPayment: vi.fn(async () => ({ success: true })) };
    const actionHandler: DunningActionHandler = { executeAction: vi.fn(async () => {}) };
    const scheduler = new DunningScheduler(store, provider, actionHandler);
    const handler = createManualRetryHandler(scheduler, store);
    const res = await handler(adminRequest({
      params: { id: SUB_ID },
      body: { reason: 'Customer updated card' },
    }));
    expect(res.status).toBe(404);
  });
});

describe('GET /dunning/dashboard', () => {
  it('returns dashboard metrics for admin', async () => {
    const handler = createDashboardHandler();
    const res = await handler(adminRequest({ query: { period: 'week' } }));
    expect(res.status).toBe(200);
    expect((res.body as any).data).toHaveProperty('total_active');
    expect((res.body as any).data).toHaveProperty('recovery_rate');
    expect((res.body as any).period).toBe('week');
  });

  it('rejects non-admin user', async () => {
    const handler = createDashboardHandler();
    const res = await handler(viewerRequest());
    expect(res.status).toBe(403);
  });

  it('defaults period to month', async () => {
    const handler = createDashboardHandler();
    const res = await handler(adminRequest());
    expect(res.status).toBe(200);
    expect((res.body as any).period).toBe('month');
  });
});
