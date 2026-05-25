/**
 * Tier Enforcement Integration Tests
 *
 * Tests that billing middleware correctly enforces execution
 * limits per tier (free: 100, pro: 10000, team: 100000).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestContext,
  type TestContext,
  TEST_FREE_USER,
  TEST_USER,
  createTestJWT,
} from '../setup';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.dispose();
});

describe('Billing middleware — execution limits', () => {
  it('free user sees correct usage limits in /billing/usage', async () => {
    const freeToken = await createTestJWT(
      TEST_FREE_USER.id,
      TEST_FREE_USER.email,
      'free',
    );

    const res = await ctx.makeRequest('/billing/usage', {
      auth: 'none',
      headers: { Authorization: `Bearer ${freeToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.tier).toBe('free');
    expect(body.limit).toBe(100);
  });

  it('pro user sees correct usage limits in /billing/usage', async () => {
    const res = await ctx.makeRequest('/billing/usage', { auth: 'user' });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.tier).toBe('pro');
    expect(body.limit).toBe(10000);
  });

  it('usage warning header set when over 80% used', async () => {
    // Insert 85 executions for free user to cross 80% threshold
    const now = new Date().toISOString();
    const freeToken = await createTestJWT(
      TEST_FREE_USER.id,
      TEST_FREE_USER.email,
      'free',
    );

    for (let i = 0; i < 85; i++) {
      await ctx.db
        .prepare(
          `INSERT INTO executions
           (id, user_id, agent, created_at) VALUES (?, ?, ?, ?)`,
        )
        .bind(
          `tier-exec-${i}`, TEST_FREE_USER.id,
          'test', now,
        )
        .run();
    }

    const res = await ctx.makeRequest('/billing/usage', {
      auth: 'none',
      headers: { Authorization: `Bearer ${freeToken}` },
    });

    const body = await res.json() as any;
    expect(body.percentUsed).toBeGreaterThanOrEqual(80);
    expect(body.warning).toBeDefined();
    expect(body.warning).toMatch(/limit reached/);
  });
});

describe('Tier-based subscription changes', () => {
  it('POST /billing/cancel rejects when no active subscription', async () => {
    const res = await ctx.makeRequest('/billing/cancel', {
      auth: 'user',
      method: 'POST',
    });

    // No subscription to cancel
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.error).toMatch(/no active subscription/i);
  });
});
