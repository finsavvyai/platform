import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));

vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

import worker from '../index.js';

async function workerRequest(path: string, env: Env): Promise<Response> {
  const url = `http://localhost${path}`;
  const req = new Request(url, { method: 'GET' });
  return worker.fetch(
    req,
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

describe('well-known TokenForge endpoints', () => {
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = mockDb;
  });

  it('serves an empty JWKS when the signing-keys store has no rows', async () => {
    const res = await workerRequest('/.well-known/tokenforge/jwks', mockEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ keys: [] });
  });

  it('serves the public JWK set when active/retiring keys exist', async () => {
    mockDb._setSelectResult([
      {
        kid: 'kid-active-1',
        alg: 'ES256',
        publicJwk: JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'X', y: 'Y' }),
        status: 'active',
      },
      {
        kid: 'kid-retiring-1',
        alg: 'ES256',
        publicJwk: JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'A', y: 'B' }),
        status: 'retiring',
      },
    ]);
    const res = await workerRequest('/.well-known/tokenforge/jwks', mockEnv);
    const body = (await res.json()) as { keys: Array<{ kid: string; alg: string; kty: string }> };
    expect(body.keys).toHaveLength(2);
    expect(body.keys.map((k) => k.kid)).toEqual(['kid-active-1', 'kid-retiring-1']);
    expect(body.keys[0]!.alg).toBe('ES256');
    expect(body.keys[0]!.kty).toBe('EC');
  });

  it('serves the DBSC service descriptor with current endpoints', async () => {
    const res = await workerRequest('/.well-known/tokenforge/dbsc', mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.issuer).toBe('https://tokenforge.opensyber.cloud');
    expect(body.challenge_endpoint).toBe('/v1/dbsc/challenge');
    expect(body.register_endpoint).toBe('/v1/dbsc/register');
    expect(body.refresh_endpoint).toBe('/v1/dbsc/refresh');
    expect(body.cookie_name).toBe('__Secure-tf-bound');
    expect(body.supported_algs).toEqual(['ES256']);
  });

  it('JWKS sets Cache-Control public max-age=300 s-maxage=300 (5min edge cache)', async () => {
    const res = await workerRequest('/.well-known/tokenforge/jwks', mockEnv);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300, s-maxage=300');
  });

  it('DBSC descriptor sets the same 5-minute Cache-Control header', async () => {
    const res = await workerRequest('/.well-known/tokenforge/dbsc', mockEnv);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300, s-maxage=300');
  });

  it('DBSC descriptor exposes revoke_endpoint with id placeholder and W3C spec link', async () => {
    const res = await workerRequest('/.well-known/tokenforge/dbsc', mockEnv);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.revoke_endpoint).toBe('/v1/dbsc/sessions/{id}/revoke');
    expect(body.spec).toBe('https://w3c.github.io/webappsec-dbsc/');
  });

  it('JWKS body shape stays {keys:[...]} (RFC 7517 §5) when keys exist', async () => {
    mockDb._setSelectResult([
      { kid: 'k1', alg: 'ES256', publicJwk: JSON.stringify({ kty: 'EC', crv: 'P-256' }), status: 'active' },
    ]);
    const res = await workerRequest('/.well-known/tokenforge/jwks', mockEnv);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['keys']);
    expect(Array.isArray(body.keys)).toBe(true);
  });
});
