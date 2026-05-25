import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  secSessionRegistrationHeader,
  verifyDbscRegistrationJwt,
} from './dbsc-registration.js';

const subtle = (webcrypto as unknown as Crypto).subtle;

function strToB64u(s: string): string {
  return Buffer.from(s).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function buildJwt(
  jwk: JsonWebKey,
  payload: Record<string, unknown>,
  privateKey: CryptoKey,
  alg = 'ES256',
): Promise<string> {
  const header = { alg, typ: 'jwt', jwk };
  const headerB64 = strToB64u(JSON.stringify(header));
  const payloadB64 = strToB64u(JSON.stringify(payload));
  const input = `${headerB64}.${payloadB64}`;
  const sig = await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, privateKey,
    new TextEncoder().encode(input),
  );
  const sigB64 = Buffer.from(new Uint8Array(sig)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

async function setup() {
  const pair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'],
  );
  const jwk = (await subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
  return { pair, jwk };
}

describe('verifyDbscRegistrationJwt', () => {
  it('accepts a well-formed JWT carrying its own pubkey', async () => {
    const { pair, jwk } = await setup();
    const jws = await buildJwt(
      jwk,
      { aud: 'https://api.tokenforge.dev/.well-known/tokenforge/register', jti: 'nonce-1' },
      pair.privateKey,
    );
    const r = await verifyDbscRegistrationJwt(jws, {
      expectedAud: 'https://api.tokenforge.dev/.well-known/tokenforge/register',
      expectedJti: 'nonce-1',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.jwk.crv).toBe('P-256');
  });

  it('rejects audience mismatch', async () => {
    const { pair, jwk } = await setup();
    const jws = await buildJwt(jwk, { aud: 'https://x', jti: 'n' }, pair.privateKey);
    const r = await verifyDbscRegistrationJwt(jws, {
      expectedAud: 'https://y',
      expectedJti: 'n',
    });
    expect(r).toEqual({ ok: false, reason: 'aud_mismatch' });
  });

  it('rejects jti mismatch (replay across challenges)', async () => {
    const { pair, jwk } = await setup();
    const jws = await buildJwt(jwk, { aud: 'https://x', jti: 'real' }, pair.privateKey);
    const r = await verifyDbscRegistrationJwt(jws, {
      expectedAud: 'https://x',
      expectedJti: 'forged',
    });
    expect(r).toEqual({ ok: false, reason: 'jti_mismatch' });
  });

  it('rejects unsupported alg', async () => {
    const { pair, jwk } = await setup();
    const jws = await buildJwt(jwk, { aud: 'a', jti: 'b' }, pair.privateKey, 'HS256');
    const r = await verifyDbscRegistrationJwt(jws, { expectedAud: 'a', expectedJti: 'b' });
    expect(r).toEqual({ ok: false, reason: 'jws_unsupported_alg' });
  });

  it('rejects missing jwk in header', async () => {
    const { pair } = await setup();
    const jws = await buildJwt({} as JsonWebKey, { aud: 'a', jti: 'b' }, pair.privateKey);
    const r = await verifyDbscRegistrationJwt(jws, { expectedAud: 'a', expectedJti: 'b' });
    expect(r).toEqual({ ok: false, reason: 'jws_missing_jwk' });
  });

  it('rejects malformed compact form', async () => {
    const r = await verifyDbscRegistrationJwt('not.a.valid', {
      expectedAud: 'a', expectedJti: 'b',
    });
    expect(r.ok).toBe(false);
  });

  it('rejects missing claims', async () => {
    const { pair, jwk } = await setup();
    const jws = await buildJwt(jwk, { aud: 'a' }, pair.privateKey);
    const r = await verifyDbscRegistrationJwt(jws, { expectedAud: 'a', expectedJti: 'b' });
    expect(r).toEqual({ ok: false, reason: 'jws_missing_claims' });
  });

  it('rejects bad signature', async () => {
    const { pair, jwk } = await setup();
    const jws = await buildJwt(jwk, { aud: 'a', jti: 'b' }, pair.privateKey);
    const tampered = jws.slice(0, -4) + 'AAAA';
    const r = await verifyDbscRegistrationJwt(tampered, { expectedAud: 'a', expectedJti: 'b' });
    expect(r.ok).toBe(false);
  });
});

describe('secSessionRegistrationHeader', () => {
  it('emits the W3C DBSC header format', () => {
    const v = secSessionRegistrationHeader({
      registrationPath: '/.well-known/tokenforge/register',
      challenge: 'b64-nonce',
    });
    expect(v).toBe('(ES256);path="/.well-known/tokenforge/register";challenge="b64-nonce"');
  });
});
