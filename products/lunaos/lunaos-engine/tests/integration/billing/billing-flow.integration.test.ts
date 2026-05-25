/**
 * Billing Flow Integration Tests
 *
 * Tests billing webhook processing, subscription management,
 * and usage reporting through the Hono app with D1 via miniflare.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestContext,
  type TestContext,
  TEST_USER,
} from '../setup';
import { TEST_LS_WEBHOOK_SECRET } from '../fixtures/test-env';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.dispose();
});

describe('GET /billing/subscription — get subscription', () => {
  it('returns free tier for user without subscription', async () => {
    const res = await ctx.makeRequest('/billing/subscription', {
      auth: 'user',
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.tier).toBe('free');
    expect(body.status).toBe('active');
    expect(body.subscription).toBeNull();
  });

  it('returns subscription details after inserting one', async () => {
    const now = new Date().toISOString();
    await ctx.db
      .prepare(
        `INSERT INTO subscriptions
         (id, user_id, ls_subscription_id, tier, status,
          current_period_start, current_period_end, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'sub-001', TEST_USER.id, 'ls_sub_123', 'pro', 'active',
        now, new Date(Date.now() + 30 * 86400000).toISOString(), now,
      )
      .run();

    const res = await ctx.makeRequest('/billing/subscription', {
      auth: 'user',
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.tier).toBe('pro');
    expect(body.status).toBe('active');
    expect(body.subscription).toBeDefined();
    expect(body.subscription.id).toBe('ls_sub_123');
  });

  it('rejects unauthenticated request', async () => {
    const res = await ctx.makeRequest('/billing/subscription', {
      auth: 'none',
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /billing/webhook — webhook processing', () => {
  it('rejects webhook without signature header', async () => {
    const res = await ctx.makeRequest('/billing/webhook', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({ meta: { event_name: 'subscription_created' } }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toMatch(/missing.*signature/i);
  });

  it('rejects webhook with invalid signature', async () => {
    const res = await ctx.makeRequest('/billing/webhook', {
      auth: 'none',
      method: 'POST',
      headers: { 'x-signature': 'invalid-signature' },
      body: JSON.stringify({
        meta: { event_name: 'subscription_created' },
        data: {},
      }),
    });

    expect(res.status).toBe(401);
  });
});

describe('GET /billing/usage — usage reporting', () => {
  it('returns usage stats for authenticated user', async () => {
    const res = await ctx.makeRequest('/billing/usage', { auth: 'user' });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.tier).toBeDefined();
    expect(body.used).toBeDefined();
    expect(body.limit).toBeDefined();
    expect(body.remaining).toBeDefined();
    expect(body.percentUsed).toBeDefined();
    expect(body.period).toBeDefined();
    expect(body.breakdown).toBeDefined();
    expect(body.breakdown.agentExecutions).toBeDefined();
    expect(body.breakdown.chainExecutions).toBeDefined();
  });

  it('counts executions within current month', async () => {
    // Insert executions in current month
    const now = new Date().toISOString();
    for (let i = 0; i < 3; i++) {
      await ctx.db
        .prepare(
          `INSERT INTO executions
           (id, user_id, agent, created_at) VALUES (?, ?, ?, ?)`,
        )
        .bind(`usage-exec-${i}`, TEST_USER.id, 'test-agent', now)
        .run();
    }

    const res = await ctx.makeRequest('/billing/usage', { auth: 'user' });
    const body = await res.json() as any;
    expect(body.breakdown.agentExecutions).toBeGreaterThanOrEqual(3);
  });

  it('rejects unauthenticated request', async () => {
    const res = await ctx.makeRequest('/billing/usage', { auth: 'none' });
    expect(res.status).toBe(401);
  });
});

describe('POST /billing/checkout — create checkout', () => {
  it('rejects unauthenticated request', async () => {
    const res = await ctx.makeRequest('/billing/checkout', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({ plan: 'pro' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects invalid plan value', async () => {
    const res = await ctx.makeRequest('/billing/checkout', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({ plan: 'invalid' }),
    });
    expect(res.status).toBe(400);
  });
});
