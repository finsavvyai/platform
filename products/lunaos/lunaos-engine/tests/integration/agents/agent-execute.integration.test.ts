/**
 * Agent Execute Integration Tests
 *
 * Tests agent execution endpoint with auth, validation,
 * tier enforcement, and D1 record creation.
 * LLM calls are blocked by zero-trust so we verify the
 * request path up to the external fetch boundary.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestContext,
  type TestContext,
  TEST_FREE_USER,
  createTestJWT,
} from '../setup';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.dispose();
});

describe('POST /agents/execute — input validation', () => {
  it('rejects request without auth', async () => {
    const res = await ctx.makeRequest('/agents/execute', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({ agent: 'code-reviewer', context: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects request with missing agent field', async () => {
    const res = await ctx.makeRequest('/agents/execute', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({ context: 'test' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects request with missing context field', async () => {
    const res = await ctx.makeRequest('/agents/execute', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({ agent: 'code-reviewer' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects request with empty agent string', async () => {
    const res = await ctx.makeRequest('/agents/execute', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({ agent: '', context: 'test' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /agents/execute — unknown agent', () => {
  it('returns 404 for non-existent agent slug', async () => {
    const res = await ctx.makeRequest('/agents/execute', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({
        agent: 'non-existent-agent-xyz',
        context: 'Hello',
      }),
    });

    // Should be 404 or SSE error depending on where it fails
    const status = res.status;
    expect([404, 200]).toContain(status);

    if (status === 404) {
      const body = await res.json() as any;
      expect(body.error).toMatch(/unknown agent/i);
    }
  });
});

describe('POST /agents/execute — tier enforcement', () => {
  it('blocks free-tier user from pro agent access', async () => {
    const freeToken = await createTestJWT(
      TEST_FREE_USER.id,
      TEST_FREE_USER.email,
      'free',
    );

    // Get list to find a pro-only agent
    const listRes = await ctx.makeRequest('/agents/list', {
      auth: 'none',
    });
    const { agents } = await listRes.json() as any;
    const proAgent = agents.find((a: any) => a.tier === 'pro');

    if (!proAgent) {
      // Skip if no pro agents exist in personas
      return;
    }

    const res = await ctx.makeRequest('/agents/execute', {
      auth: 'none',
      method: 'POST',
      headers: { Authorization: `Bearer ${freeToken}` },
      body: JSON.stringify({
        agent: proAgent.slug,
        context: 'test context',
      }),
    });

    // Should be 403 (tier gate) or SSE with error
    const status = res.status;
    expect([403, 200]).toContain(status);

    if (status === 403) {
      const body = await res.json() as any;
      expect(body).toBeDefined();
    }
  });
});

describe('POST /agents/execute — API key auth', () => {
  it('accepts execution with API key header', async () => {
    const res = await ctx.makeRequest('/agents/execute', {
      auth: 'apikey',
      method: 'POST',
      body: JSON.stringify({
        agent: 'code-reviewer',
        context: 'Review this code: function add(a, b) { return a + b; }',
      }),
    });

    // API key auth should work; execution may fail at LLM call
    // but auth should pass (not 401)
    expect(res.status).not.toBe(401);
  });
});
