import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { signAction } from './action-signer.js';
import { verifyCompactJws } from '../server/jws-verify.js';

const subtle = (webcrypto as unknown as Crypto).subtle;

async function genKeyPair(): Promise<{ privateKey: CryptoKey; publicJwk: string }> {
  const pair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = await subtle.exportKey('jwk', pair.publicKey);
  return { privateKey: pair.privateKey, publicJwk: JSON.stringify(jwk) };
}

describe('signAction', () => {
  it('throws when payload.action is missing', async () => {
    const { privateKey } = await genKeyPair();
    await expect(
      signAction({} as { action: string }, { privateKey, sessionId: 's1' }),
    ).rejects.toThrow('signAction: payload.action is required');
  });

  it('produces a compact JWS with three dot-separated parts', async () => {
    const { privateKey } = await genKeyPair();
    const { jws } = await signAction(
      { action: 'checkout', amount: 1499 },
      { privateKey, sessionId: 's1' },
    );
    expect(jws.split('.')).toHaveLength(3);
  });

  it('returned JWS round-trips through verifyCompactJws against the bound public key', async () => {
    const { privateKey, publicJwk } = await genKeyPair();
    const { jws, actionHash, nonce } = await signAction(
      { action: 'checkout', amount: 1499 },
      { privateKey, sessionId: 'tf-dbsc-session-1' },
    );
    const result = await verifyCompactJws(jws, { publicKey: publicJwk });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.sub).toBe('tf-dbsc-session-1');
      expect(result.claims.action).toBe('checkout');
      expect(result.claims.actionHash).toBe(actionHash);
      expect(result.claims.nonce).toBe(nonce);
    }
  });

  it('embeds kid in the protected header when provided', async () => {
    const { privateKey, publicJwk } = await genKeyPair();
    const { jws } = await signAction(
      { action: 'admin_grant' },
      { privateKey, sessionId: 's1', kid: 'kid-active-1' },
    );
    const result = await verifyCompactJws(jws, { publicKey: publicJwk });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.protectedHeader.kid).toBe('kid-active-1');
    }
  });

  it('verifyCompactJws rejects when iat is past maxAgeSeconds (replay attempt)', async () => {
    const { privateKey, publicJwk } = await genKeyPair();
    // Sign in the past (iat = now - 10 min)
    const past = new Date(Date.now() - 10 * 60_000);
    const { jws } = await signAction(
      { action: 'checkout' },
      { privateKey, sessionId: 's1', now: () => past, ttlSeconds: 600 },
    );
    // verify with default maxAgeSeconds = 60
    const result = await verifyCompactJws(jws, { publicKey: publicJwk });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('jws_too_old');
  });

  it('actionHash is deterministic for the same payload regardless of key order', async () => {
    const { privateKey } = await genKeyPair();
    const a = await signAction(
      { action: 'checkout', amount: 99, recipient: 'X' },
      { privateKey, sessionId: 's1', now: () => new Date(0), nonce: 'n1' },
    );
    const b = await signAction(
      { recipient: 'X', action: 'checkout', amount: 99 },
      { privateKey, sessionId: 's1', now: () => new Date(0), nonce: 'n1' },
    );
    expect(a.actionHash).toBe(b.actionHash);
  });

  it('actionHash differs when payload values change', async () => {
    const { privateKey } = await genKeyPair();
    const a = await signAction(
      { action: 'checkout', amount: 99 },
      { privateKey, sessionId: 's1', now: () => new Date(0), nonce: 'n1' },
    );
    const b = await signAction(
      { action: 'checkout', amount: 100 },
      { privateKey, sessionId: 's1', now: () => new Date(0), nonce: 'n1' },
    );
    expect(a.actionHash).not.toBe(b.actionHash);
  });

  it('a tampered JWS body fails signature verification', async () => {
    const { privateKey, publicJwk } = await genKeyPair();
    const { jws } = await signAction(
      { action: 'checkout', amount: 99 },
      { privateKey, sessionId: 's1' },
    );
    const [h, _origPayload, sig] = jws.split('.');
    // Replace payload with one claiming amount: 9999
    const tamperedClaims = {
      sub: 's1',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60,
      nonce: 'n-replay',
      action: 'checkout',
      actionHash: 'fake-hash',
    };
    const enc = new TextEncoder();
    const tamperedB64 = btoa(String.fromCharCode(...enc.encode(JSON.stringify(tamperedClaims))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const result = await verifyCompactJws(`${h}.${tamperedB64}.${sig}`, { publicKey: publicJwk });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('jws_bad_signature');
  });
});
