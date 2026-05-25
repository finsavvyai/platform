import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb) }));
vi.mock('hono/logger', () => ({ logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));

import worker from '../index.js';

const SECRET = 'test_internal_secret';
const VALID_JWK = { kty: 'EC', crv: 'P-256', x: 'AAAA', y: 'BBBB' };

async function api(method: string, path: string, env: Env, opts: { body?: unknown; secret?: string } = {}): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.secret !== undefined) headers['X-Internal-Secret'] = opts.secret;
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      method, headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

let env: Env;
let db: ReturnType<typeof createMockDb>;
beforeEach(() => {
  vi.clearAllMocks();
  env = createMockEnv();
  db = createMockDb();
  (globalThis as Record<string, unknown>).__mockDb = db;
});

describe('POST /internal/signing-keys', () => {
  const validBody = { kid: 'kid-2026-05', alg: 'ES256', publicJwk: VALID_JWK };

  it('403 forbidden when X-Internal-Secret is missing', async () => {
    const r = await api('POST', '/internal/signing-keys', env, { body: validBody });
    expect(r.status).toBe(403);
  });

  it('403 forbidden when X-Internal-Secret does not match', async () => {
    const r = await api('POST', '/internal/signing-keys', env, { body: validBody, secret: 'wrong' });
    expect(r.status).toBe(403);
  });

  it('400 invalid_payload when body is missing required fields', async () => {
    const r = await api('POST', '/internal/signing-keys', env, { body: { kid: 'k1' }, secret: SECRET });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('invalid_payload');
  });

  it('400 invalid_payload when alg is not ES256', async () => {
    const r = await api('POST', '/internal/signing-keys', env, {
      body: { kid: 'k1', alg: 'RS256', publicJwk: VALID_JWK },
      secret: SECRET,
    });
    expect(r.status).toBe(400);
  });

  it('400 invalid_payload when JWK kty is not EC', async () => {
    const r = await api('POST', '/internal/signing-keys', env, {
      body: { kid: 'k1', alg: 'ES256', publicJwk: { kty: 'RSA', crv: 'P-256', x: 'X', y: 'Y' } },
      secret: SECRET,
    });
    expect(r.status).toBe(400);
  });

  it('400 invalid_payload when kid contains illegal characters (regex enforced)', async () => {
    const r = await api('POST', '/internal/signing-keys', env, {
      body: { kid: 'has spaces!', alg: 'ES256', publicJwk: VALID_JWK },
      secret: SECRET,
    });
    expect(r.status).toBe(400);
  });

  it('201 with kid + alg + status=active on happy path; persists publicJwk merged with kid+alg', async () => {
    const r = await api('POST', '/internal/signing-keys', env, { body: validBody, secret: SECRET });
    expect(r.status).toBe(201);
    const j = (await r.json()) as { data: { kid: string; alg: string; status: string } };
    expect(j.data.kid).toBe('kid-2026-05');
    expect(j.data.status).toBe('active');
    expect(db.insert).toHaveBeenCalled();
  });

  it('409 kid_already_exists when DB throws UNIQUE constraint', async () => {
    db._insertChain.values.mockRejectedValueOnce(new Error('UNIQUE constraint failed: tf_signing_keys.kid'));
    const r = await api('POST', '/internal/signing-keys', env, { body: validBody, secret: SECRET });
    expect(r.status).toBe(409);
    expect(((await r.json()) as { error: string }).error).toBe('kid_already_exists');
  });
});

describe('GET /internal/signing-keys', () => {
  it('403 without secret', async () => {
    const r = await api('GET', '/internal/signing-keys', env);
    expect(r.status).toBe(403);
  });

  it('returns metadata only (no publicJwk leak in list view)', async () => {
    db._setSelectResult([
      { id: 'sk_1', kid: 'k1', alg: 'ES256', publicJwk: '{"kty":"EC"}', status: 'active', createdAt: '2026-05-01', rotatedAt: null },
    ]);
    const r = await api('GET', '/internal/signing-keys', env, { secret: SECRET });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: Array<Record<string, unknown>> };
    expect(j.data[0]!.kid).toBe('k1');
    expect(j.data[0]!.publicJwk).toBeUndefined(); // intentionally not echoed
  });
});

describe('PATCH /internal/signing-keys/:kid', () => {
  it('403 without secret', async () => {
    const r = await api('PATCH', '/internal/signing-keys/k1', env, { body: { status: 'retiring' } });
    expect(r.status).toBe(403);
  });

  it('400 when status is not one of active/retiring/revoked', async () => {
    const r = await api('PATCH', '/internal/signing-keys/k1', env, { body: { status: 'compromised' }, secret: SECRET });
    expect(r.status).toBe(400);
  });

  it('404 kid_not_found when no row matches', async () => {
    db._setSelectResult([]);
    const r = await api('PATCH', '/internal/signing-keys/missing', env, { body: { status: 'retiring' }, secret: SECRET });
    expect(r.status).toBe(404);
  });

  it('200 on happy path; persists rotatedAt timestamp', async () => {
    db._setSelectResult([{ id: 'sk_1', kid: 'k1', alg: 'ES256', publicJwk: '{}', status: 'active' }]);
    const r = await api('PATCH', '/internal/signing-keys/k1', env, { body: { status: 'retiring' }, secret: SECRET });
    expect(r.status).toBe(200);
    expect(db.update).toHaveBeenCalled();
  });
});
