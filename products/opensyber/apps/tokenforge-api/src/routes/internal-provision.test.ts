import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));
vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/tenant-auth.js', () => ({
  tenantAuth: async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/guard.js', () => ({
  guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));

import worker from '../index.js';

async function postProvision(
  body: unknown,
  env: Env,
  headers: Record<string, string> = {},
): Promise<Response> {
  return worker.fetch(
    new Request('http://localhost/internal/provision', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

describe('POST /internal/provision', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv({ INTERNAL_API_SECRET: 'shhh-server-only' });
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns 403 forbidden when X-Internal-Secret header is missing', async () => {
    const res = await postProvision({ name: 'Acme', email: 'a@acme.com' }, env);
    expect(res.status).toBe(403);
    expect((await res.json() as { error: string }).error).toBe('forbidden');
  });

  it('returns 403 forbidden when X-Internal-Secret is wrong', async () => {
    const res = await postProvision(
      { name: 'Acme', email: 'a@acme.com' },
      env,
      { 'X-Internal-Secret': 'guess' },
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 invalid_request when name is missing', async () => {
    const res = await postProvision(
      { email: 'a@acme.com' },
      env,
      { 'X-Internal-Secret': 'shhh-server-only' },
    );
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('invalid_request');
  });

  it('returns 200 with apiKey=null and existing=true when tenant slug already exists', async () => {
    db._setSelectResult([{ id: 'tf_existing', slug: 'a', name: 'Acme' }]);
    const res = await postProvision(
      { name: 'Acme', email: 'a@acme.com' },
      env,
      { 'X-Internal-Secret': 'shhh-server-only' },
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { data: { tenantId: string; apiKey: null | string; existing: boolean } };
    expect(j.data.tenantId).toBe('tf_existing');
    expect(j.data.apiKey).toBeNull();
    expect(j.data.existing).toBe(true);
  });

  it('returns 201 with tenantId+apiKey+existing=false on first provision', async () => {
    db._setSelectResult([]);
    const res = await postProvision(
      { name: 'Acme', email: 'b@acme.com' },
      env,
      { 'X-Internal-Secret': 'shhh-server-only' },
    );
    expect(res.status).toBe(201);
    const j = (await res.json()) as { data: { tenantId: string; apiKey: string; existing: boolean } };
    expect(j.data.tenantId).toMatch(/^tf_[a-f0-9]{16}$/);
    expect(j.data.apiKey).toMatch(/^tf_[a-f0-9]{32}$/);
    expect(j.data.existing).toBe(false);
    // Insert called twice — once for tfTenants, once for tfApiKeys
    expect(db.insert).toHaveBeenCalledTimes(2);
  });

  it('does NOT insert tenant or key when secret is wrong (no DB side effects)', async () => {
    await postProvision(
      { name: 'Acme', email: 'a@acme.com' },
      env,
      { 'X-Internal-Secret': 'wrong' },
    );
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('derives slug from email local-part with special chars replaced and lowercased', async () => {
    db._setSelectResult([]);
    await postProvision(
      { name: 'Alice', email: 'John.Doe+test@Acme.com' },
      env,
      { 'X-Internal-Secret': 'shhh-server-only' },
    );
    const tenantInsert = db._insertChain.values.mock.calls[0]?.[0] as { slug?: string };
    expect(tenantInsert.slug).toBe('john-doe-test');
  });

  it('binds ownerUserId to the new tenantId on first provision (self-owning bootstrap)', async () => {
    db._setSelectResult([]);
    await postProvision(
      { name: 'Acme', email: 'a@acme.com' },
      env,
      { 'X-Internal-Secret': 'shhh-server-only' },
    );
    const inserted = db._insertChain.values.mock.calls[0]?.[0] as { id?: string; ownerUserId?: string };
    expect(inserted.ownerUserId).toBe(inserted.id);
    expect(inserted.id).toMatch(/^tf_[a-f0-9]{16}$/);
  });

  it('sets plan="free" on the inserted tenant row', async () => {
    db._setSelectResult([]);
    await postProvision(
      { name: 'Acme', email: 'a@acme.com' },
      env,
      { 'X-Internal-Secret': 'shhh-server-only' },
    );
    const inserted = db._insertChain.values.mock.calls[0]?.[0] as { plan?: string };
    expect(inserted.plan).toBe('free');
  });

  it('inserts API key with name="Default" + isActive=true', async () => {
    db._setSelectResult([]);
    await postProvision(
      { name: 'Acme', email: 'a@acme.com' },
      env,
      { 'X-Internal-Secret': 'shhh-server-only' },
    );
    // Second insert call is to tfApiKeys
    const apiKeyInsert = db._insertChain.values.mock.calls[1]?.[0] as { name?: string; isActive?: boolean };
    expect(apiKeyInsert.name).toBe('Default');
    expect(apiKeyInsert.isActive).toBe(true);
  });
});
