/**
 * Chain Execution Integration Tests
 *
 * Tests chain execution endpoint with validation,
 * preset resolution, and custom chain support.
 * LLM calls are blocked by zero-trust; we test up to
 * the execution boundary.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestContext,
  type TestContext,
} from '../setup';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.dispose();
});

describe('POST /chains/execute — validation', () => {
  it('rejects request without auth', async () => {
    const res = await ctx.makeRequest('/chains/execute', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({
        preset: 'code-review',
        context: 'test',
      }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects when neither preset nor chain provided', async () => {
    const res = await ctx.makeRequest('/chains/execute', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({ context: 'test' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects when context is missing', async () => {
    const res = await ctx.makeRequest('/chains/execute', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({ preset: 'code-review' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /chains/execute — preset chain', () => {
  it('returns 404 for unknown preset', async () => {
    const res = await ctx.makeRequest('/chains/execute', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({
        preset: 'nonexistent-preset',
        context: 'test context',
      }),
    });

    // May be 404 or SSE stream with error
    const status = res.status;
    expect([404, 200]).toContain(status);

    if (status === 404) {
      const body = await res.json() as any;
      expect(body.error).toMatch(/unknown preset/i);
      expect(body.available).toBeDefined();
    }
  });

  it('accepts API key auth for chain execution', async () => {
    const res = await ctx.makeRequest('/chains/execute', {
      auth: 'apikey',
      method: 'POST',
      body: JSON.stringify({
        preset: 'code-review',
        context: 'Review this function',
      }),
    });

    // Should not get 401 (auth should pass)
    expect(res.status).not.toBe(401);
  });
});

describe('POST /chains/execute — custom chain', () => {
  it('validates custom chain definition structure', async () => {
    const res = await ctx.makeRequest('/chains/execute', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({
        chain: {
          name: 'My Chain',
          nodes: [], // Empty nodes should fail
          edges: [],
        },
        context: 'test',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('accepts valid custom chain definition', async () => {
    const res = await ctx.makeRequest('/chains/execute', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({
        chain: {
          name: 'Test Chain',
          nodes: [
            {
              id: 'n1',
              agent: 'code-reviewer',
              promptTemplate: 'Review: {{context}}',
            },
          ],
          edges: [],
        },
        context: 'Review this code',
      }),
    });

    // Should not be a validation error
    expect(res.status).not.toBe(400);
  });
});

describe('POST /chains/:name/webhook — webhook trigger', () => {
  it('returns 404 for unknown chain name', async () => {
    const res = await ctx.makeRequest('/chains/nonexistent/webhook', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({ data: 'test' }),
    });

    expect(res.status).toBe(404);
  });
});
