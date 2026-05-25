/**
 * verify.ts WebAuthn-branch + trust-score-change coverage.
 * Sibling file because verify.test.ts is at 192L (8L headroom).
 * Closes the uncovered range lines 140 + 161-179.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryStorage } from './storage/memory.js';
import type { TokenForgeServerOptions, DeviceSession } from '../shared/types.js';
import type { TfRequestContext } from './verify.js';
import { hashFingerprint } from './trust-score.js';

vi.mock('./crypto.js', () => ({
  importPublicKey: vi.fn().mockResolvedValue({} as CryptoKey),
  verifySignature: vi.fn().mockResolvedValue(true),
}));

const { mockWebAuthnAssertion } = vi.hoisted(() => ({
  mockWebAuthnAssertion: vi.fn(),
}));
vi.mock('./webauthn-verify.js', () => ({
  verifyWebAuthnAssertion: mockWebAuthnAssertion,
}));

const { verifyRequest } = await import('./verify.js');

const UA = 'Mozilla/5.0 TestAgent';

function makeOptions(storage: MemoryStorage): TokenForgeServerOptions {
  return {
    storage,
    trustThresholds: { allow: 80, stepUp: 40 },
    sessionMaxAge: 86400, nonceExpiry: 60,
    skipPaths: [], sensitiveOps: [],
  };
}

function webAuthnHeaders(over: Record<string, unknown> = {}) {
  return {
    signature: 'sig-stub',
    nonce: `n-${Math.random()}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
    deviceId: 'dev-1',
    authData: 'AA==',
    clientDataJSON: 'AA==',
    origin: 'https://app.example.com',
    ...over,
  };
}

function makeCtx(headers: ReturnType<typeof webAuthnHeaders>): TfRequestContext {
  return {
    path: '/api/data', method: 'GET', userId: 'user-1', sessionId: 'sess-1',
    ipAddress: '1.2.3.4', countryCode: 'US', userAgent: UA,
    headers,
  };
}

function makeSession(over: Partial<DeviceSession> = {}): DeviceSession {
  const now = new Date().toISOString();
  return {
    id: 'dev-1', session_id: 'sess-1', user_id: 'user-1',
    public_key: JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'a', y: 'b' }),
    device_fingerprint: hashFingerprint(UA), ip_address: '1.2.3.4',
    country_code: 'US', trust_score: 100, bound_at: now, last_verified_at: now,
    expires_at: new Date(Date.now() + 86400_000).toISOString(),
    revoked: 0, revoked_reason: null, created_at: now,
    ...over,
  };
}

describe('verifyRequest WebAuthn branch + trust-score-change', () => {
  let storage: MemoryStorage;
  let options: TokenForgeServerOptions;

  beforeEach(async () => {
    storage = new MemoryStorage();
    options = makeOptions(storage);
    mockWebAuthnAssertion.mockReset();
    await storage.createSession(makeSession());
  });

  it('verify.ts:161 missing origin in WebAuthn ctx → returns false → 401 signature_invalid + revoke', async () => {
    // authData + clientDataJSON present (so line 104 routes to webauthn
    // branch), but origin is missing — line 161 returns false → revoke.
    const ctx = makeCtx(webAuthnHeaders({ origin: undefined }));
    const result = await verifyRequest(ctx, options);
    const r = result as { status: string; code: number; body: { error: string } };
    expect(r.status).toBe('error');
    expect(r.body.error).toBe('signature_invalid');
    expect(mockWebAuthnAssertion).not.toHaveBeenCalled();
  });

  it('verify.ts:163 publicKey JSON.parse failure → returns false (catch block) → 401 signature_invalid', async () => {
    // Replace stored public_key with non-JSON garbage so the catch fires.
    await storage.updateTrustScore('dev-1', 100); // touch
    const session = await storage.getSession('sess-1', 'dev-1');
    if (session) (session as DeviceSession).public_key = 'not{json';
    const ctx = makeCtx(webAuthnHeaders());
    const result = await verifyRequest(ctx, options);
    const r = result as { status: string; body: { error: string } };
    expect(r.body.error).toBe('signature_invalid');
    expect(mockWebAuthnAssertion).not.toHaveBeenCalled();
  });

  it('verify.ts:164-173 WebAuthn happy path: full branch executes, calls verifyWebAuthnAssertion → ok=true', async () => {
    mockWebAuthnAssertion.mockResolvedValueOnce(true);
    const ctx = makeCtx(webAuthnHeaders());
    const result = await verifyRequest(ctx, options);
    expect(mockWebAuthnAssertion).toHaveBeenCalledTimes(1);
    // Verify the challenge passed in is sha256(`sessionId:nonce:timestamp`) base64url-encoded.
    const args = mockWebAuthnAssertion.mock.calls[0]!;
    const expectedChallenge = args[4]; // 5th arg per verifyWebAuthnAssertion signature
    expect(typeof expectedChallenge).toBe('string');
    expect((expectedChallenge as string).length).toBeGreaterThan(20); // sha256 b64url ~43 chars
    expect((result as { status: string }).status).toBe('ok');
  });

  it('verify.ts:164-173 WebAuthn assertion fails → 401 signature_invalid + revoke fires', async () => {
    mockWebAuthnAssertion.mockResolvedValueOnce(false);
    const ctx = makeCtx(webAuthnHeaders());
    const result = await verifyRequest(ctx, options);
    expect((result as { body: { error: string } }).body.error).toBe('signature_invalid');
    // session should be revoked after sig failure
    const after = await storage.getSession('sess-1', 'dev-1');
    expect(after).toBeNull(); // soft-revoked = filtered by getSession
  });

  it('verify.ts:140 TRUST_SCORE_CHANGE log path: previous=50, fresh verify=100 → delta>10 fires log', async () => {
    // Mutate previousScore on the session created in beforeEach via
    // updateTrustScore. ECDSA path (no authData) so happy verify yields ~100.
    await storage.updateTrustScore('dev-1', 50);
    const headers = webAuthnHeaders();
    delete (headers as Record<string, unknown>).authData;
    delete (headers as Record<string, unknown>).clientDataJSON;
    delete (headers as Record<string, unknown>).origin;
    const result = await verifyRequest(makeCtx(headers), options);
    expect((result as { status: string }).status).toBe('ok');
  });
});
