import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { signCompactJws } from './jws-sign.js';
import { verifyCompactJws } from './jws-verify.js';

const subtle = (webcrypto as unknown as Crypto).subtle;

async function pair() {
  const kp = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'],
  );
  const pubJwk = await subtle.exportKey('jwk', kp.publicKey);
  return { privateKey: kp.privateKey, publicKey: JSON.stringify(pubJwk) };
}

describe('signCompactJws', () => {
  it('produces a JWS that verifyCompactJws accepts', async () => {
    const { privateKey, publicKey } = await pair();
    const now = Math.floor(Date.now() / 1000);
    const jws = await signCompactJws(privateKey, {
      sub: 'sess-A', iat: now, exp: now + 60, nonce: 'n-1',
    });
    expect(jws.split('.')).toHaveLength(3);
    const r = await verifyCompactJws(jws, { publicKey });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.claims.sub).toBe('sess-A');
      expect(r.claims.nonce).toBe('n-1');
    }
  });

  it('preserves arbitrary claim fields', async () => {
    const { privateKey, publicKey } = await pair();
    const now = Math.floor(Date.now() / 1000);
    const jws = await signCompactJws(privateKey, {
      sub: 's', iat: now, exp: now + 60, nonce: 'n', action: 'wire_transfer',
    });
    const r = await verifyCompactJws(jws, { publicKey });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.claims.action).toBe('wire_transfer');
  });

  it('emits a kid header when supplied', async () => {
    const { privateKey } = await pair();
    const now = Math.floor(Date.now() / 1000);
    const jws = await signCompactJws(
      privateKey,
      { sub: 's', iat: now, exp: now + 60, nonce: 'n' },
      { kid: 'k-1' },
    );
    const headerB64 = jws.split('.')[0]!;
    const header = JSON.parse(Buffer.from(headerB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    expect(header.kid).toBe('k-1');
    expect(header.alg).toBe('ES256');
  });
});
