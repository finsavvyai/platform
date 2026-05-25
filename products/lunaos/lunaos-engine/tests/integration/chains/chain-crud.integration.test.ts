/**
 * Chain CRUD Integration Tests
 *
 * Tests chain listing, preset retrieval, and execution
 * history through the Hono app with D1 via miniflare.
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

describe('GET /chains — list preset chains', () => {
  it('returns preset chain list without auth', async () => {
    const res = await ctx.makeRequest('/chains', { auth: 'none' });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.presets).toBeDefined();
    expect(Array.isArray(body.presets)).toBe(true);
    expect(body.total).toBeDefined();
    expect(body.docs).toBeDefined();
  });
});

describe('GET /chains/:id/status — chain execution status', () => {
  it('returns status for an existing chain execution', async () => {
    // Insert a test chain execution
    await ctx.db
      .prepare(
        `INSERT INTO chain_executions
         (id, user_id, chain_name, chain_def, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'chain-exec-001', TEST_USER.id, 'test-chain',
        JSON.stringify({ name: 'test', nodes: [], edges: [] }),
        'completed', new Date().toISOString(),
      )
      .run();

    const res = await ctx.makeRequest('/chains/chain-exec-001/status', {
      auth: 'user',
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe('chain-exec-001');
    expect(body.chainName).toBe('test-chain');
    expect(body.status).toBe('completed');
  });

  it('returns 404 for non-existent chain execution', async () => {
    const res = await ctx.makeRequest('/chains/nonexistent/status', {
      auth: 'user',
    });
    expect(res.status).toBe(404);
  });

  it('rejects unauthenticated request', async () => {
    const res = await ctx.makeRequest('/chains/chain-exec-001/status', {
      auth: 'none',
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /chains/history — chain execution history', () => {
  it('returns chain execution history for authenticated user', async () => {
    const res = await ctx.makeRequest('/chains/history', { auth: 'user' });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.executions).toBeDefined();
    expect(Array.isArray(body.executions)).toBe(true);
    expect(body.count).toBeDefined();
  });

  it('supports pagination parameters', async () => {
    const res = await ctx.makeRequest(
      '/chains/history?limit=5&offset=0',
      { auth: 'user' },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.executions.length).toBeLessThanOrEqual(5);
  });

  it('rejects unauthenticated request', async () => {
    const res = await ctx.makeRequest('/chains/history', { auth: 'none' });
    expect(res.status).toBe(401);
  });
});
