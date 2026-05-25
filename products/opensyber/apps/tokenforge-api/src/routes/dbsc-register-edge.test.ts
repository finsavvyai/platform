/**
 * Edge-case coverage for POST /v1/dbsc/register.
 * Sibling of dbsc-register.test.ts (192L, near cap) — pins schema
 * validation boundaries, anonymous deviceId fallback, baseline-null
 * propagation, and webauthn attestation passthrough.
 */

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
  tenantAuth: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('tenantId', 't1'); c.set('tenantPlan', 'pro'); await next();
  },
}));
vi.mock('../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/guard.js', () => ({ guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));

const { mockConsume, mockVerifyJws, mockIssueCookie } = vi.hoisted(() => ({
  mockConsume: vi.fn(), mockVerifyJws: vi.fn(), mockIssueCookie: vi.fn(),
}));
vi.mock('@opensyber/tokenforge/server/internal', async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return {
    ...actual,
    consumeChallenge: mockConsume,
    verifyCompactJws: mockVerifyJws,
    issueBoundCookie: mockIssueCookie,
    setBoundCookieHeader: () => '__Secure-tf-bound=stub',
  };
});

import worker from '../index.js';

const validBody = (over: Record<string, unknown> = {}) => ({
  alg: 'ES256', publicKey: 'jwk-stub', challenge: 'challenge-12345678',
  challengeResponse: 'eyJhbGciOiJFUzI1NiJ9.payload.signature', ...over,
});

async function post(body: unknown, env: Env, extra: Record<string, string> = {}): Promise<Response> {
  return worker.fetch(
    new Request('http://localhost/v1/dbsc/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer tf_test', ...extra },
      body: JSON.stringify(body),
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

describe('POST /v1/dbsc/register — edge cases', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;
  let captured: Record<string, unknown> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
    captured = undefined;
    db.insert = vi.fn(() => ({ values: vi.fn(async (v: Record<string, unknown>) => { captured = v; }) }));
    mockConsume.mockResolvedValue({ ok: true });
    mockVerifyJws.mockResolvedValue({ ok: true, claims: { nonce: 'challenge-12345678', sub: 'dev_42' } });
    mockIssueCookie.mockResolvedValue({ hash: 'h', issuedAt: 'now', expiresAt: 'later', maxAgeSeconds: 300 });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('rejects alg!=ES256 with 400 invalid_payload (zod literal guard)', async () => {
    const r = await post(validBody({ alg: 'RS256' }), env);
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('invalid_payload');
  });

  it('rejects challenge shorter than 8 chars with 400 invalid_payload', async () => {
    const r = await post(validBody({ challenge: 'short' }), env);
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('invalid_payload');
  });

  it('rejects challengeResponse shorter than 20 chars with 400 invalid_payload', async () => {
    const r = await post(validBody({ challengeResponse: 'too-short' }), env);
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('invalid_payload');
  });

  it('deviceId falls back to UUID-hex when JWS sub claim is missing/empty', async () => {
    mockVerifyJws.mockResolvedValueOnce({ ok: true, claims: { nonce: 'challenge-12345678' } });
    const r = await post(validBody(), env);
    expect(r.status).toBe(201);
    const data = ((await r.json()) as { data: { deviceId: string } }).data;
    // 32 hex chars (UUID with dashes stripped via .replace(/-/g, ''))
    expect(data.deviceId).toMatch(/^[0-9a-f]{32}$/);
    expect(captured!.deviceId).toBe(data.deviceId);
  });

  it('captures null baseline values when cf-ipcountry / cf-asn / user-agent headers absent', async () => {
    await post(validBody(), env);
    const baseline = JSON.parse(captured!.attestation as string) as Record<string, unknown>;
    // No cf-* or UA in our default headers → ?? null kicks in
    expect(baseline.country).toBeNull();
    expect(baseline.asn).toBeNull();
    // user-agent header is set by Workers fetch; assert NULL OR string (per environment)
    expect(baseline.ua === null || typeof baseline.ua === 'string').toBe(true);
  });

  it('passes body.attestation field through to baseline.webauthn (json-encoded)', async () => {
    await post(validBody({ attestation: 'webauthn-attestation-blob-base64url' }), env);
    const baseline = JSON.parse(captured!.attestation as string) as Record<string, unknown>;
    expect(baseline.webauthn).toBe('webauthn-attestation-blob-base64url');
  });

  it('baseline.webauthn defaults to null when body.attestation omitted', async () => {
    await post(validBody(), env);
    const baseline = JSON.parse(captured!.attestation as string) as Record<string, unknown>;
    expect(baseline.webauthn).toBeNull();
  });
});
