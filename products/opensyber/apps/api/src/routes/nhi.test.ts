/**
 * NHI (Non-Human Identity) Manager Route Tests
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { nhiRoutes } from './nhi.js';

function createTestApp() {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('userId' as never, 'user-1');
    c.set('db' as never, {});
    await next();
  });
  app.route('/api/nhi/agents', nhiRoutes);
  return app;
}

function post(app: Hono, path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function patch(app: Hono, path: string, body: unknown) {
  return app.request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('NHI Routes', () => {
  it('POST / registers a new agent identity', async () => {
    const app = createTestApp();
    const res = await post(app, '/api/nhi/agents', {
      name: 'My Claude Agent',
      type: 'claude_code',
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe('My Claude Agent');
    expect(body.data.type).toBe('claude_code');
    expect(body.data.status).toBe('active');
    expect(body.data.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('POST / rejects invalid type', async () => {
    const app = createTestApp();
    const res = await post(app, '/api/nhi/agents', {
      name: 'Bad Agent',
      type: 'invalid_type',
    });
    expect(res.status).toBe(400);
  });

  it('POST / rejects missing name', async () => {
    const app = createTestApp();
    const res = await post(app, '/api/nhi/agents', { type: 'cursor' });
    expect(res.status).toBe(400);
  });

  it('GET / lists registered agents', async () => {
    const app = createTestApp();
    await post(app, '/api/nhi/agents', { name: 'Agent A', type: 'cursor' });
    const res = await app.request('/api/nhi/agents');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('PATCH /:id updates agent identity', async () => {
    const app = createTestApp();
    const createRes = await post(app, '/api/nhi/agents', {
      name: 'To Update',
      type: 'copilot',
    });
    const { data } = await createRes.json();

    const res = await patch(app, `/api/nhi/agents/${data.id}`, {
      name: 'Updated Agent',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe('Updated Agent');
  });

  it('PATCH /:id returns 404 for unknown agent', async () => {
    const app = createTestApp();
    const res = await patch(app, '/api/nhi/agents/nonexistent', {
      name: 'Nope',
    });
    expect(res.status).toBe(404);
  });

  it('POST /:id/suspend suspends and revokes token', async () => {
    const app = createTestApp();
    const createRes = await post(app, '/api/nhi/agents', {
      name: 'Suspendable',
      type: 'ci_runner',
    });
    const { data } = await createRes.json();

    const res = await post(app, `/api/nhi/agents/${data.id}/suspend`, {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('suspended');
  });

  it('GET /summary returns dashboard summary', async () => {
    const app = createTestApp();
    await post(app, '/api/nhi/agents', { name: 'S1', type: 'mcp_server' });
    const res = await app.request('/api/nhi/agents/summary');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('riskDistribution');
  });

  it('GET /orphaned returns orphaned agents list', async () => {
    const app = createTestApp();
    const res = await app.request('/api/nhi/agents/orphaned');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});
