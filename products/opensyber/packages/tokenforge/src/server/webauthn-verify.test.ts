import { describe, it, expect } from 'vitest';
import {
  verifyClientDataJSON,
  verifyWebAuthnAssertion,
  verifyWebAuthnAttestation,
  derToRawEcdsa,
  b64uToBuf,
  bufToB64u,
} from './webauthn-verify.js';
import { makeP256Keypair, rawToDerEcdsa } from './webauthn-verify.test-helpers.js';

// ── base64url helpers ──
describe('b64uToBuf / bufToB64u', () => {
  it('round-trips arbitrary bytes', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255, 42]);
    const encoded = bufToB64u(original);
    const decoded = new Uint8Array(b64uToBuf(encoded));
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it('produces url-safe output (no + / =)', () => {
    expect(bufToB64u(new Uint8Array([0xff, 0xff, 0xff]))).toBe('____');
  });

  it('decodes input without padding', () => {
    const decoded = new Uint8Array(b64uToBuf('AQI'));
    expect(Array.from(decoded)).toEqual([1, 2]);
  });
});

// ── verifyClientDataJSON ──
describe('verifyClientDataJSON', () => {
  function encode(obj: unknown): string {
    return bufToB64u(new TextEncoder().encode(JSON.stringify(obj)));
  }

  it('accepts matching challenge, origin, and type', () => {
    const cd = encode({ type: 'webauthn.get', challenge: 'CHAL', origin: 'https://app.example.com' });
    const result = verifyClientDataJSON(cd, 'CHAL', 'https://app.example.com', 'webauthn.get');
    expect(result.ok).toBe(true);
  });

  it('rejects mismatched challenge', () => {
    const cd = encode({ type: 'webauthn.get', challenge: 'OTHER', origin: 'https://app.example.com' });
    const result = verifyClientDataJSON(cd, 'CHAL', 'https://app.example.com', 'webauthn.get');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/challenge mismatch/);
  });

  it('rejects mismatched origin', () => {
    const cd = encode({ type: 'webauthn.get', challenge: 'CHAL', origin: 'https://attacker.example.com' });
    const result = verifyClientDataJSON(cd, 'CHAL', 'https://app.example.com', 'webauthn.get');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/origin mismatch/);
  });

  it('rejects wrong type', () => {
    const cd = encode({ type: 'webauthn.create', challenge: 'CHAL', origin: 'https://app.example.com' });
    const result = verifyClientDataJSON(cd, 'CHAL', 'https://app.example.com', 'webauthn.get');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/type mismatch/);
  });

  it('rejects malformed JSON', () => {
    const cd = bufToB64u(new TextEncoder().encode('{not-json'));
    const result = verifyClientDataJSON(cd, 'CHAL', 'https://app.example.com', 'webauthn.get');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/malformed/);
  });
});

// ── derToRawEcdsa ──
describe('derToRawEcdsa', () => {
  it('extracts r||s padded to 32 bytes each', () => {
    // SEQUENCE { INTEGER 0x01, INTEGER 0x02 }
    const der = new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x02]);
    const raw = derToRawEcdsa(der);
    expect(raw).toHaveLength(64);
    expect(raw[31]).toBe(0x01); // r right-aligned
    expect(raw[63]).toBe(0x02); // s right-aligned
    // everything else zero
    for (let i = 0; i < 31; i++) expect(raw[i]).toBe(0);
    for (let i = 32; i < 63; i++) expect(raw[i]).toBe(0);
  });

  it('strips a leading zero pad byte from a 33-byte INTEGER', () => {
    // r = 0x00 || 32 bytes (high bit set), s = 0x05
    const r = new Uint8Array(33);
    r[0] = 0x00;
    for (let i = 1; i < 33; i++) r[i] = 0xab;
    const der = new Uint8Array([0x30, 0x26, 0x02, 0x21, ...r, 0x02, 0x01, 0x05]);
    const raw = derToRawEcdsa(der);
    expect(raw).toHaveLength(64);
    // r should be the 32 0xab bytes
    for (let i = 0; i < 32; i++) expect(raw[i]).toBe(0xab);
    expect(raw[63]).toBe(0x05);
  });

  it('throws on non-SEQUENCE input', () => {
    expect(() => derToRawEcdsa(new Uint8Array([0x02, 0x01, 0x05]))).toThrow(/SEQUENCE/);
  });
});

describe('verifyWebAuthnAssertion (real Web Crypto signature)', () => {
  it('verifies a valid assertion produced by Web Crypto', async () => {
    const kp = await makeP256Keypair();
    const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);

    const challengeRaw = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const challengeB64u = bufToB64u(challengeRaw);
    const origin = 'https://app.example.com';

    const clientData = JSON.stringify({
      type: 'webauthn.get', challenge: challengeB64u, origin,
    });
    const clientDataBytes = new TextEncoder().encode(clientData);
    const clientDataJSON = bufToB64u(clientDataBytes);

    // authenticatorData: 32 bytes rpIdHash + 1 byte flags + 4 bytes counter
    const authData = new Uint8Array(37);
    authData[32] = 0x01; // UP flag
    const authDataB64u = bufToB64u(authData);

    const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes));
    const signed = new Uint8Array(authData.length + clientDataHash.length);
    signed.set(authData, 0);
    signed.set(clientDataHash, authData.length);

    const rawSig = new Uint8Array(
      await crypto.subtle.sign({ name: 'ECDSA', hash: { name: 'SHA-256' } }, kp.privateKey, signed),
    );
    const derSig = rawToDerEcdsa(rawSig);
    const sigB64u = bufToB64u(derSig);

    const ok = await verifyWebAuthnAssertion(
      sigB64u, authDataB64u, clientDataJSON, jwk, challengeB64u, origin,
    );
    expect(ok).toBe(true);
  });

  it('rejects when challenge does not match', async () => {
    const kp = await makeP256Keypair();
    const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
    const clientData = JSON.stringify({
      type: 'webauthn.get', challenge: 'WRONG', origin: 'https://app.example.com',
    });
    const clientDataJSON = bufToB64u(new TextEncoder().encode(clientData));
    const authData = new Uint8Array(37);
    const ok = await verifyWebAuthnAssertion(
      'sig', bufToB64u(authData), clientDataJSON, jwk,
      'EXPECTED', 'https://app.example.com',
    );
    expect(ok).toBe(false);
  });

  it('rejects an assertion signed with a different key', async () => {
    const [kp1, kp2] = [await makeP256Keypair(), await makeP256Keypair()];
    const jwk = await crypto.subtle.exportKey('jwk', kp2.publicKey); // wrong key
    const challengeB64u = bufToB64u(new Uint8Array([9, 9, 9]));
    const clientDataBytes = new TextEncoder().encode(JSON.stringify({
      type: 'webauthn.get', challenge: challengeB64u, origin: 'https://app.example.com',
    }));
    const clientDataJSON = bufToB64u(clientDataBytes);
    const authData = new Uint8Array(37);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes));
    const signed = new Uint8Array(authData.length + hash.length);
    signed.set(authData, 0); signed.set(hash, authData.length);
    const rawSig = new Uint8Array(
      await crypto.subtle.sign({ name: 'ECDSA', hash: { name: 'SHA-256' } }, kp1.privateKey, signed),
    );
    const ok = await verifyWebAuthnAssertion(
      bufToB64u(rawToDerEcdsa(rawSig)), bufToB64u(authData), clientDataJSON, jwk,
      challengeB64u, 'https://app.example.com',
    );
    expect(ok).toBe(false);
  });
});

// ── verifyWebAuthnAttestation surface contract ──
describe('verifyWebAuthnAttestation', () => {
  it('rejects mismatched challenge in clientDataJSON', async () => {
    const cd = bufToB64u(new TextEncoder().encode(JSON.stringify({
      type: 'webauthn.create', challenge: 'WRONG', origin: 'https://app.example.com',
    })));
    // attestationObject placeholder — verify fails before CBOR decode.
    await expect(
      verifyWebAuthnAttestation('AA', cd, 'EXPECTED', 'https://app.example.com'),
    ).rejects.toThrow(/challenge mismatch/);
  });

  it('rejects malformed attestationObject after challenge passes', async () => {
    const cd = bufToB64u(new TextEncoder().encode(JSON.stringify({
      type: 'webauthn.create', challenge: 'OK', origin: 'https://app.example.com',
    })));
    // 0x00 = unsigned int 0 → not a CBOR map → throws.
    await expect(
      verifyWebAuthnAttestation('AA', cd, 'OK', 'https://app.example.com'),
    ).rejects.toThrow(/not a CBOR map/);
  });
});
