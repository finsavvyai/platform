import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { verifyEdgeSignature, type EdgeSession } from './sig-verify.js';

const subtle = (webcrypto as unknown as Crypto).subtle;

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return Buffer.from(bin, 'binary').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function genSessionAndSigner(): Promise<{
  session: EdgeSession;
  privateKey: CryptoKey;
}> {
  const pair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = await subtle.exportKey('jwk', pair.publicKey);
  return {
    session: { sessionId: 'tf-dbsc-session-1', publicKey: JSON.stringify(jwk) },
    privateKey: pair.privateKey,
  };
}

async function signLegacy(
  privateKey: CryptoKey,
  payload: string,
): Promise<string> {
  const sig = await subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    new TextEncoder().encode(payload),
  );
  return b64url(new Uint8Array(sig));
}

async function buildJws(
  privateKey: CryptoKey,
  claims: Record<string, unknown>,
): Promise<string> {
  const headerB64 = b64url(JSON.stringify({ alg: 'ES256', typ: 'JWT' }));
  const claimsB64 = b64url(JSON.stringify(claims));
  const signingInput = `${headerB64}.${claimsB64}`;
  const sigBuf = await subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64url(new Uint8Array(sigBuf))}`;
}

describe('verifyEdgeSignature — legacy header triple', () => {
  it('returns ok: true mode=legacy on a valid signature within skew', async () => {
    const { session, privateKey } = await genSessionAndSigner();
    const ts = Math.floor(Date.now() / 1000);
    const sig = await signLegacy(privateKey, `${session.sessionId}:nonce-1:${ts}`);
    const v = await verifyEdgeSignature(
      session,
      { signature: sig, nonce: 'nonce-1', timestamp: String(ts) },
      ts,
    );
    expect(v).toEqual({ ok: true, mode: 'legacy' });
  });

  it('returns reason=timestamp_skew when ts is more than 60s off', async () => {
    const { session, privateKey } = await genSessionAndSigner();
    const ts = Math.floor(Date.now() / 1000);
    const sig = await signLegacy(privateKey, `${session.sessionId}:n:${ts}`);
    const v = await verifyEdgeSignature(session, { signature: sig, nonce: 'n', timestamp: String(ts) }, ts + 120);
    expect(v).toMatchObject({ ok: false, mode: 'legacy', reason: 'timestamp_skew' });
  });

  it('returns reason=timestamp_invalid for ts=0/negative', async () => {
    const { session } = await genSessionAndSigner();
    const v = await verifyEdgeSignature(
      session,
      { signature: 'x', nonce: 'n', timestamp: '0' },
      1000,
    );
    expect(v).toMatchObject({ ok: false, mode: 'legacy', reason: 'timestamp_invalid' });
  });

  it('returns reason=signature_invalid when bytes do not match', async () => {
    const { session } = await genSessionAndSigner();
    const ts = 1700_000_000;
    // Random b64url that's the right shape but not the valid signature
    const wrongSig = b64url(new Uint8Array(64).fill(7));
    const v = await verifyEdgeSignature(
      session,
      { signature: wrongSig, nonce: 'n', timestamp: String(ts) },
      ts,
    );
    expect(v).toMatchObject({ ok: false, mode: 'legacy', reason: 'signature_invalid' });
  });

  it('returns mode=none when signature/nonce/timestamp are all missing', async () => {
    const { session } = await genSessionAndSigner();
    const v = await verifyEdgeSignature(session, {
      signature: null, nonce: null, timestamp: null,
    });
    expect(v).toMatchObject({ ok: false, mode: 'none', reason: 'no_signature_headers' });
  });
});

describe('verifyEdgeSignature — JWS path', () => {
  it('returns ok: true mode=jws when JWS validates and sub matches', async () => {
    const { session, privateKey } = await genSessionAndSigner();
    const now = Math.floor(Date.now() / 1000);
    const jws = await buildJws(privateKey, {
      sub: session.sessionId, iat: now - 5, exp: now + 30, nonce: 'n1',
    });
    const v = await verifyEdgeSignature(
      session,
      { signature: null, nonce: null, timestamp: null, jws },
    );
    expect(v).toEqual({ ok: true, mode: 'jws' });
  });

  it('returns reason=jws_subject_mismatch when sub claim is for a different session', async () => {
    const { session, privateKey } = await genSessionAndSigner();
    const now = Math.floor(Date.now() / 1000);
    const jws = await buildJws(privateKey, {
      sub: 'tf-dbsc-OTHER', iat: now - 5, exp: now + 30, nonce: 'n2',
    });
    const v = await verifyEdgeSignature(
      session,
      { signature: null, nonce: null, timestamp: null, jws },
    );
    expect(v).toMatchObject({ ok: false, mode: 'jws', reason: 'jws_subject_mismatch' });
  });

  it('returns ok: false mode=jws with verifier reason when JWS is malformed', async () => {
    const { session } = await genSessionAndSigner();
    const v = await verifyEdgeSignature(
      session,
      { signature: null, nonce: null, timestamp: null, jws: 'not.a.jws' },
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.mode).toBe('jws');
  });

  it('JWS path takes precedence over legacy when both are supplied', async () => {
    const { session, privateKey } = await genSessionAndSigner();
    const now = Math.floor(Date.now() / 1000);
    const jws = await buildJws(privateKey, {
      sub: session.sessionId, iat: now - 5, exp: now + 30, nonce: 'n3',
    });
    // Legacy fields are intentionally garbage — must be ignored.
    const v = await verifyEdgeSignature(
      session,
      {
        signature: 'garbage', nonce: 'n', timestamp: String(now), jws,
      },
      now,
    );
    expect(v).toEqual({ ok: true, mode: 'jws' });
  });

  it('empty jws string falls through to legacy/none (`if (input.jws)` is falsy)', async () => {
    const { session } = await genSessionAndSigner();
    const v = await verifyEdgeSignature(
      session,
      { signature: null, nonce: null, timestamp: null, jws: '' },
    );
    // Empty jws → falls past line 53, then no legacy triple → mode=none
    expect(v).toMatchObject({ ok: false, mode: 'none', reason: 'no_signature_headers' });
  });

  it('legacy: non-numeric timestamp (parseInt → NaN) → timestamp_invalid', async () => {
    const { session } = await genSessionAndSigner();
    const v = await verifyEdgeSignature(
      session,
      { signature: 'x', nonce: 'n', timestamp: 'abc' },
      1700_000_000,
    );
    expect(v).toMatchObject({ ok: false, mode: 'legacy', reason: 'timestamp_invalid' });
  });

  it('legacy: timestamp at exactly +60s boundary passes the skew gate (>60 is strict)', async () => {
    const { session, privateKey } = await genSessionAndSigner();
    const ts = 1700_000_000;
    const sig = await signLegacy(privateKey, `${session.sessionId}:n:${ts}`);
    const v = await verifyEdgeSignature(
      session,
      { signature: sig, nonce: 'n', timestamp: String(ts) },
      ts + 60,
    );
    expect(v).toEqual({ ok: true, mode: 'legacy' });
  });

});
