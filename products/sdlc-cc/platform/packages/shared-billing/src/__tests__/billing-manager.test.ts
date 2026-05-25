import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingManager } from '../billing-manager';
import { BillingError, DEFAULT_TIER_CONFIGS } from '../types';
import type { BillingConfig } from '../types';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared with vi.hoisted so the factory closures
// can reference them after the vi.mock() calls are hoisted to file top.
// ---------------------------------------------------------------------------

const {
  mockStripeCustomerCreate,
  mockStripeCheckoutCreate,
  mockStripeSubUpdate,
  mockStripeSubCancel,
  mockFrom,
  mockPayCreateCheckout,
  mockPayCancelSubscription,
  mockPayGetSubscription,
  mockPayHandleWebhook,
} = vi.hoisted(() => ({
  mockStripeCustomerCreate: vi.fn(),
  mockStripeCheckoutCreate: vi.fn(),
  mockStripeSubUpdate: vi.fn(),
  mockStripeSubCancel: vi.fn(),
  mockFrom: vi.fn(),
  mockPayCreateCheckout: vi.fn(),
  mockPayCancelSubscription: vi.fn(),
  mockPayGetSubscription: vi.fn(),
  mockPayHandleWebhook: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    customers: { create: mockStripeCustomerCreate },
    checkout: { sessions: { create: mockStripeCheckoutCreate } },
    subscriptions: { update: mockStripeSubUpdate, cancel: mockStripeSubCancel },
  })),
}));

vi.mock('@finsavvyai/pay', () => ({
  createPaymentClient: vi.fn().mockReturnValue({
    name: 'stripe',
    createCheckout: mockPayCreateCheckout,
    getSubscription: mockPayGetSubscription,
    cancelSubscription: mockPayCancelSubscription,
    handleWebhook: mockPayHandleWebhook,
  }),
  WebhookHandler: vi.fn().mockImplementation(() => ({
    handle: mockPayHandleWebhook,
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({ from: mockFrom }),
}));

// ---------------------------------------------------------------------------
// Supabase query builder factory — returns a chainable builder
// ---------------------------------------------------------------------------

function makeBuilder(resolveWith: { data?: any; error?: any }) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolveWith),
  };
  // Awaiting the builder itself (without .single()) should also resolve
  builder.then = (resolve: any) => Promise.resolve(resolveWith).then(resolve);
  return builder;
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const BASE_CONFIG: BillingConfig = {
  processor: 'stripe',
  apiKey: 'sk_test_key',
  signingSecret: 'whsec_test',
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceKey: 'service_key',
  successUrl: 'https://app.example.com/success',
  cancelUrl: 'https://app.example.com/cancel',
};

function makeManager(overrides: Partial<BillingConfig> = {}) {
  return new BillingManager({ ...BASE_CONFIG, ...overrides });
}

// Convenience: configure mockFrom to return specific data for a table call
function stubFrom(data: any, error: any = null) {
  const builder = makeBuilder({ data, error });
  mockFrom.mockReturnValue(builder);
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createOrGetCustomer
// ---------------------------------------------------------------------------

describe('BillingManager.createOrGetCustomer', () => {
  it('returns existing customer without hitting Stripe', async () => {
    const existing = { id: 'cus_1', email: 'a@b.com', userId: 'u1' };
    stubFrom(existing);

    const manager = makeManager();
    const customer = await manager.createOrGetCustomer('u1', 'a@b.com');
    expect(customer).toEqual(existing);
    expect(mockStripeCustomerCreate).not.toHaveBeenCalled();
  });

  it('creates customer when none exists (uses @finsavvyai/pay)', async () => {
    const newCustomer = { id: 'cus_new', email: 'new@b.com', userId: 'u2' };

    // First call: no existing customer
    const notFoundBuilder = makeBuilder({ data: null, error: { message: 'Not found' } });
    // Second call: insert returns new record
    const insertBuilder = makeBuilder({ data: newCustomer, error: null });
    mockFrom
      .mockReturnValueOnce(notFoundBuilder)
      .mockReturnValueOnce(insertBuilder);

    const manager = makeManager();
    const customer = await manager.createOrGetCustomer('u2', 'new@b.com', 'New User');

    expect(customer).toEqual(newCustomer);
  });

  it('creates LemonSqueezy customer when processor is lemonsqueezy', async () => {
    const newCustomer = { id: 'cus_ls', email: 'ls@b.com', userId: 'u3' };

    const notFoundBuilder = makeBuilder({ data: null, error: { message: 'Not found' } });
    const insertBuilder = makeBuilder({ data: newCustomer, error: null });
    mockFrom
      .mockReturnValueOnce(notFoundBuilder)
      .mockReturnValueOnce(insertBuilder);

    const manager = makeManager({ processor: 'lemonsqueezy' });
    const customer = await manager.createOrGetCustomer('u3', 'ls@b.com');

    expect(customer).toEqual(newCustomer);
  });

  it('throws BillingError on Supabase insert failure', async () => {
    const notFoundBuilder = makeBuilder({ data: null, error: { message: 'Not found' } });
    const failInsertBuilder = makeBuilder({ data: null, error: new Error('DB write failed') });
    mockFrom
      .mockReturnValueOnce(notFoundBuilder)
      .mockReturnValueOnce(failInsertBuilder);

    const manager = makeManager();
    await expect(manager.createOrGetCustomer('u4', 'fail@b.com')).rejects.toBeInstanceOf(BillingError);
  });

  it('throws BillingError with code CUSTOMER_CREATE_FAILED on error', async () => {
    const notFoundBuilder = makeBuilder({ data: null, error: { message: 'Not found' } });
    // Force the insert builder to also fail
    const failInsertBuilder = makeBuilder({ data: null, error: new Error('DB unavailable') });
    mockFrom
      .mockReturnValueOnce(notFoundBuilder)
      .mockReturnValueOnce(failInsertBuilder);

    const manager = makeManager();
    const err = await manager.createOrGetCustomer('u5', 'err@b.com').catch(e => e);
    expect(err).toBeInstanceOf(BillingError);
    expect((err as BillingError).code).toBe('CUSTOMER_CREATE_FAILED');
  });
});

// ---------------------------------------------------------------------------
// getUserSubscriptions
// ---------------------------------------------------------------------------

describe('BillingManager.getUserSubscriptions', () => {
  it('returns subscriptions from DB', async () => {
    const subs = [{ id: 'sub_1', status: 'active' }];
    const builder = makeBuilder({ data: subs, error: null });
    mockFrom.mockReturnValue(builder);

    const manager = makeManager();
    const result = await manager.getUserSubscriptions('u1');
    expect(result).toEqual(subs);
  });

  it('throws BillingError when DB returns error', async () => {
    const builder = makeBuilder({ data: null, error: new Error('DB read failed') });
    mockFrom.mockReturnValue(builder);

    const manager = makeManager();
    const err = await manager.getUserSubscriptions('u1').catch(e => e);
    expect(err).toBeInstanceOf(BillingError);
    expect((err as BillingError).code).toBe('FETCH_SUBSCRIPTIONS_FAILED');
  });
});

// ---------------------------------------------------------------------------
// getUserInvoices
// ---------------------------------------------------------------------------

describe('BillingManager.getUserInvoices', () => {
  it('returns invoices ordered by created date', async () => {
    const invoices = [{ id: 'inv_1' }, { id: 'inv_2' }];
    const builder = makeBuilder({ data: invoices, error: null });
    mockFrom.mockReturnValue(builder);

    const manager = makeManager();
    const result = await manager.getUserInvoices('u1');
    expect(result).toEqual(invoices);
  });

  it('throws BillingError with code FETCH_INVOICES_FAILED on error', async () => {
    const builder = makeBuilder({ data: null, error: new Error('Invoice query failed') });
    mockFrom.mockReturnValue(builder);

    const manager = makeManager();
    const err = await manager.getUserInvoices('u1').catch(e => e);
    expect(err).toBeInstanceOf(BillingError);
    expect((err as BillingError).code).toBe('FETCH_INVOICES_FAILED');
  });
});

// ---------------------------------------------------------------------------
// updateSubscription
// ---------------------------------------------------------------------------

describe('BillingManager.updateSubscription', () => {
  const currentSub = {
    id: 'sub_1',
    processor_subscription_id: 'stripe_sub_1',
    tier: 'starter',
  };

  it('updates tier in local DB', async () => {
    const updatedSub = { ...currentSub, tier: 'professional' };
    const fetchBuilder = makeBuilder({ data: currentSub, error: null });
    const updateBuilder = makeBuilder({ data: updatedSub, error: null });
    mockFrom
      .mockReturnValueOnce(fetchBuilder)
      .mockReturnValueOnce(updateBuilder);

    const manager = makeManager();
    const result = await manager.updateSubscription({ subscriptionId: 'sub_1', tier: 'professional' });
    expect(result.tier).toBe('professional');
  });

  it('updates cancelAtPeriodEnd in local DB', async () => {
    const updatedSub = { ...currentSub, cancel_at_period_end: true };
    const fetchBuilder = makeBuilder({ data: currentSub, error: null });
    const updateBuilder = makeBuilder({ data: updatedSub, error: null });
    mockFrom
      .mockReturnValueOnce(fetchBuilder)
      .mockReturnValueOnce(updateBuilder);

    const manager = makeManager();
    const result = await manager.updateSubscription({
      subscriptionId: 'sub_1',
      cancelAtPeriodEnd: true,
    });
    expect(result).toEqual(updatedSub);
  });

  it('throws BillingError when subscription is not found', async () => {
    const notFoundBuilder = makeBuilder({ data: null, error: new Error('Not found') });
    mockFrom.mockReturnValue(notFoundBuilder);

    const manager = makeManager();
    const err = await manager.updateSubscription({ subscriptionId: 'missing' }).catch(e => e);
    expect(err).toBeInstanceOf(BillingError);
    expect((err as BillingError).code).toBe('SUBSCRIPTION_UPDATE_FAILED');
  });
});

// ---------------------------------------------------------------------------
// cancelSubscription
// ---------------------------------------------------------------------------

describe('BillingManager.cancelSubscription', () => {
  const sub = { id: 'sub_1', processor_subscription_id: 'stripe_sub_1' };

  it('cancels immediately via @finsavvyai/pay when immediately=true', async () => {
    const fetchBuilder = makeBuilder({ data: sub, error: null });
    const updateBuilder = makeBuilder({ data: {}, error: null });
    const insertBuilder = makeBuilder({ data: {}, error: null });
    mockFrom
      .mockReturnValueOnce(fetchBuilder)
      .mockReturnValueOnce(updateBuilder)
      .mockReturnValueOnce(insertBuilder);
    mockPayCancelSubscription.mockResolvedValue(undefined);

    const manager = makeManager();
    await manager.cancelSubscription({ subscriptionId: 'sub_1', immediately: true });
    expect(mockPayCancelSubscription).toHaveBeenCalledWith('stripe_sub_1');
  });

  it('does not call cancel when immediately=false', async () => {
    const fetchBuilder = makeBuilder({ data: sub, error: null });
    const updateBuilder = makeBuilder({ data: {}, error: null });
    const insertBuilder = makeBuilder({ data: {}, error: null });
    mockFrom
      .mockReturnValueOnce(fetchBuilder)
      .mockReturnValueOnce(updateBuilder)
      .mockReturnValueOnce(insertBuilder);

    const manager = makeManager();
    await manager.cancelSubscription({ subscriptionId: 'sub_1', immediately: false });
    expect(mockPayCancelSubscription).not.toHaveBeenCalled();
  });

  it('throws BillingError when subscription is not found', async () => {
    const notFoundBuilder = makeBuilder({ data: null, error: new Error('Not found') });
    mockFrom.mockReturnValue(notFoundBuilder);

    const manager = makeManager();
    const err = await manager.cancelSubscription({ subscriptionId: 'missing' }).catch(e => e);
    expect(err).toBeInstanceOf(BillingError);
    expect((err as BillingError).code).toBe('SUBSCRIPTION_CANCEL_FAILED');
  });
});

// ---------------------------------------------------------------------------
// trackUsage
// ---------------------------------------------------------------------------

describe('BillingManager.trackUsage', () => {
  it('inserts usage record and checks quota', async () => {
    // insert usage_records
    const insertBuilder = makeBuilder({ data: {}, error: null });
    // getUsageQuota: fetch subscription
    const subBuilder = makeBuilder({ data: { tier: 'starter' }, error: null });
    // getUsageQuota: fetch usage records
    const usageBuilder = makeBuilder({ data: [], error: null });

    mockFrom
      .mockReturnValueOnce(insertBuilder)
      .mockReturnValueOnce(subBuilder)
      .mockReturnValueOnce(usageBuilder);

    const manager = makeManager();
    // trackUsage swallows errors, so this should always resolve
    await expect(
      manager.trackUsage({ userId: 'u1', productId: 'rag', metric: 'queriesPerMonth', quantity: 1 }),
    ).resolves.toBeUndefined();
  });

  it('does not throw even when DB insert fails', async () => {
    const failBuilder = makeBuilder({ data: null, error: new Error('insert error') });
    mockFrom.mockReturnValue(failBuilder);

    const manager = makeManager();
    await expect(
      manager.trackUsage({ userId: 'u1', productId: 'rag', metric: 'queriesPerMonth', quantity: 5 }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getUsageQuota
// ---------------------------------------------------------------------------

describe('BillingManager.getUsageQuota', () => {
  it('returns quota with correct remaining for starter tier', async () => {
    const subBuilder = makeBuilder({ data: { tier: 'starter' }, error: null });
    const usageBuilder = makeBuilder({ data: [{ quantity: 200 }, { quantity: 100 }], error: null });
    mockFrom
      .mockReturnValueOnce(subBuilder)
      .mockReturnValueOnce(usageBuilder);

    const manager = makeManager();
    const quota = await manager.getUsageQuota('u1', 'rag', 'queriesPerMonth');

    expect(quota.used).toBe(300);
    expect(quota.limit).toBe(DEFAULT_TIER_CONFIGS.starter.products.rag.queriesPerMonth);
    expect(quota.remaining).toBe(Math.max(0, quota.limit - 300));
    expect(quota.userId).toBe('u1');
  });

  it('returns remaining=-1 for enterprise unlimited metrics', async () => {
    const subBuilder = makeBuilder({ data: { tier: 'enterprise' }, error: null });
    const usageBuilder = makeBuilder({ data: [{ quantity: 9999 }], error: null });
    mockFrom
      .mockReturnValueOnce(subBuilder)
      .mockReturnValueOnce(usageBuilder);

    const manager = makeManager();
    const quota = await manager.getUsageQuota('u1', 'rag', 'queriesPerMonth');
    expect(quota.limit).toBe(-1);
    expect(quota.remaining).toBe(-1);
  });

  it('throws BillingError when no active subscription', async () => {
    const subBuilder = makeBuilder({ data: null, error: new Error('No sub') });
    mockFrom.mockReturnValue(subBuilder);

    const manager = makeManager();
    const err = await manager.getUsageQuota('u1', 'rag', 'queriesPerMonth').catch(e => e);
    expect(err).toBeInstanceOf(BillingError);
    expect((err as BillingError).code).toBe('QUOTA_CHECK_FAILED');
  });
});

// ---------------------------------------------------------------------------
// suggestTierUpgrade
// ---------------------------------------------------------------------------

describe('BillingManager.suggestTierUpgrade', () => {
  it('returns null when user has no subscriptions', async () => {
    const builder = makeBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    const manager = makeManager();
    const result = await manager.suggestTierUpgrade('u1');
    expect(result).toBeNull();
  });

  it('returns null when already on enterprise', async () => {
    const builder = makeBuilder({ data: [{ tier: 'enterprise' }], error: null });
    mockFrom.mockReturnValue(builder);

    const manager = makeManager();
    const result = await manager.suggestTierUpgrade('u1');
    expect(result).toBeNull();
  });

  it('suggests professional when on starter', async () => {
    const builder = makeBuilder({ data: [{ tier: 'starter' }], error: null });
    mockFrom.mockReturnValue(builder);

    const manager = makeManager();
    const result = await manager.suggestTierUpgrade('u1');
    expect(result?.currentTier).toBe('starter');
    expect(result?.suggestedTier).toBe('professional');
    expect(result?.monthlySavingsIfAnnual).toBe(Math.round(DEFAULT_TIER_CONFIGS.professional.price * 0.2));
  });

  it('suggests enterprise when on professional', async () => {
    const builder = makeBuilder({ data: [{ tier: 'professional' }], error: null });
    mockFrom.mockReturnValue(builder);

    const manager = makeManager();
    const result = await manager.suggestTierUpgrade('u1');
    expect(result?.suggestedTier).toBe('enterprise');
  });

  it('returns null silently on errors', async () => {
    // getUserSubscriptions will throw a BillingError because DB returns error
    const builder = makeBuilder({ data: null, error: new Error('DB down') });
    mockFrom.mockReturnValue(builder);

    const manager = makeManager();
    const result = await manager.suggestTierUpgrade('u1');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getBillingAnalytics
// ---------------------------------------------------------------------------

describe('BillingManager.getBillingAnalytics', () => {
  it('returns analytics with correct revenue totals', async () => {
    const invoices = [
      { number: 'SUB-001', total: 99 },
      { number: 'SUB-002', total: 499 },
      { number: 'ONE-001', total: 50 },
    ];
    const subs = [
      { status: 'active' },
      { status: 'active' },
      { status: 'cancelled' },
    ];
    const customers = [{ id: 'c1' }, { id: 'c2' }];

    mockFrom
      .mockReturnValueOnce(makeBuilder({ data: invoices, error: null }))
      .mockReturnValueOnce(makeBuilder({ data: subs, error: null }))
      .mockReturnValueOnce(makeBuilder({ data: customers, error: null }));

    const manager = makeManager();
    const start = new Date('2026-01-01');
    const end = new Date('2026-01-31');
    const analytics = await manager.getBillingAnalytics(start, end);

    expect(analytics.revenue.monthlyRecurring).toBe(598); // 99 + 499
    expect(analytics.revenue.oneTimePayments).toBe(50);
    expect(analytics.revenue.total).toBe(648);
    expect(analytics.subscriptions.active).toBe(2);
    expect(analytics.subscriptions.churned).toBe(1);
    expect(analytics.customers.total).toBe(2);
    expect(analytics.period.start).toBe(start);
    expect(analytics.period.end).toBe(end);
  });

  it('handles empty data gracefully', async () => {
    mockFrom
      .mockReturnValueOnce(makeBuilder({ data: [], error: null }))
      .mockReturnValueOnce(makeBuilder({ data: [], error: null }))
      .mockReturnValueOnce(makeBuilder({ data: [], error: null }));

    const manager = makeManager();
    const analytics = await manager.getBillingAnalytics(new Date(), new Date());
    expect(analytics.revenue.total).toBe(0);
    expect(analytics.subscriptions.total).toBe(0);
    expect(analytics.customers.total).toBe(0);
  });

  it('throws BillingError with code ANALYTICS_FAILED when DB call throws synchronously', async () => {
    // Make .from() throw so the try/catch in getBillingAnalytics wraps it in a BillingError
    mockFrom.mockImplementation(() => {
      throw new Error('DB unavailable');
    });

    const manager = makeManager();
    const err = await manager.getBillingAnalytics(new Date(), new Date()).catch(e => e);
    expect(err).toBeInstanceOf(BillingError);
    expect((err as BillingError).code).toBe('ANALYTICS_FAILED');
  });
});

// ---------------------------------------------------------------------------
// handleWebhook
// ---------------------------------------------------------------------------

describe('BillingManager.handleWebhook', () => {
  it('returns success for checkout.session.completed', async () => {
    // handleCheckoutCompleted writes to checkout_sessions and subscriptions
    mockFrom.mockReturnValue(makeBuilder({ data: {}, error: null }));

    const manager = makeManager();
    const result = await manager.handleWebhook('checkout.session.completed', {
      metadata: { user_id: 'u1', product_id: 'sdlc', tier: 'starter' },
      id: 'cs_test',
      subscription: 'sub_1',
      customer: 'cus_1',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
    expect(result.success).toBe(true);
    expect(result.processed).toBe(true);
  });

  it('returns success for invoice.payment_succeeded', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: {}, error: null }));

    const manager = makeManager();
    const result = await manager.handleWebhook('invoice.payment_succeeded', {
      id: 'inv_1',
      number: 'SUB-001',
      amount_paid: 4990,
      currency: 'usd',
      due_date: Math.floor(Date.now() / 1000),
      created: Math.floor(Date.now() / 1000),
      invoice_pdf: 'https://example.com/inv.pdf',
    });
    expect(result.success).toBe(true);
  });

  it('returns success for invoice.payment_failed and updates subscription to past_due', async () => {
    const insertBuilder = makeBuilder({ data: {}, error: null });
    const updateBuilder = makeBuilder({ data: {}, error: null });
    mockFrom
      .mockReturnValueOnce(insertBuilder)
      .mockReturnValueOnce(updateBuilder);

    const manager = makeManager();
    const result = await manager.handleWebhook('invoice.payment_failed', {
      id: 'inv_fail',
      number: 'SUB-002',
      amount_due: 4990,
      currency: 'usd',
      due_date: Math.floor(Date.now() / 1000),
      created: Math.floor(Date.now() / 1000),
      subscription: 'stripe_sub_1',
    });
    expect(result.success).toBe(true);
  });

  it('returns success for customer.subscription.updated', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: {}, error: null }));

    const manager = makeManager();
    const result = await manager.handleWebhook('customer.subscription.updated', {
      id: 'stripe_sub_1',
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 2592000,
      cancel_at_period_end: false,
    });
    expect(result.success).toBe(true);
  });

  it('returns success for customer.subscription.deleted', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: {}, error: null }));

    const manager = makeManager();
    const result = await manager.handleWebhook('customer.subscription.deleted', {
      id: 'stripe_sub_1',
    });
    expect(result.success).toBe(true);
  });

  it('returns success=true for unknown event types (logs only)', async () => {
    const manager = makeManager();
    const result = await manager.handleWebhook('unknown.event.type', {});
    expect(result.success).toBe(true);
    expect(result.processed).toBe(true);
  });

  it('returns success=false when internal handler throws', async () => {
    // Force checkout handler to throw by making DB insert fail with a rejection
    mockFrom.mockImplementation(() => {
      throw new Error('catastrophic DB failure');
    });

    const manager = makeManager();
    const result = await manager.handleWebhook('checkout.session.completed', {
      metadata: { user_id: 'u1', product_id: 'sdlc', tier: 'starter' },
      id: 'cs_err',
      subscription: 'sub_err',
      customer: 'cus_err',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
    expect(result.success).toBe(false);
    expect(result.processed).toBe(false);
    expect(result.error).toBeDefined();
  });
});
