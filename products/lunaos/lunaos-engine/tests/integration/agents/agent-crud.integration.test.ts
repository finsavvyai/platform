/**
 * Agent CRUD Integration Tests
 *
 * Tests agent listing, detail retrieval, and execution history
 * through the Hono app with real D1 via miniflare.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestContext,
  type TestContext,
  TEST_USER,
} from '../setup';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.dispose();
});

describe('GET /agents/list — list available agents', () => {
  it('returns a list of agents without auth', async () => {
    const res = await ctx.makeRequest('/agents/list', { auth: 'none' });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.agents).toBeDefined();
    expect(Array.isArray(body.agents)).toBe(true);
    expect(body.total).toBeGreaterThan(0);
  });

  it('each agent has required fields', async () => {
    const res = await ctx.makeRequest('/agents/list', { auth: 'none' });
    const body = await res.json() as any;

    for (const agent of body.agents) {
      expect(agent.slug).toBeDefined();
      expect(agent.name).toBeDefined();
      expect(agent.category).toBeDefined();
      expect(agent.tier).toBeDefined();
    }
  });

  it('reports free and pro agent counts', async () => {
    const res = await ctx.makeRequest('/agents/list', { auth: 'none' });
    const body = await res.json() as any;

    expect(typeof body.free).toBe('number');
    expect(typeof body.pro).toBe('number');
    expect(body.free + body.pro).toBe(body.total);
  });
});

describe('GET /agents/executions — execution history', () => {
  it('returns empty list for user with no executions', async () => {
    const res = await ctx.makeRequest('/agents/executions', {
      auth: 'user',
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.executions).toBeDefined();
    expect(Array.isArray(body.executions)).toBe(true);
  });

  it('returns executions after inserting test data', async () => {
    // Insert a test execution directly
    await ctx.db
      .prepare(
        `INSERT INTO executions (id, user_id, agent, provider, model, duration_ms, output_length, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'exec-test-001', TEST_USER.id, 'code-reviewer',
        'deepseek', 'deepseek-chat', 1500, 2048,
        new Date().toISOString(),
      )
      .run();

    const res = await ctx.makeRequest('/agents/executions', {
      auth: 'user',
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.executions.length).toBeGreaterThan(0);
    const exec = body.executions.find((e: any) => e.id === 'exec-test-001');
    expect(exec).toBeDefined();
    expect(exec.agent).toBe('code-reviewer');
    expect(exec.duration_ms).toBe(1500);
  });

  it('supports pagination via limit and offset', async () => {
    const res = await ctx.makeRequest(
      '/agents/executions?limit=1&offset=0',
      { auth: 'user' },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.executions.length).toBeLessThanOrEqual(1);
  });

  it('rejects unauthenticated request', async () => {
    const res = await ctx.makeRequest('/agents/executions', {
      auth: 'none',
    });
    expect(res.status).toBe(401);
  });
});
