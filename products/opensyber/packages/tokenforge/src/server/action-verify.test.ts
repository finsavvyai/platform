import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { signAction } from '../client/action-signer.js';
import { verifyAction } from './action-verify.js';

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

describe('verifyAction', () => {
  it('passes through verifyCompactJws failures (e.g. expired signature)', async () => {
    const { privateKey, publicJwk } = await genKeyPair();
    const past = new Date(Date.now() - 10 * 60_000);
    const { jws } = await signAction(
      { action: 'checkout', amount: 99 },
      { privateKey, sessionId: 's1', now: () => past, ttlSeconds: 600 },
    );
    const result = await verifyAction(jws, {
      publicKey: publicJwk,
      expectedAction: 'checkout',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('jws_too_old');
  });

  it('returns action_mismatch when claims.action ≠ expectedAction', async () => {
    const { privateKey, publicJwk } = await genKeyPair();
    const { jws } = await signAction(
      { action: 'checkout', amount: 99 },
      { privateKey, sessionId: 's1' },
    );
    const result = await verifyAction(jws, {
      publicKey: publicJwk,
      expectedAction: 'admin_grant',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('action_mismatch');
  });

  it('returns action_hash_mismatch when body differs from signed payload', async () => {
    const { privateKey, publicJwk } = await genKeyPair();
    const { jws } = await signAction(
      { action: 'checkout', amount: 99, recipient: 'alice' },
      { privateKey, sessionId: 's1' },
    );
    const result = await verifyAction(jws, {
      publicKey: publicJwk,
      expectedAction: 'checkout',
      body: { action: 'checkout', amount: 9999, recipient: 'alice' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('action_hash_mismatch');
  });

  it('returns ok with claims when JWS + action + body all agree', async () => {
    const { privateKey, publicJwk } = await genKeyPair();
    const payload = { action: 'checkout', amount: 99, recipient: 'alice' };
    const { jws } = await signAction(payload, { privateKey, sessionId: 'tf-s-1' });
    const result = await verifyAction(jws, {
      publicKey: publicJwk,
      expectedAction: 'checkout',
      body: payload,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.sub).toBe('tf-s-1');
      expect(result.claims.action).toBe('checkout');
    }
  });

  it('skips body-hash check when opts.body is omitted (action-only verification)', async () => {
    const { privateKey, publicJwk } = await genKeyPair();
    const { jws } = await signAction(
      { action: 'checkout', amount: 99 },
      { privateKey, sessionId: 's1' },
    );
    const result = await verifyAction(jws, {
      publicKey: publicJwk,
      expectedAction: 'checkout',
    });
    expect(result.ok).toBe(true);
  });

  it('treats null body the same as omitted (no hash assertion)', async () => {
    const { privateKey, publicJwk } = await genKeyPair();
    const { jws } = await signAction(
      { action: 'admin_grant' },
      { privateKey, sessionId: 's1' },
    );
    const result = await verifyAction(jws, {
      publicKey: publicJwk,
      expectedAction: 'admin_grant',
      body: null,
    });
    expect(result.ok).toBe(true);
  });

  it('honors body key reordering — same fields different order still match', async () => {
    const { privateKey, publicJwk } = await genKeyPair();
    const payloadA = { action: 'checkout', amount: 99, recipient: 'alice' };
    const { jws } = await signAction(payloadA, { privateKey, sessionId: 's1' });
    // server receives the body via fetch — JS object literal order may differ
    const payloadB = { recipient: 'alice', action: 'checkout', amount: 99 };
    const result = await verifyAction(jws, {
      publicKey: publicJwk,
      expectedAction: 'checkout',
      body: payloadB,
    });
    expect(result.ok).toBe(true);
  });
});

describe('verifyAction TLS exporter binding (RFC 9266)', () => {
  const exporterA = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
  const exporterB = '00112233445566778899aabbccddeeff';

  it('matches when client embeds tlsExporter and server passes the same value', async () => {
    const { privateKey, publicJwk } = await genKeyPair();
    const { jws } = await signAction(
      { action: 'checkout', amount: 99 },
      { privateKey, sessionId: 's1', tlsExporter: exporterA },
    );
    const result = await verifyAction(jws, {
      publicKey: publicJwk,
      expectedAction: 'checkout',
      expectedTlsExporter: exporterA,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.claims.tlsExporter).toBe(exporterA);
  });

  it('Sprint 39 line 88: replay across TLS connection rejects with signature_channel_mismatch', async () => {
    // RFC 9266 channel-binding violation: claim.tlsExporter (A) ≠
    // expectedTlsExporter (B). Spec-aligned reason (was tls_exporter_mismatch).
    const { privateKey, publicJwk } = await genKeyPair();
    const { jws } = await signAction(
      { action: 'checkout', amount: 99 },
      { privateKey, sessionId: 's1', tlsExporter: exporterA },
    );
    const result = await verifyAction(jws, {
      publicKey: publicJwk,
      expectedAction: 'checkout',
      expectedTlsExporter: exporterB,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('signature_channel_mismatch');
  });

  it('rejects with signature_channel_mismatch when client did NOT embed an exporter but server expects one', async () => {
    const { privateKey, publicJwk } = await genKeyPair();
    const { jws } = await signAction(
      { action: 'checkout' },
      { privateKey, sessionId: 's1' }, // no tlsExporter
    );
    const result = await verifyAction(jws, {
      publicKey: publicJwk,
      expectedAction: 'checkout',
      expectedTlsExporter: exporterA,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('signature_channel_mismatch');
  });

  it('skips exporter check when neither expectedTlsExporter nor requireTlsExporter is set (workerd default)', async () => {
    const { privateKey, publicJwk } = await genKeyPair();
    const { jws } = await signAction(
      { action: 'checkout' },
      { privateKey, sessionId: 's1' },
    );
    const result = await verifyAction(jws, {
      publicKey: publicJwk,
      expectedAction: 'checkout',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects with tls_exporter_missing when requireTlsExporter=true and claim absent', async () => {
    const { privateKey, publicJwk } = await genKeyPair();
    const { jws } = await signAction(
      { action: 'admin_grant' },
      { privateKey, sessionId: 's1' },
    );
    const result = await verifyAction(jws, {
      publicKey: publicJwk,
      expectedAction: 'admin_grant',
      requireTlsExporter: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('tls_exporter_missing');
  });
});
