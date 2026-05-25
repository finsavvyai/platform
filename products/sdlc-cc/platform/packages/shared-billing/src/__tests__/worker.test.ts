/**
 * Tests for the Cloudflare Worker (worker.ts).
 *
 * The worker's default export is a Hono app.  We call app.fetch() directly,
 * passing a fake env that provides BILLING_STORAGE (R2-like) and
 * LEMONSQUEEZY_WEBHOOK_SECRET.  This avoids any real HTTP server or wrangler.
 */
import { describe, it, expect } from 'vitest';
import app from '../worker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnv(overrides: Record<string, any> = {}) {
  const store = new Map<string, string>();
  const storage = {
    get: async (key: string) => {
      const val = store.get(key);
      if (!val) return null;
      return { json: async () => JSON.parse(val) };
    },
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    _store: store,
  };
  return {
    BILLING_STORAGE: storage,
    LEMONSQUEEZY_WEBHOOK_SECRET: 'test-webhook-secret',
    ...overrides,
  };
}

async function req(
  method: string,
  path: string,
  opts: { headers?: Record<string, string>; body?: any; env?: any } = {},
) {
  const env = opts.env ?? makeEnv();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...opts.headers };
  const init: RequestInit = { method, headers };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }
  const request = new Request(`http://localhost${path}`, init);
  const res = await app.fetch(request, env);
  return { res, body: await res.json() as any };
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 with healthy status', async () => {
    const { res, body } = await req('GET', '/health');
    expect(res.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('unified-billing');
    expect(body.processor).toBe('lemonsqueezy');
    expect(body.version).toBe('2.0.0');
  });
});

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

describe('GET /tiers', () => {
  it('returns all three subscription tiers', async () => {
    const { res, body } = await req('GET', '/tiers');
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(3);
    const ids = body.data.map((t: any) => t.id);
    expect(ids).toContain('starter');
    expect(ids).toContain('pro');
    expect(ids).toContain('enterprise');
  });

  it('enterprise tier has unlimited users', async () => {
    const { body } = await req('GET', '/tiers');
    const enterprise = body.data.find((t: any) => t.id === 'enterprise');
    expect(enterprise.limits.users).toBe('unlimited');
  });
});

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

describe('POST /checkout', () => {
  it('returns a checkout session with URL', async () => {
    const { res, body } = await req('POST', '/checkout', { body: {} });
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.data.sessionId).toBe('string');
    expect(body.data.url).toContain('session_id=');
    expect(body.data.expiresAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /subscription/:userId  (requires auth)
// ---------------------------------------------------------------------------

describe('GET /subscription/:userId', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const { res } = await req('GET', '/subscription/user_abc123');
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is too short (< 10 chars)', async () => {
    const { res } = await req('GET', '/subscription/user_abc123', {
      headers: { Authorization: 'Bearer short' },
    });
    expect(res.status).toBe(401);
  });

  it('creates and returns default subscription for new user', async () => {
    // The worker transforms a non-cus_ token to "user_" + first 8 chars.
    // Token "abc12345678" → userId "user_abc1" (first 8 chars of token).
    const token = 'abc12345678901';
    const expectedUserId = `user_${token.slice(0, 8)}`; // "user_abc12345"
    const { res, body } = await req('GET', `/subscription/${expectedUserId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.tier).toBe('starter');
    expect(body.data.status).toBe('trial');
    expect(body.data.userId).toBe(expectedUserId);
  });

  it('returns existing subscription from storage', async () => {
    const token = 'abc12345678901';
    // userId derived by worker: "user_" + first 8 chars of token
    const userId = `user_${token.slice(0, 8)}`;
    const env = makeEnv();
    // Pre-populate storage under the derived userId key
    const existingSub = { id: 'sub_existing', userId, tier: 'pro', status: 'active' };
    await env.BILLING_STORAGE.put(`subscriptions/${userId}.json`, JSON.stringify(existingSub));

    const { res, body } = await req('GET', `/subscription/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
      env,
    });
    expect(res.status).toBe(200);
    expect(body.data.tier).toBe('pro');
    expect(body.data.status).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// POST /subscription/:userId/upgrade
// ---------------------------------------------------------------------------

describe('POST /subscription/:userId/upgrade', () => {
  it('returns 400 for invalid tier', async () => {
    const { res, body } = await req('POST', '/subscription/u1/upgrade', {
      body: { newTier: 'diamond' },
    });
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid tier');
  });

  it('upgrades an existing subscription to pro', async () => {
    const userId = 'user_upgrade1234';
    const env = makeEnv();
    const existing = {
      id: 'sub_1',
      userId,
      tier: 'starter',
      status: 'active',
    };
    await env.BILLING_STORAGE.put(`subscriptions/${userId}.json`, JSON.stringify(existing));

    const { res, body } = await req('POST', `/subscription/${userId}/upgrade`, {
      body: { newTier: 'pro' },
      env,
    });
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.tier).toBe('pro');
    expect(body.data.limits.apiRequests).toBe(100000);
  });

  it('creates new subscription when none exists, promotes trial to active on upgrade', async () => {
    const userId = 'user_newupgrade12';
    const env = makeEnv();

    const { res, body } = await req('POST', `/subscription/${userId}/upgrade`, {
      body: { newTier: 'enterprise' },
      env,
    });
    expect(res.status).toBe(200);
    expect(body.data.tier).toBe('enterprise');
    // Worker logic: new sub starts as 'trial', upgrading converts it to 'active'
    expect(body.data.status).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// POST /subscription/:userId/cancel
// ---------------------------------------------------------------------------

describe('POST /subscription/:userId/cancel', () => {
  it('returns 404 when subscription does not exist', async () => {
    const { res, body } = await req('POST', '/subscription/nonexistent_user/cancel', {
      body: { immediate: false },
    });
    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
  });

  it('cancels at period end (immediate=false)', async () => {
    const userId = 'user_cancel12345';
    const env = makeEnv();
    const sub = {
      id: 'sub_cancel',
      userId,
      tier: 'pro',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 86400000).toISOString(),
    };
    await env.BILLING_STORAGE.put(`subscriptions/${userId}.json`, JSON.stringify(sub));

    const { res, body } = await req('POST', `/subscription/${userId}/cancel`, {
      body: { immediate: false },
      env,
    });
    expect(res.status).toBe(200);
    expect(body.data.status).toBe('active_until_period_end');
    expect(body.data.endsAt).toBe(sub.currentPeriodEnd);
  });

  it('cancels immediately when immediate=true', async () => {
    const userId = 'user_cancel_imm1';
    const env = makeEnv();
    const sub = {
      id: 'sub_imm',
      userId,
      tier: 'starter',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 86400000).toISOString(),
    };
    await env.BILLING_STORAGE.put(`subscriptions/${userId}.json`, JSON.stringify(sub));

    const { res, body } = await req('POST', `/subscription/${userId}/cancel`, {
      body: { immediate: true },
      env,
    });
    expect(res.status).toBe(200);
    expect(body.data.status).toBe('cancelled');
    expect(body.data.cancelledAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /analytics/:userId
// ---------------------------------------------------------------------------

describe('GET /analytics/:userId', () => {
  it('returns 404 when subscription does not exist', async () => {
    const { res, body } = await req('GET', '/analytics/no_sub_user');
    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
  });

  it('returns analytics with correct monthly revenue for pro tier', async () => {
    const userId = 'user_analytics123';
    const env = makeEnv();
    const sub = { id: 'sub_a', userId, tier: 'pro', status: 'active' };
    await env.BILLING_STORAGE.put(`subscriptions/${userId}.json`, JSON.stringify(sub));

    const { res, body } = await req('GET', `/analytics/${userId}`, { env });
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.currentMonth.revenue).toBe(99);
  });

  it('returns persisted analytics if already stored', async () => {
    const userId = 'user_analytics456';
    const env = makeEnv();
    const sub = { id: 'sub_b', userId, tier: 'starter', status: 'active' };
    const existingAnalytics = {
      currentMonth: { revenue: 500, usage: { apiRequests: 1000 } },
      trends: { revenue: [100, 200], usage: [] },
      subscriptionHistory: [],
    };
    await env.BILLING_STORAGE.put(`subscriptions/${userId}.json`, JSON.stringify(sub));
    await env.BILLING_STORAGE.put(`analytics/${userId}.json`, JSON.stringify(existingAnalytics));

    const { res, body } = await req('GET', `/analytics/${userId}`, { env });
    expect(res.status).toBe(200);
    // revenue is overwritten by current tier pricing
    expect(body.data.currentMonth.revenue).toBe(29);
  });
});

// ---------------------------------------------------------------------------
// POST /webhook
// ---------------------------------------------------------------------------

describe('POST /webhook', () => {
  it('returns 401 when X-Signature header is missing', async () => {
    const { res, body } = await req('POST', '/webhook', {
      body: { meta: { event_name: 'subscription_created' } },
    });
    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('returns 500 when LEMONSQUEEZY_WEBHOOK_SECRET env var is missing', async () => {
    const env = makeEnv({ LEMONSQUEEZY_WEBHOOK_SECRET: undefined });
    const { res, body } = await req('POST', '/webhook', {
      headers: { 'X-Signature': 'some-signature' },
      body: '{}',
      env,
    });
    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toContain('not configured');
  });

  it('returns 401 when signature does not match', async () => {
    const env = makeEnv();
    // Send a body with a deliberately wrong signature
    const { res, body } = await req('POST', '/webhook', {
      headers: { 'X-Signature': 'wrong-signature' },
      body: JSON.stringify({ meta: { event_name: 'subscription_created' }, id: 'evt_1', data: {} }),
      env,
    });
    expect(res.status).toBe(401);
    expect(body.error).toBe('Invalid signature');
  });
});

// ---------------------------------------------------------------------------
// 404 catch-all
// ---------------------------------------------------------------------------

describe('404 handler', () => {
  it('returns 404 with list of available endpoints for unknown routes', async () => {
    const { res, body } = await req('GET', '/nonexistent-route');
    expect(res.status).toBe(404);
    expect(Array.isArray(body.availableEndpoints)).toBe(true);
    expect(body.availableEndpoints.length).toBeGreaterThan(0);
  });
});
