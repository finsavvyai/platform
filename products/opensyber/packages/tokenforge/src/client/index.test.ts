/**
 * TokenForge client SDK index — class-level tests for the signAction
 * method (Sprint 39 action-signing surface).
 *
 * binding/init flow is covered by binding.test.ts + interceptor.test.ts;
 * here we focus on the public method delegation, error paths, and the
 * round-trip through `verifyCompactJws` so the JWS the SDK emits is
 * actually accepted by the server-side verifier.
 */

import { describe, it, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';

vi.mock('./storage.js', () => ({
  storeDeviceKey: vi.fn(async () => undefined),
  getDeviceKey: vi.fn(async () => null),
  clearDeviceKeys: vi.fn(async () => undefined),
}));

import { TokenForge, createTokenForge } from './index.js';
import { verifyCompactJws } from '../server/jws-verify.js';
import type { TokenForgeConfig } from '../shared/types.js';

const subtle = (webcrypto as unknown as Crypto).subtle;

async function genKeyPair(): Promise<{ keyPair: CryptoKeyPair; publicJwk: string }> {
  const pair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = await subtle.exportKey('jwk', pair.publicKey);
  return { keyPair: pair, publicJwk: JSON.stringify(jwk) };
}

function baseConfig(getSessionId: () => string | null = () => 'sess-1'): TokenForgeConfig {
  return {
    apiBase: 'http://localhost:9999',
    getSessionId,
  };
}

function makeBound(tf: TokenForge, kp: CryptoKeyPair, deviceId = 'dev-1'): void {
  type Mut = {
    keyPair: CryptoKeyPair | null;
    deviceId: string | null;
    bound: boolean;
  };
  const mut = tf as unknown as Mut;
  mut.keyPair = kp;
  mut.deviceId = deviceId;
  mut.bound = true;
}

describe('createTokenForge factory', () => {
  it('returns a TokenForge instance', () => {
    const tf = createTokenForge(baseConfig());
    expect(tf).toBeInstanceOf(TokenForge);
  });
});

describe('TokenForge.signAction', () => {
  it('throws when the device is not yet bound', async () => {
    const tf = new TokenForge(baseConfig());
    await expect(tf.signAction({ action: 'checkout' })).rejects.toThrow(
      'TokenForge.signAction: device not bound — call init() first',
    );
  });

  it('throws when getSessionId() returns null even if bound', async () => {
    const { keyPair } = await genKeyPair();
    const tf = new TokenForge(baseConfig(() => null));
    makeBound(tf, keyPair);
    await expect(tf.signAction({ action: 'checkout' })).rejects.toThrow(
      'TokenForge.signAction: no sessionId from getSessionId()',
    );
  });

  it('returns a compact JWS with three dot-separated parts', async () => {
    const { keyPair } = await genKeyPair();
    const tf = new TokenForge(baseConfig());
    makeBound(tf, keyPair);
    const { jws, actionHash, nonce } = await tf.signAction({
      action: 'checkout',
      amount: 1499,
    });
    expect(jws.split('.')).toHaveLength(3);
    expect(actionHash).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(nonce.length).toBeGreaterThan(0);
  });

  it('JWS round-trips through verifyCompactJws against the bound public key', async () => {
    const { keyPair, publicJwk } = await genKeyPair();
    const tf = new TokenForge(baseConfig(() => 'tf-dbsc-session-A'));
    makeBound(tf, keyPair);
    const { jws } = await tf.signAction({ action: 'admin_grant', target: 'u_99' });
    const result = await verifyCompactJws(jws, { publicKey: publicJwk });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.sub).toBe('tf-dbsc-session-A');
      expect(result.claims.action).toBe('admin_grant');
    }
  });

  it('threads ttlSeconds option down to the underlying signer', async () => {
    const { keyPair, publicJwk } = await genKeyPair();
    const tf = new TokenForge(baseConfig());
    makeBound(tf, keyPair);
    const before = Math.floor(Date.now() / 1000);
    const { jws } = await tf.signAction(
      { action: 'checkout' },
      { ttlSeconds: 5 },
    );
    const result = await verifyCompactJws(jws, { publicKey: publicJwk });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const exp = result.claims.exp as number;
      const iat = result.claims.iat as number;
      expect(exp - iat).toBe(5);
      expect(iat).toBeGreaterThanOrEqual(before);
    }
  });

  it('does not silently fall back when not bound (regression guard)', async () => {
    const tf = new TokenForge(baseConfig());
    const spy = vi.fn();
    try {
      await tf.signAction({ action: 'checkout' });
      spy('reached-impossible-path');
    } catch (err) {
      expect((err as Error).message).toContain('device not bound');
    }
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('TokenForge.getDeviceId / isBound', () => {
  it('returns null + false before init / makeBound', () => {
    const tf = new TokenForge(baseConfig());
    expect(tf.getDeviceId()).toBeNull();
    expect(tf.isBound()).toBe(false);
  });

  it('returns the deviceId + true after binding', async () => {
    const { keyPair } = await genKeyPair();
    const tf = new TokenForge(baseConfig());
    makeBound(tf, keyPair, 'dev-99');
    expect(tf.getDeviceId()).toBe('dev-99');
    expect(tf.isBound()).toBe(true);
  });
});

describe('TokenForge.clearKeys', () => {
  it('resets bound state (deviceId=null, isBound=false)', async () => {
    const { keyPair } = await genKeyPair();
    const tf = new TokenForge(baseConfig());
    makeBound(tf, keyPair);
    await tf.clearKeys();
    expect(tf.getDeviceId()).toBeNull();
    expect(tf.isBound()).toBe(false);
  });
});

describe('TokenForge.signRequest', () => {
  it('returns the request unchanged when not bound (no key + no headers)', async () => {
    const tf = new TokenForge(baseConfig());
    const req = new Request('https://api.example/x');
    const out = await tf.signRequest(req);
    expect(out.headers.get('X-TF-Signature')).toBeNull();
    expect(out.headers.get('X-TF-Device-ID')).toBeNull();
  });

  it('returns the request unchanged when getSessionId() returns null even if bound', async () => {
    const { keyPair } = await genKeyPair();
    const tf = new TokenForge(baseConfig(() => null));
    makeBound(tf, keyPair);
    const req = new Request('https://api.example/x');
    const out = await tf.signRequest(req);
    expect(out.headers.get('X-TF-Signature')).toBeNull();
  });

  it('attaches X-TF-Signature/Nonce/Timestamp/Device-ID on happy path', async () => {
    const { keyPair } = await genKeyPair();
    const tf = new TokenForge(baseConfig());
    makeBound(tf, keyPair, 'dev-42');
    const req = new Request('https://api.example/x');
    const out = await tf.signRequest(req);
    expect(out.headers.get('X-TF-Signature')).toBeTruthy();
    expect(out.headers.get('X-TF-Nonce')).toBeTruthy();
    expect(out.headers.get('X-TF-Timestamp')).toMatch(/^\d+$/);
    expect(out.headers.get('X-TF-Device-ID')).toBe('dev-42');
  });
});
