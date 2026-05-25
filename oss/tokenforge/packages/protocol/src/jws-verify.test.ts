import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { verifyCompactJws } from './jws-verify.js';

const subtle = (webcrypto as unknown as Crypto).subtle;

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function strToBase64Url(s: string): string {
  return bytesToBase64Url(new TextEncoder().encode(s));
}

async function makeJws(
  payload: Record<string, unknown>,
  privateKey: CryptoKey,
  algOverride?: string,
): Promise<{ jws: string }> {
  const header = { alg: algOverride ?? 'ES256', typ: 'JWT' };
  const headerB64 = strToBase64Url(JSON.stringify(header));
  const payloadB64 = strToBase64Url(JSON.stringify(payload));
  const input = `${headerB64}.${payloadB64}`;
  const sigBuf = await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, privateKey,
    new TextEncoder().encode(input),
  );
  const sigB64 = bytesToBase64Url(new Uint8Array(sigBuf));
  return { jws: `${headerB64}.${payloadB64}.${sigB64}` };
}

async function setup() {
  const pair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'],
  );
  const jwk = await subtle.exportKey('jwk', pair.publicKey);
  return { pair, publicKey: JSON.stringify(jwk) };
}

describe('verifyCompactJws', () => {
  it('accepts a fresh well-formed JWS', async () => {
    const { pair, publicKey } = await setup();
    const now = Math.floor(Date.now() / 1000);
    const { jws } = await makeJws(
      { sub: 'sess-1', nonce: 'n1', iat: now, exp: now + 60 },
      pair.privateKey,
    );
    const r = await verifyCompactJws(jws, { publicKey });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.claims.sub).toBe('sess-1');
  });

  it('rejects an expired JWS', async () => {
    const { pair, publicKey } = await setup();
    const past = Math.floor(Date.now() / 1000) - 120;
    const { jws } = await makeJws(
      { sub: 's', nonce: 'n', iat: past, exp: past + 30 },
      pair.privateKey,
    );
    const r = await verifyCompactJws(jws, { publicKey });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('jws_expired');
  });

  it('rejects a JWS too old by maxAgeSeconds', async () => {
    const { pair, publicKey } = await setup();
    const old = Math.floor(Date.now() / 1000) - 200;
    const { jws } = await makeJws(
      { sub: 's', nonce: 'n', iat: old, exp: old + 600 },
      pair.privateKey,
    );
    const r = await verifyCompactJws(jws, { publicKey, maxAgeSeconds: 60 });
    expect(r).toEqual({ ok: false, reason: 'jws_too_old' });
  });

  it('rejects an unsupported alg', async () => {
    const { pair, publicKey } = await setup();
    const now = Math.floor(Date.now() / 1000);
    const { jws } = await makeJws(
      { sub: 's', nonce: 'n', iat: now, exp: now + 60 },
      pair.privateKey,
      'HS256',
    );
    const r = await verifyCompactJws(jws, { publicKey });
    expect(r).toEqual({ ok: false, reason: 'jws_unsupported_alg' });
  });

  it('rejects malformed compact form', async () => {
    const { publicKey } = await setup();
    const r = await verifyCompactJws('not.a.valid', { publicKey });
    expect(r.ok).toBe(false);
  });

  it('rejects missing claims', async () => {
    const { pair, publicKey } = await setup();
    const { jws } = await makeJws({ sub: 's', nonce: 'n' }, pair.privateKey);
    const r = await verifyCompactJws(jws, { publicKey });
    expect(r).toEqual({ ok: false, reason: 'jws_missing_claims' });
  });

  it('rejects bad signature', async () => {
    const { pair, publicKey } = await setup();
    const now = Math.floor(Date.now() / 1000);
    const { jws } = await makeJws(
      { sub: 's', nonce: 'n', iat: now, exp: now + 60 },
      pair.privateKey,
    );
    const tampered = jws.slice(0, -4) + 'AAAA';
    const r = await verifyCompactJws(tampered, { publicKey });
    expect(r.ok).toBe(false);
  });
});
