/**
 * Tests for createBillingRoutes (api.ts) and initBillingServer helper.
 *
 * BillingManager is fully mocked so these tests focus purely on HTTP routing,
 * auth enforcement, and response shaping — not on business logic (which is
 * covered in billing-manager.test.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBillingRoutes, initBillingServer } from '../api';
import type { BillingConfig } from '../types';

// ---------------------------------------------------------------------------
// Mock BillingManager
// ---------------------------------------------------------------------------

const mockCreateCheckout = vi.fn();
const mockGetSubscriptions = vi.fn();
const mockUpdateSubscription = vi.fn();
const mockCancelSubscription = vi.fn();
const mockGetInvoices = vi.fn();
const mockGetUsageQuota = vi.fn();
const mockTrackUsage = vi.fn();
const mockSuggestTierUpgrade = vi.fn();
const mockGetBillingAnalytics = vi.fn();
const mockHandleWebhook = vi.fn();

vi.mock('../billing-manager', () => ({
  BillingManager: vi.fn().mockImplementation(() => ({
    createCheckoutSession: mockCreateCheckout,
    getUserSubscriptions: mockGetSubscriptions,
    updateSubscription: mockUpdateSubscription,
    cancelSubscription: mockCancelSubscription,
    getUserInvoices: mockGetInvoices,
    getUsageQuota: mockGetUsageQuota,
    trackUsage: mockTrackUsage,
    suggestTierUpgrade: mockSuggestTierUpgrade,
    getBillingAnalytics: mockGetBillingAnalytics,
    handleWebhook: mockHandleWebhook,
  })),
}));

// ---------------------------------------------------------------------------
// Also mock stripe, supabase, and @finsavvyai/pay so BillingManager constructor doesn't fail
// ---------------------------------------------------------------------------
vi.mock('stripe', () => ({ default: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
vi.mock('@finsavvyai/pay', () => ({
  createPaymentClient: vi.fn().mockReturnValue({
    name: 'stripe',
    createCheckout: vi.fn(),
    getSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    handleWebhook: vi.fn(),
  }),
  WebhookHandler: vi.fn().mockImplementation(() => ({
    handle: mockHandleWebhook,
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_CONFIG: BillingConfig = {
  processor: 'stripe',
  apiKey: 'sk_test',
  signingSecret: 'whsec_test',
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceKey: 'service_key',
  successUrl: 'https://app.example.com/success',
  cancelUrl: 'https://app.example.com/cancel',
};

function buildApp(config: BillingConfig = BASE_CONFIG) {
  return createBillingRoutes(config);
}

async function apiReq(
  app: ReturnType<typeof createBillingRoutes>,
  method: string,
  path: string,
  opts: { headers?: Record<string, string>; body?: any } = {},
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...opts.headers };
  const init: RequestInit = { method, headers };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }
  const res = await app.fetch(new Request(`http://localhost${path}`, init));
  return { res, body: await res.json() as any };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 with service info', async () => {
    const app = buildApp();
    const { res, body } = await apiReq(app, 'GET', '/health');
    expect(res.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('unified-billing');
    expect(body.processor).toBe('stripe');
    expect(typeof body.timestamp).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// POST /checkout
// ---------------------------------------------------------------------------

describe('POST /checkout', () => {
  it('returns 200 with checkout session on success', async () => {
    const session = { id: 'cs_1', url: 'https://checkout.example.com', tier: 'starter' };
    mockCreateCheckout.mockResolvedValue(session);

    const app = buildApp();
    const { res, body } = await apiReq(app, 'POST', '/checkout', {
      body: { userId: 'u1', email: 'u@e.com', tier: 'starter' },
    });

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(session);
  });

  it('returns 400 when BillingManager throws', async () => {
    mockCreateCheckout.mockRejectedValue(new Error('Stripe error'));

    const app = buildApp();
    const { res, body } = await apiReq(app, 'POST', '/checkout', {
      body: { userId: 'u1', email: 'u@e.com', tier: 'starter' },
    });

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /subscriptions  (requires Authorization header)
// ---------------------------------------------------------------------------

describe('GET /subscriptions', () => {
  it('returns 401 when Authorization header is absent', async () => {
    const app = buildApp();
    const { res, body } = await apiReq(app, 'GET', '/subscriptions');
    expect(res.status).toBe(401);
    expect(body.error).toBe('No token provided');
  });

  it('returns subscriptions when token is provided', async () => {
    const subs = [{ id: 'sub_1', tier: 'starter' }];
    mockGetSubscriptions.mockResolvedValue(subs);

    const app = buildApp();
    const { res, body } = await apiReq(app, 'GET', '/subscriptions', {
      headers: { Authorization: 'Bearer user-token-123' },
    });

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(subs);
  });

  it('returns 500 when manager throws', async () => {
    mockGetSubscriptions.mockRejectedValue(new Error('DB error'));

    const app = buildApp();
    const { res } = await apiReq(app, 'GET', '/subscriptions', {
      headers: { Authorization: 'Bearer user-token-123' },
    });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /subscriptions/:subscriptionId
// ---------------------------------------------------------------------------

describe('PUT /subscriptions/:subscriptionId', () => {
  it('returns 200 with updated subscription', async () => {
    const updated = { id: 'sub_1', tier: 'professional' };
    mockUpdateSubscription.mockResolvedValue(updated);

    const app = buildApp();
    const { res, body } = await apiReq(app, 'PUT', '/subscriptions/sub_1', {
      body: { tier: 'professional' },
    });

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(updated);
    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionId: 'sub_1', tier: 'professional' }),
    );
  });

  it('returns 400 when update fails', async () => {
    mockUpdateSubscription.mockRejectedValue(new Error('Update failed'));

    const app = buildApp();
    const { res } = await apiReq(app, 'PUT', '/subscriptions/sub_1', {
      body: { tier: 'professional' },
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// DELETE /subscriptions/:subscriptionId
// ---------------------------------------------------------------------------

describe('DELETE /subscriptions/:subscriptionId', () => {
  it('returns 200 on successful cancellation', async () => {
    mockCancelSubscription.mockResolvedValue(undefined);

    const app = buildApp();
    const { res, body } = await apiReq(app, 'DELETE', '/subscriptions/sub_1', {
      body: { immediately: true },
    });

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Subscription cancelled successfully');
  });

  it('returns 400 when cancellation fails', async () => {
    mockCancelSubscription.mockRejectedValue(new Error('Cancel failed'));

    const app = buildApp();
    const { res } = await apiReq(app, 'DELETE', '/subscriptions/sub_1', {
      body: { immediately: false },
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /invoices  (requires auth)
// ---------------------------------------------------------------------------

describe('GET /invoices', () => {
  it('returns 401 without token', async () => {
    const app = buildApp();
    const { res } = await apiReq(app, 'GET', '/invoices');
    expect(res.status).toBe(401);
  });

  it('returns invoices when authenticated', async () => {
    const invoices = [{ id: 'inv_1' }];
    mockGetInvoices.mockResolvedValue(invoices);

    const app = buildApp();
    const { res, body } = await apiReq(app, 'GET', '/invoices', {
      headers: { Authorization: 'Bearer user-token-123' },
    });
    expect(res.status).toBe(200);
    expect(body.data).toEqual(invoices);
  });
});

// ---------------------------------------------------------------------------
// GET /usage/quota  (requires auth)
// ---------------------------------------------------------------------------

describe('GET /usage/quota', () => {
  it('returns 401 without token', async () => {
    const app = buildApp();
    const { res } = await apiReq(app, 'GET', '/usage/quota');
    expect(res.status).toBe(401);
  });

  it('returns quota for user with productId and metric defaults', async () => {
    const quota = { userId: 'u1', productId: 'all', metric: 'requests', limit: 1000, used: 50, remaining: 950 };
    mockGetUsageQuota.mockResolvedValue(quota);

    const app = buildApp();
    const { res, body } = await apiReq(app, 'GET', '/usage/quota', {
      headers: { Authorization: 'Bearer user-token-123' },
    });
    expect(res.status).toBe(200);
    expect(body.data).toEqual(quota);
    expect(mockGetUsageQuota).toHaveBeenCalledWith(
      expect.any(String),
      'all',
      'requests',
    );
  });
});

// ---------------------------------------------------------------------------
// POST /usage
// ---------------------------------------------------------------------------

describe('POST /usage', () => {
  it('returns 200 on successful track', async () => {
    mockTrackUsage.mockResolvedValue(undefined);

    const app = buildApp();
    const { res, body } = await apiReq(app, 'POST', '/usage', {
      body: { userId: 'u1', productId: 'rag', metric: 'queriesPerMonth', quantity: 3 },
    });
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 400 when tracking fails', async () => {
    mockTrackUsage.mockRejectedValue(new Error('Write failed'));

    const app = buildApp();
    const { res } = await apiReq(app, 'POST', '/usage', {
      body: { userId: 'u1', productId: 'rag', metric: 'queriesPerMonth', quantity: 3 },
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /bundle-offer  (requires auth)
// ---------------------------------------------------------------------------

describe('GET /bundle-offer', () => {
  it('returns 401 without token', async () => {
    const app = buildApp();
    const { res } = await apiReq(app, 'GET', '/bundle-offer');
    expect(res.status).toBe(401);
  });

  it('returns bundle offer when authenticated', async () => {
    const offer = { currentTier: 'starter', suggestedTier: 'professional', savings: 20 };
    mockSuggestTierUpgrade.mockResolvedValue(offer);

    const app = buildApp();
    const { res, body } = await apiReq(app, 'GET', '/bundle-offer', {
      headers: { Authorization: 'Bearer user-token-123' },
    });
    expect(res.status).toBe(200);
    expect(body.data).toEqual(offer);
  });
});

// ---------------------------------------------------------------------------
// GET /analytics
// ---------------------------------------------------------------------------

describe('GET /analytics', () => {
  it('returns analytics with default date range', async () => {
    const analytics = { revenue: { total: 1000 }, subscriptions: { active: 5 } };
    mockGetBillingAnalytics.mockResolvedValue(analytics);

    const app = buildApp();
    const { res, body } = await apiReq(app, 'GET', '/analytics');
    expect(res.status).toBe(200);
    expect(body.data).toEqual(analytics);
  });

  it('returns 500 when analytics query fails', async () => {
    mockGetBillingAnalytics.mockRejectedValue(new Error('Analytics error'));

    const app = buildApp();
    const { res } = await apiReq(app, 'GET', '/analytics');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /webhook
// ---------------------------------------------------------------------------

describe('POST /webhook (Stripe)', () => {
  it('returns 401 when stripe-signature header is absent', async () => {
    const app = buildApp();
    const { res, body } = await apiReq(app, 'POST', '/webhook', {
      body: JSON.stringify({ type: 'checkout.session.completed', data: {} }),
    });
    expect(res.status).toBe(401);
    expect(body.error).toBe('No signature provided');
  });

  it('returns 401 for lemonsqueezy when wrong signature header is used', async () => {
    const app = buildApp({ ...BASE_CONFIG, processor: 'lemonsqueezy' });
    const { res, body } = await apiReq(app, 'POST', '/webhook', {
      headers: { 'stripe-signature': 'sig_test' },
      body: JSON.stringify({}),
    });
    // LemonSqueezy expects X-Signature header, not stripe-signature
    expect(res.status).toBe(401);
    expect(body.error).toBe('No signature provided');
  });
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const app = buildApp();
    const { res, body } = await apiReq(app, 'GET', '/unknown-route');
    expect(res.status).toBe(404);
    expect(body.error).toBe('Not found');
  });
});

// ---------------------------------------------------------------------------
// initBillingServer
// ---------------------------------------------------------------------------

describe('initBillingServer', () => {
  it('returns an object with start and stop methods', () => {
    const server = initBillingServer(BASE_CONFIG, 8788);
    expect(typeof server.start).toBe('function');
    expect(typeof server.stop).toBe('function');
  });

  it('start() resolves with port and status when config is valid', async () => {
    const server = initBillingServer(BASE_CONFIG, 8788);
    const result = await server.start();
    expect(result.port).toBe(8788);
    expect(result.status).toBe('starting');
  });

  it('start() throws when apiKey is missing', async () => {
    const server = initBillingServer({ ...BASE_CONFIG, apiKey: '' }, 8788);
    await expect(server.start()).rejects.toThrow('Missing required configuration');
  });

  it('start() throws when supabaseUrl is missing', async () => {
    const server = initBillingServer({ ...BASE_CONFIG, supabaseUrl: '' }, 8788);
    await expect(server.start()).rejects.toThrow('Missing required configuration');
  });

  it('start() throws when supabaseServiceKey is missing', async () => {
    const server = initBillingServer({ ...BASE_CONFIG, supabaseServiceKey: '' }, 8788);
    await expect(server.start()).rejects.toThrow('Missing required configuration');
  });

  it('stop() does not throw', () => {
    const server = initBillingServer(BASE_CONFIG);
    expect(() => server.stop()).not.toThrow();
  });
});
