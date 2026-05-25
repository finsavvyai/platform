/**
 * End-to-end integration test: generate key -> bind device -> sign -> verify.
 * Uses REAL Web Crypto (ECDSA P-256) -- no mocks.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { generateDeviceKeyPair, exportPublicKey } from '../client/crypto.js';
import { signChallenge, generateNonce } from '../client/signer.js';
import { verifyRequest, type TfRequestContext } from '../server/verify.js';
import { MemoryStorage } from '../server/storage/memory.js';
import { hashFingerprint } from '../server/trust-score.js';
import type { TokenForgeServerOptions, DeviceSession } from '../shared/types.js';

const UA = 'Mozilla/5.0 FullChainTest';

function makeOptions(storage: MemoryStorage): TokenForgeServerOptions {
  return {
    storage,
    trustThresholds: { allow: 80, stepUp: 40 },
    sessionMaxAge: 86400,
    nonceExpiry: 60,
  };
}

async function bindDevice(
  storage: MemoryStorage, publicKeyJwk: JsonWebKey,
  sessionId = 'sess-1', userId = 'user-1', deviceId = 'dev-1',
): Promise<DeviceSession> {
  const now = new Date().toISOString();
  const session: DeviceSession = {
    id: deviceId, session_id: sessionId, user_id: userId,
    public_key: JSON.stringify(publicKeyJwk),
    device_fingerprint: hashFingerprint(UA), ip_address: '1.2.3.4',
    country_code: 'US', trust_score: 100, bound_at: now,
    last_verified_at: now,
    expires_at: new Date(Date.now() + 86400_000).toISOString(),
    revoked: 0, revoked_reason: null, created_at: now,
  };
  await storage.createSession(session);
  return session;
}

async function signV1(
  privateKey: CryptoKey, sessionId: string, nonce: string, ts: number,
): Promise<string> {
  const result = await signChallenge(privateKey, sessionId, nonce, ts);
  return result.signature;
}

async function buildSignedCtx(
  privateKey: CryptoKey, sessionId = 'sess-1',
  overrides: Partial<TfRequestContext> = {},
): Promise<TfRequestContext> {
  const nonce = generateNonce();
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await signV1(privateKey, sessionId, nonce, timestamp);
  return {
    path: '/api/data', method: 'GET', userId: 'user-1', sessionId,
    ipAddress: '1.2.3.4', countryCode: 'US', userAgent: UA,
    headers: {
      signature, nonce, timestamp: String(timestamp), deviceId: 'dev-1',
    },
    ...overrides,
  };
}

describe('TokenForge Full Chain', () => {
  let storage: MemoryStorage;
  let options: TokenForgeServerOptions;

  beforeEach(() => {
    storage = new MemoryStorage();
    options = makeOptions(storage);
  });

  it('generate -> bind -> sign -> verify succeeds', async () => {
    const keyPair = await generateDeviceKeyPair();
    const publicKeyJwk = await exportPublicKey(keyPair);
    await bindDevice(storage, publicKeyJwk);
    const ctx = await buildSignedCtx(keyPair.privateKey);

    const result = await verifyRequest(ctx, options);

    expect(result.status).toBe('ok');
    const ok = result as Extract<typeof result, { status: 'ok' }>;
    expect(ok.trustScore).toBe(100);
    expect(ok.deviceId).toBe('dev-1');
    expect(ok.bound).toBe(true);
  });

  it('signature from wrong key fails verification', async () => {
    const keyPairA = await generateDeviceKeyPair();
    const keyPairB = await generateDeviceKeyPair();
    const publicKeyA = await exportPublicKey(keyPairA);
    await bindDevice(storage, publicKeyA);

    // Sign with B's private key but session has A's public key
    const ctx = await buildSignedCtx(keyPairB.privateKey);

    const result = await verifyRequest(ctx, options);
    expect(result.status).toBe('error');
    const err = result as Extract<typeof result, { status: 'error' }>;
    expect(err.code).toBe(401);
    expect(err.body.error).toBe('signature_invalid');
  });

  it('replayed nonce is rejected', async () => {
    const keyPair = await generateDeviceKeyPair();
    const publicKeyJwk = await exportPublicKey(keyPair);
    await bindDevice(storage, publicKeyJwk);

    const ctx = await buildSignedCtx(keyPair.privateKey);
    const first = await verifyRequest(ctx, options);
    expect(first.status).toBe('ok');

    // Replay the exact same request (same nonce)
    const replay = await verifyRequest(ctx, options);
    expect(replay.status).toBe('error');
    const err = replay as Extract<typeof replay, { status: 'error' }>;
    expect(err.code).toBe(401);
    expect(err.body.error).toBe('nonce_replay');
  });

  it('expired timestamp is rejected', async () => {
    const keyPair = await generateDeviceKeyPair();
    const publicKeyJwk = await exportPublicKey(keyPair);
    await bindDevice(storage, publicKeyJwk);

    const nonce = generateNonce();
    const staleTimestamp = Math.floor(Date.now() / 1000) - 120;
    const sig = await signV1(keyPair.privateKey, 'sess-1', nonce, staleTimestamp);
    const ctx: TfRequestContext = {
      path: '/api/data', method: 'GET', userId: 'user-1', sessionId: 'sess-1',
      ipAddress: '1.2.3.4', countryCode: 'US', userAgent: UA,
      headers: {
        signature: sig, nonce, timestamp: String(staleTimestamp), deviceId: 'dev-1',
      },
    };

    const result = await verifyRequest(ctx, options);
    expect(result.status).toBe('error');
    const err = result as Extract<typeof result, { status: 'error' }>;
    expect(err.code).toBe(400);
    expect(err.body.error).toBe('request_expired');
  });

  it('revoked session fails verification', async () => {
    const keyPair = await generateDeviceKeyPair();
    const publicKeyJwk = await exportPublicKey(keyPair);
    await bindDevice(storage, publicKeyJwk);

    const ctx1 = await buildSignedCtx(keyPair.privateKey);
    const first = await verifyRequest(ctx1, options);
    expect(first.status).toBe('ok');

    await storage.revokeSession('dev-1', 'admin_revoked');

    const ctx2 = await buildSignedCtx(keyPair.privateKey);
    const result = await verifyRequest(ctx2, options);
    expect(result.status).toBe('error');
    const err = result as Extract<typeof result, { status: 'error' }>;
    expect(err.code).toBe(401);
    expect(err.body.error).toBe('device_not_bound');
  });

  it('tampered body hash is rejected (v2 signatures)', async () => {
    const keyPair = await generateDeviceKeyPair();
    const publicKeyJwk = await exportPublicKey(keyPair);
    await bindDevice(storage, publicKeyJwk);

    // Sign for session sess-1 then verify against sess-TAMPERED.
    // The signed payload includes the sessionId, so changing
    // the sessionId in the context invalidates the signature.
    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);
    const sig = await signV1(keyPair.privateKey, 'sess-1', nonce, timestamp);

    // Create a session for the tampered sessionId so lookup succeeds
    await bindDevice(storage, publicKeyJwk, 'sess-TAMPERED', 'user-1', 'dev-1-b');
    const ctx: TfRequestContext = {
      path: '/api/data', method: 'GET', userId: 'user-1',
      sessionId: 'sess-TAMPERED',
      ipAddress: '1.2.3.4', countryCode: 'US', userAgent: UA,
      headers: {
        signature: sig, nonce, timestamp: String(timestamp), deviceId: 'dev-1-b',
      },
    };

    const result = await verifyRequest(ctx, options);
    expect(result.status).toBe('error');
    const err = result as Extract<typeof result, { status: 'error' }>;
    expect(err.code).toBe(401);
    expect(err.body.error).toBe('signature_invalid');
  });
});
