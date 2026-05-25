/**
 * SCIM User Provisioning Route Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { scimUserRoutes } from './scim-users.js';
import { createMockEnv } from '../test/helpers.js';

function createMockDB(results: unknown[]) {
  let callIndex = 0;
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn((..._args: unknown[]) => {
        const idx = callIndex++;
        return {
          all: vi.fn(async () => ({ results: Array.isArray(results[idx]) ? results[idx] : [] })),
          first: vi.fn(async () => (!Array.isArray(results[idx]) ? results[idx] : null)),
          run: vi.fn(async () => ({ success: true })),
        };
      }),
    })),
  } as unknown as D1Database;
}

const SCIM_TOKEN = 'scim_test_token_123';

function createApp(results: unknown[]) {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  app.route('/', scimUserRoutes);
  const mockCache = {
    get: vi.fn(async (key: string) => key === `scim:token:${SCIM_TOKEN}` ? JSON.stringify({ orgId: 'org_test' }) : null),
    put: vi.fn(), delete: vi.fn(), list: vi.fn(), getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
  const env = createMockEnv({ DB: createMockDB(results), CACHE: mockCache });
  return { app, env };
}

const scimHeaders = { Authorization: `Bearer ${SCIM_TOKEN}` };

describe('SCIM Users', () => {
  it('GET /Users returns list response', async () => {
    const { app, env } = createApp([
      [{ user_id: 'u1', email: 'a@b.com', status: 'active', createdAt: '2026-01-01' }],
      { cnt: 1 },
    ]);

    const res = await app.request('/Users', { headers: scimHeaders }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.schemas[0]).toContain('ListResponse');
  });

  it('GET /Users/:id returns 404 when not found', async () => {
    const { app, env } = createApp([null]);
    const res = await app.request('/Users/missing', { headers: scimHeaders }, env);
    expect(res.status).toBe(404);
  });

  it('POST /Users creates a user', async () => {
    const { app, env } = createApp([]);
    const res = await app.request('/Users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...scimHeaders },
      body: JSON.stringify({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        userName: 'test@example.com',
        emails: [{ value: 'test@example.com', primary: true }],
        active: true,
      }),
    }, env);
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.userName).toBe('test@example.com');
  });

  it('POST /Users requires email', async () => {
    const { app, env } = createApp([]);
    const res = await app.request('/Users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...scimHeaders },
      body: JSON.stringify({ schemas: [], userName: '' }),
    }, env);
    expect(res.status).toBe(400);
  });

  it('DELETE /Users/:id returns 204', async () => {
    const { app, env } = createApp([]);
    const res = await app.request('/Users/u1', { method: 'DELETE', headers: scimHeaders }, env);
    expect(res.status).toBe(204);
  });

  it('PUT /Users/:id updates user', async () => {
    const { app, env } = createApp([
      null, // UPDATE run
      { user_id: 'u1', email: 'a@b.com', status: 'removed', createdAt: '2026-01-01' },
    ]);

    const res = await app.request('/Users/u1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...scimHeaders },
      body: JSON.stringify({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        userName: 'a@b.com',
        active: false,
      }),
    }, env);
    expect(res.status).toBe(200);
  });
});
