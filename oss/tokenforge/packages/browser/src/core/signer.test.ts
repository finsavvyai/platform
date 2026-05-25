import { describe, it, expect } from 'vitest';
import { signDpop } from './signer.js';
import { verifyCompactJws } from '@tokenforge/protocol';

async function setup() {
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { privateKey: pair.privateKey, publicJwk: jwk as JsonWebKey };
}

describe('signDpop', () => {
  it('produces a JWS the server verifyCompactJws accepts', async () => {
    const { privateKey, publicJwk } = await setup();
    const jws = await signDpop(privateKey, { sub: 'tf_sess_1', nonce: 'n1' });
    const r = await verifyCompactJws(jws, { publicKey: JSON.stringify(publicJwk) });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.claims.sub).toBe('tf_sess_1');
  });

  it('preserves arbitrary extra claims', async () => {
    const { privateKey, publicJwk } = await setup();
    const jws = await signDpop(privateKey, {
      sub: 's', nonce: 'n', htm: 'POST', htu: 'https://api.test/v1/sessions/refresh',
    });
    const r = await verifyCompactJws(jws, { publicKey: JSON.stringify(publicJwk) });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.claims as unknown as Record<string, unknown>).htm).toBe('POST');
  });

  it('uses caller-supplied iat/exp when provided', async () => {
    const { privateKey, publicJwk } = await setup();
    const past = Math.floor(Date.now() / 1000) - 10;
    const jws = await signDpop(privateKey, {
      sub: 's', nonce: 'n', iat: past, exp: past + 30,
    });
    const r = await verifyCompactJws(jws, { publicKey: JSON.stringify(publicJwk) });
    expect(r.ok).toBe(true);
  });
});
