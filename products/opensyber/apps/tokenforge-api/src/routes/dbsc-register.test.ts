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
    c.set('tenantId', 't1');
    c.set('tenantPlan', 'pro');
    await next();
  },
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

const { mockConsumeChallenge, mockVerifyJws, mockIssueCookie } = vi.hoisted(() => ({
  mockConsumeChallenge: vi.fn(),
  mockVerifyJws: vi.fn(),
  mockIssueCookie: vi.fn(),
}));
vi.mock('@opensyber/tokenforge/server/internal', async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return {
    ...actual,
    consumeChallenge: mockConsumeChallenge,
    verifyCompactJws: mockVerifyJws,
    issueBoundCookie: mockIssueCookie,
    setBoundCookieHeader: () => '__Secure-tf-bound=cookie-stub; Path=/; Secure; HttpOnly',
  };
});

import worker from '../index.js';

async function postRegister(body: unknown, env: Env): Promise<Response> {
  return worker.fetch(
    new Request('http://localhost/v1/dbsc/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer tf_test', origin: 'https://app.test' },
      body: JSON.stringify(body),
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

const validBody = (over: Record<string, unknown> = {}) => ({
  alg: 'ES256',
  publicKey: 'jwk-stub',
  challenge: 'challenge-12345678',
  challengeResponse: 'eyJhbGciOiJFUzI1NiJ9.payload.signature',
  ...over,
});

describe('POST /v1/dbsc/register', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockConsumeChallenge.mockResolvedValue({ ok: true });
    mockVerifyJws.mockResolvedValue({
      ok: true,
      claims: { nonce: 'challenge-12345678', sub: 'dev_42' },
    });
    mockIssueCookie.mockResolvedValue({
      hash: 'cookie-hash',
      issuedAt: '2026-05-03T00:00:00.000Z',
      expiresAt: '2026-05-03T00:05:00.000Z',
      maxAgeSeconds: 300,
    });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns 400 invalid_payload when publicKey missing', async () => {
    const r = await postRegister({ alg: 'ES256', challenge: 'challenge-12345678', challengeResponse: 'eyJhbGc.x.y' }, env);
    expect(r.status).toBe(400);
    const j = (await r.json()) as { error: string };
    expect(j.error).toBe('invalid_payload');
  });

  it('returns 400 with reason when challenge consume fails (already consumed)', async () => {
    mockConsumeChallenge.mockResolvedValueOnce({ ok: false, reason: 'already_consumed' });
    const r = await postRegister(validBody(), env);
    expect(r.status).toBe(400);
    const j = (await r.json()) as { error: string };
    expect(j.error).toBe('already_consumed');
  });

  it('returns 401 with verifyJws reason when challengeResponse signature is bad', async () => {
    mockVerifyJws.mockResolvedValueOnce({ ok: false, reason: 'jws_bad_signature' });
    const r = await postRegister(validBody(), env);
    expect(r.status).toBe(401);
    const j = (await r.json()) as { error: string };
    expect(j.error).toBe('jws_bad_signature');
  });

  it('returns 401 challenge_response_mismatch when JWS nonce does not match challenge', async () => {
    mockVerifyJws.mockResolvedValueOnce({
      ok: true,
      claims: { nonce: 'other-nonce', sub: 'dev_42' },
    });
    const r = await postRegister(validBody(), env);
    expect(r.status).toBe(401);
    const j = (await r.json()) as { error: string };
    expect(j.error).toBe('challenge_response_mismatch');
  });

  it('returns 201 with sessionId+deviceId+refreshUrl on happy path', async () => {
    const r = await postRegister(validBody(), env);
    expect(r.status).toBe(201);
    const j = (await r.json()) as { data: { sessionId: string; deviceId: string; refreshUrl: string; maxAgeSeconds: number } };
    expect(j.data.sessionId).toMatch(/^tf-dbsc-/);
    expect(j.data.deviceId).toBe('dev_42');
    expect(j.data.refreshUrl).toBe('/v1/dbsc/refresh');
    expect(j.data.maxAgeSeconds).toBe(300);
    expect(r.headers.get('Set-Cookie')).toContain('__Secure-tf-bound=cookie-stub');
    expect(r.headers.get('Sec-Session-Id')).toBe(j.data.sessionId);
    expect(r.headers.get('Sec-TF-Channel-Bound')).toBe('0');
    expect(db.insert).toHaveBeenCalled();
  });

  it('captures geo/asn/ua baseline into the attestation field', async () => {
    let captured: Record<string, unknown> | undefined;
    db.insert = vi.fn(() => ({
      values: vi.fn(async (v: Record<string, unknown>) => { captured = v; }),
    }));
    await worker.fetch(
      new Request('http://localhost/v1/dbsc/register', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer tf_test',
          'cf-ipcountry': 'IL',
          'cf-asn': '12345',
          'user-agent': 'Mozilla/5.0 TestAgent',
        },
        body: JSON.stringify(validBody()),
      }),
      env,
      { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
    );
    expect(captured).toBeDefined();
    const baseline = JSON.parse(captured!.attestation as string) as Record<string, unknown>;
    expect(baseline.country).toBe('IL');
    expect(baseline.asn).toBe('12345');
    expect(baseline.ua).toContain('TestAgent');
  });

  it('normalizes origin: lowercases + strips trailing slash', async () => {
    let captured: Record<string, unknown> | undefined;
    db.insert = vi.fn(() => ({ values: vi.fn(async (v: Record<string, unknown>) => { captured = v; }) }));
    await postRegister({ ...validBody(), origin: 'HTTPS://Acme.Example.com/' }, env);
    expect(captured!.origin).toBe('https://acme.example.com');
  });

  it('falls back to request Origin header when body.origin is omitted', async () => {
    let captured: Record<string, unknown> | undefined;
    db.insert = vi.fn(() => ({ values: vi.fn(async (v: Record<string, unknown>) => { captured = v; }) }));
    const { origin: _, ...withoutOrigin } = validBody();
    void _;
    await worker.fetch(
      new Request('http://localhost/v1/dbsc/register', {
        method: 'POST',
        headers: {
          'content-type': 'application/json', authorization: 'Bearer tf_test',
          origin: 'https://app.example.com/',
        },
        body: JSON.stringify(withoutOrigin),
      }),
      env,
      { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
    );
    expect(captured!.origin).toBe('https://app.example.com');
  });
});
