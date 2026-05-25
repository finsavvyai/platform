import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { verifyIdToken, type JwksKey } from './oidc-verify.js';

const subtle = (webcrypto as unknown as Crypto).subtle;

function strToB64u(s: string): string {
  return Buffer.from(s).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function bytesToB64u(b: Uint8Array): string {
  return Buffer.from(b).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function setupRsa() {
  const pair = (await subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const jwk = (await subtle.exportKey('jwk', pair.publicKey)) as JwksKey;
  return { pair, jwk };
}

async function makeIdToken(pair: CryptoKeyPair, claims: Record<string, unknown>, alg = 'RS256', kid?: string) {
  const header: Record<string, unknown> = { alg, typ: 'JWT' };
  if (kid) header.kid = kid;
  const headerB64 = strToB64u(JSON.stringify(header));
  const payloadB64 = strToB64u(JSON.stringify(claims));
  const sig = await subtle.sign(
    alg === 'RS256' ? { name: 'RSASSA-PKCS1-v1_5' } : { name: 'ECDSA', hash: 'SHA-256' },
    pair.privateKey,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );
  return `${headerB64}.${payloadB64}.${bytesToB64u(new Uint8Array(sig))}`;
}

describe('verifyIdToken', () => {
  it('accepts a well-formed RS256 token', async () => {
    const { pair, jwk } = await setupRsa();
    const now = Math.floor(Date.now() / 1000);
    const token = await makeIdToken(pair, {
      iss: 'https://idp.test', sub: 'u1', aud: 'app_a', exp: now + 600, iat: now,
    });
    const r = await verifyIdToken(token, {
      jwks: { keys: [jwk] },
      expectedIssuer: 'https://idp.test',
      expectedAudience: 'app_a',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.claims.sub).toBe('u1');
  });

  it('rejects iss mismatch', async () => {
    const { pair, jwk } = await setupRsa();
    const now = Math.floor(Date.now() / 1000);
    const token = await makeIdToken(pair, {
      iss: 'https://forged', sub: 'u', aud: 'app_a', exp: now + 60, iat: now,
    });
    const r = await verifyIdToken(token, {
      jwks: { keys: [jwk] },
      expectedIssuer: 'https://real',
      expectedAudience: 'app_a',
    });
    expect(r).toEqual({ ok: false, reason: 'iss_mismatch' });
  });

  it('rejects aud mismatch', async () => {
    const { pair, jwk } = await setupRsa();
    const now = Math.floor(Date.now() / 1000);
    const token = await makeIdToken(pair, {
      iss: 'https://idp.test', sub: 'u', aud: 'app_b', exp: now + 60, iat: now,
    });
    const r = await verifyIdToken(token, {
      jwks: { keys: [jwk] },
      expectedIssuer: 'https://idp.test',
      expectedAudience: 'app_a',
    });
    expect(r).toEqual({ ok: false, reason: 'aud_mismatch' });
  });

  it('accepts aud as array containing the expected', async () => {
    const { pair, jwk } = await setupRsa();
    const now = Math.floor(Date.now() / 1000);
    const token = await makeIdToken(pair, {
      iss: 'https://idp.test', sub: 'u', aud: ['other', 'app_a'], exp: now + 60, iat: now,
    });
    const r = await verifyIdToken(token, {
      jwks: { keys: [jwk] },
      expectedIssuer: 'https://idp.test',
      expectedAudience: 'app_a',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects expired tokens', async () => {
    const { pair, jwk } = await setupRsa();
    const past = Math.floor(Date.now() / 1000) - 3600;
    const token = await makeIdToken(pair, {
      iss: 'https://idp.test', sub: 'u', aud: 'app_a', exp: past, iat: past - 600,
    });
    const r = await verifyIdToken(token, {
      jwks: { keys: [jwk] },
      expectedIssuer: 'https://idp.test',
      expectedAudience: 'app_a',
    });
    expect(r).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects nonce mismatch when expected', async () => {
    const { pair, jwk } = await setupRsa();
    const now = Math.floor(Date.now() / 1000);
    const token = await makeIdToken(pair, {
      iss: 'https://idp.test', sub: 'u', aud: 'app_a', exp: now + 60, iat: now,
      nonce: 'real-nonce',
    });
    const r = await verifyIdToken(token, {
      jwks: { keys: [jwk] },
      expectedIssuer: 'https://idp.test',
      expectedAudience: 'app_a',
      expectedNonce: 'expected-nonce',
    });
    expect(r).toEqual({ ok: false, reason: 'nonce_mismatch' });
  });

  it('rejects unsupported algs', async () => {
    const { pair, jwk } = await setupRsa();
    const now = Math.floor(Date.now() / 1000);
    const headerB64 = strToB64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadB64 = strToB64u(JSON.stringify({
      iss: 'https://idp.test', sub: 'u', aud: 'app_a', exp: now + 60, iat: now,
    }));
    const token = `${headerB64}.${payloadB64}.AAAA`;
    const r = await verifyIdToken(token, {
      jwks: { keys: [jwk] },
      expectedIssuer: 'https://idp.test',
      expectedAudience: 'app_a',
    });
    expect(r).toEqual({ ok: false, reason: 'unsupported_alg' });
    void pair;
  });

  it('rejects when no JWKS key matches', async () => {
    const { pair } = await setupRsa();
    const now = Math.floor(Date.now() / 1000);
    const token = await makeIdToken(pair, {
      iss: 'https://idp.test', sub: 'u', aud: 'app_a', exp: now + 60, iat: now,
    });
    const r = await verifyIdToken(token, {
      jwks: { keys: [{ kty: 'EC', crv: 'P-256', x: 'x', y: 'y' }] },
      expectedIssuer: 'https://idp.test',
      expectedAudience: 'app_a',
    });
    expect(r.ok).toBe(false);
  });

  it('rejects malformed compact form', async () => {
    const r = await verifyIdToken('not.a.valid', {
      jwks: { keys: [] },
      expectedIssuer: 'https://idp.test',
      expectedAudience: 'app_a',
    });
    expect(r.ok).toBe(false);
  });

  it('picks the correct key by kid when multiple are present', async () => {
    const { pair: a, jwk: jwkA } = await setupRsa();
    const { jwk: jwkB } = await setupRsa();
    const now = Math.floor(Date.now() / 1000);
    const token = await makeIdToken(a, {
      iss: 'https://idp.test', sub: 'u', aud: 'app_a', exp: now + 60, iat: now,
    }, 'RS256', 'key-a');
    jwkA.kid = 'key-a';
    jwkB.kid = 'key-b';
    const r = await verifyIdToken(token, {
      jwks: { keys: [jwkB, jwkA] },
      expectedIssuer: 'https://idp.test',
      expectedAudience: 'app_a',
    });
    expect(r.ok).toBe(true);
  });
});
