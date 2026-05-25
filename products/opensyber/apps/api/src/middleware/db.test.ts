import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

import { dbMiddleware } from './db.js';

describe('dbMiddleware', () => {
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    (globalThis as any).__mockDb = createMockDb();
  });

  it('sets db on context and calls next', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', dbMiddleware);
    app.get('/test', (c) => {
      const db = c.get('db');
      return c.json({ hasDb: !!db });
    });

    const res = await app.request('/test', {}, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.hasDb).toBe(true);
  });
});
