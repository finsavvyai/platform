/**
 * Cost Bomb Protection Route Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { costRoutes } from './costs.js';

function createMockKV() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
  };
}

function createTestApp() {
  const mockKV = createMockKV();
  const env = { CACHE: mockKV } as Record<string, unknown>;
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('userId' as never, 'user-cost-1');
    c.set('db' as never, {});
    await next();
  });
  app.route('/api/costs', costRoutes);

  // Wrapper that always passes env bindings
  const req = (path: string, init?: RequestInit) => app.request(path, init, env);
  const postReq = (path: string, body: unknown) =>
    req(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  return { req, postReq };
}

describe('Cost Routes', () => {
  it('POST /ingest accepts a valid cost event', async () => {
    const { req, postReq } = createTestApp();
    const res = await postReq('/api/costs/ingest', {
      agentId: 'agent-1',
      sessionId: 'session-1',
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 1000,
      outputTokens: 500,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.costUsd).toBeGreaterThan(0);
  });

  it('POST /ingest rejects missing fields', async () => {
    const { req, postReq } = createTestApp();
    const res = await postReq('/api/costs/ingest', {
      agentId: 'agent-1',
    });
    expect(res.status).toBe(400);
  });

  it('POST /ingest rejects negative tokens', async () => {
    const { req, postReq } = createTestApp();
    const res = await postReq('/api/costs/ingest', {
      agentId: 'agent-1',
      sessionId: 'session-1',
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: -100,
      outputTokens: 500,
    });
    expect(res.status).toBe(400);
  });

  it('GET /summary returns spend totals', async () => {
    const { req, postReq } = createTestApp();
    await postReq('/api/costs/ingest', {
      agentId: 'agent-1',
      sessionId: 'session-1',
      provider: 'anthropic',
      model: 'claude-opus-4',
      inputTokens: 10000,
      outputTokens: 2000,
    });
    const res = await req('/api/costs/summary');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.todayUsd).toBeGreaterThan(0);
    expect(body.data).toHaveProperty('budgetAlerts');
  });

  it('GET /events lists events with optional filter', async () => {
    const { req, postReq } = createTestApp();
    await postReq('/api/costs/ingest', {
      agentId: 'agent-2',
      sessionId: 'session-2',
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputTokens: 5000,
      outputTokens: 1000,
    });
    const res = await req('/api/costs/events?agentId=agent-2');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /budgets creates a budget rule', async () => {
    const { req, postReq } = createTestApp();
    const res = await postReq('/api/costs/budgets', {
      scope: 'daily',
      limitUsd: 50,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.scope).toBe('daily');
    expect(body.data.limitUsd).toBe(50);
  });

  it('POST /budgets rejects invalid scope', async () => {
    const { req, postReq } = createTestApp();
    const res = await postReq('/api/costs/budgets', {
      scope: 'yearly',
      limitUsd: 100,
    });
    expect(res.status).toBe(400);
  });

  it('GET /budgets lists budget rules', async () => {
    const { req, postReq } = createTestApp();
    await postReq('/api/costs/budgets', { scope: 'monthly', limitUsd: 500 });
    const res = await req('/api/costs/budgets');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('DELETE /budgets/:id deletes a rule', async () => {
    const { req, postReq } = createTestApp();
    const createRes = await postReq('/api/costs/budgets', {
      scope: 'weekly',
      limitUsd: 200,
    });
    const { data } = await createRes.json();

    const res = await req(`/api/costs/budgets/${data.id}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(true);
  });

  it('DELETE /budgets/:id returns 404 for unknown rule', async () => {
    const { req, postReq } = createTestApp();
    const res = await req('/api/costs/budgets/nonexistent', {
      method: 'DELETE',
    });
    expect(res.status).toBe(404);
  });
});
