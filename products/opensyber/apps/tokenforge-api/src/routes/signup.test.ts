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

async function postSignup(body: unknown, env: Env): Promise<Response> {
  return worker.fetch(
    new Request('http://localhost/public/provision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

describe('POST /public/provision (signup)', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns 400 validation_error when name is missing', async () => {
    const res = await postSignup({ email: 'alice@acme.com' }, env);
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('validation_error');
  });

  it('returns 400 validation_error when email is malformed', async () => {
    const res = await postSignup({ name: 'Alice', email: 'not-an-email' }, env);
    expect(res.status).toBe(400);
  });

  it('returns 400 validation_error when name exceeds 100 chars', async () => {
    const res = await postSignup({ name: 'a'.repeat(101), email: 'alice@acme.com' }, env);
    expect(res.status).toBe(400);
  });

  it('creates a new tenant + API key on first signup (existing=false, status 201)', async () => {
    db._setSelectResult([]); // no existing tenant
    const res = await postSignup({ name: 'Alice Co', email: 'alice@acme.com' }, env);
    expect(res.status).toBe(201);
    const j = (await res.json()) as {
      data: { tenantId: string; apiKey: string; prefix: string; plan: string; existing: boolean; message: string };
    };
    expect(j.data.tenantId).toMatch(/^tf_/);
    expect(j.data.apiKey).toBeTruthy();
    expect(j.data.prefix).toBeTruthy();
    expect(j.data.plan).toBe('free');
    expect(j.data.existing).toBe(false);
    expect(j.data.message).toContain('Copy your API key now');
    expect(db.insert).toHaveBeenCalled();
  });

  it('on duplicate email slug, returns existing tenantId + a new API key (existing=true, status 200)', async () => {
    db._setSelectResult([{
      id: 'tf_existing_tenant_1',
      slug: 'alice',
      plan: 'pro',
      name: 'Alice Co',
    }]);
    const res = await postSignup({ name: 'Alice Co', email: 'alice@acme.com' }, env);
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      data: { tenantId: string; plan: string; existing: boolean; apiKey: string; message?: string };
    };
    expect(j.data.tenantId).toBe('tf_existing_tenant_1');
    expect(j.data.plan).toBe('pro');
    expect(j.data.existing).toBe(true);
    expect(j.data.apiKey).toBeTruthy();
    // The "Copy your API key now" message only appears on new tenant path
    expect(j.data.message).toBeUndefined();
  });

  it('produces an API key with the documented `tf_` shape and a separate display prefix', async () => {
    db._setSelectResult([]);
    const res = await postSignup({ name: 'Bob', email: 'bob@acme.com' }, env);
    const j = (await res.json()) as { data: { apiKey: string; prefix: string } };
    // Per lib/api-key-gen.ts: full key is `tf_<32 hex>` and prefix is
    // `<first 8 chars> + "..."` so dashboards can show "tf_abc1..." while
    // the secret stays in the response body once.
    expect(j.data.apiKey).toMatch(/^tf_[a-f0-9]{32}$/);
    expect(j.data.prefix).toMatch(/^tf_[a-f0-9]{5}\.\.\.$/);
    expect(j.data.apiKey.slice(0, 8)).toBe(j.data.prefix.slice(0, 8));
  });

  it('derives slug from email local part, replacing special chars with "-" and lowercasing', async () => {
    db._setSelectResult([]);
    await postSignup({ name: 'Alice', email: 'John.Doe+test@Acme.com' }, env);
    const tenantInsert = db.insert.mock.calls.find((c) => c[0] === undefined ? false : true);
    void tenantInsert;
    // First insert is to tfTenants; values() called with the tenant payload.
    const inserted = db._insertChain.values.mock.calls[0]?.[0] as { slug?: string };
    expect(inserted.slug).toBe('john-doe-test');
  });

  it('binds ownerUserId to the new tenantId on first signup (self-owning bootstrap)', async () => {
    db._setSelectResult([]);
    await postSignup({ name: 'Alice', email: 'alice@acme.com' }, env);
    const inserted = db._insertChain.values.mock.calls[0]?.[0] as { id?: string; ownerUserId?: string };
    expect(inserted.id).toBeDefined();
    expect(inserted.ownerUserId).toBe(inserted.id);
  });

  it('sets plan="free" on first signup', async () => {
    db._setSelectResult([]);
    const res = await postSignup({ name: 'Alice', email: 'alice@acme.com' }, env);
    const j = (await res.json()) as { data: { plan: string } };
    expect(j.data.plan).toBe('free');
    const inserted = db._insertChain.values.mock.calls[0]?.[0] as { plan?: string };
    expect(inserted.plan).toBe('free');
  });

  it('first-signup response includes the "Copy your API key now" message (not shown on duplicate)', async () => {
    db._setSelectResult([]);
    const res = await postSignup({ name: 'Alice', email: 'alice@acme.com' }, env);
    const j = (await res.json()) as { data: { message: string } };
    expect(j.data.message).toContain('Copy your API key now');
  });
});
