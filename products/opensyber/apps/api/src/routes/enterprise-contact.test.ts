import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

// Enterprise contact is public (no auth required), but index routes use register.ts
// Test directly using the Hono app
import worker from '../index.js';

async function request(path: string, init: RequestInit = {}, env: Env) {
  const req = new Request(`http://localhost${path}`, init);
  return worker.fetch(req, env, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
}

describe('Enterprise Contact Route', () => {
  let env: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('ok', { status: 200 }))));
  });

  it('POST /api/enterprise/contact returns 400 with missing fields', async () => {
    const res = await request('/api/enterprise/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    }, env);
    expect(res.status).toBe(400);
  });

  it('POST /api/enterprise/contact returns 400 with invalid email', async () => {
    const res = await request('/api/enterprise/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice', email: 'not-an-email', company: 'Acme', message: 'Hello',
      }),
    }, env);
    expect(res.status).toBe(400);
  });

  it('POST /api/enterprise/contact returns 201 with valid data', async () => {
    const res = await request('/api/enterprise/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Smith', email: 'alice@acme.com', company: 'Acme Corp', message: 'We need enterprise features',
      }),
    }, env);
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.data.id).toBeDefined();
    expect(body.data.message).toContain('Thank you');
  });

  it('POST /api/enterprise/contact returns 400 when fields exceed max length', async () => {
    const res = await request('/api/enterprise/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'A'.repeat(201), email: 'a@b.com', company: 'Acme', message: 'Hi',
      }),
    }, env);
    expect(res.status).toBe(400);
  });
});
