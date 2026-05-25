/**
 * verifyWebAuthnAttestation coverage (lines 76-110 of webauthn-verify.ts).
 * Sibling file because webauthn-verify.test.ts is at 200L cap. Builds
 * real CBOR-encoded attestation objects with a freshly-generated P-256
 * keypair so the attestation parser sees real WebAuthn shapes.
 */

import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { verifyWebAuthnAttestation } from './webauthn-verify.js';

const subtle = (webcrypto as unknown as Crypto).subtle;

function b64u(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return Buffer.from(bin, 'binary').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64uString(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Minimal CBOR encoder for the shapes needed: small ints (pos/neg),
// byte strings, text strings, and maps. Doesn't aim for completeness.
function cborByteString(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 24) return Uint8Array.from([0x40 + bytes.length, ...bytes]);
  if (bytes.length < 256) return Uint8Array.from([0x58, bytes.length, ...bytes]);
  throw new Error('byte string too long for minimal encoder');
}
function cborTextString(s: string): Uint8Array {
  const bytes = new TextEncoder().encode(s);
  if (bytes.length < 24) return Uint8Array.from([0x60 + bytes.length, ...bytes]);
  throw new Error('text string too long for minimal encoder');
}
function cborSmallInt(n: number): Uint8Array {
  if (n >= 0 && n < 24) return Uint8Array.from([n]);
  if (n < 0 && n >= -24) return Uint8Array.from([0x20 + (-1 - n)]);
  throw new Error('int outside minimal encoder range');
}
function cborMap(entries: Array<[Uint8Array, Uint8Array]>): Uint8Array {
  if (entries.length >= 24) throw new Error('map too large for minimal encoder');
  const parts: number[] = [0xa0 + entries.length];
  for (const [k, v] of entries) {
    parts.push(...k, ...v);
  }
  return Uint8Array.from(parts);
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const a of arrs) { out.set(a, p); p += a.length; }
  return out;
}

async function genCoseKeyAndJwk(): Promise<{ cose: Uint8Array; xRaw: Uint8Array; yRaw: Uint8Array }> {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', pair.publicKey);
  const xRaw = Buffer.from(jwk.x!.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const yRaw = Buffer.from(jwk.y!.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  // COSE_Key: { 1:2 (kty=EC2), 3:-7 (alg=ES256), -1:1 (crv=P-256), -2:x, -3:y }
  const cose = cborMap([
    [cborSmallInt(1), cborSmallInt(2)],
    [cborSmallInt(3), cborSmallInt(-7)],
    [cborSmallInt(-1), cborSmallInt(1)],
    [cborSmallInt(-2), cborByteString(new Uint8Array(xRaw))],
    [cborSmallInt(-3), cborByteString(new Uint8Array(yRaw))],
  ]);
  return { cose, xRaw: new Uint8Array(xRaw), yRaw: new Uint8Array(yRaw) };
}

function buildAuthData(coseKey: Uint8Array, atFlagSet = true): Uint8Array {
  const rpIdHash = new Uint8Array(32);   // arbitrary 32-byte hash
  const flags = new Uint8Array([atFlagSet ? 0x40 : 0x00]); // AT bit
  const signCount = new Uint8Array(4);   // zeros
  const aaguid = new Uint8Array(16);     // zeros
  const credentialId = new Uint8Array(16).fill(7);
  const credIdLen = new Uint8Array([0x00, credentialId.length]);
  return concat(rpIdHash, flags, signCount, aaguid, credIdLen, credentialId, coseKey);
}

function buildAttestationB64u(authData: Uint8Array): string {
  // attestationObject = { 'authData': authData } — fmt/attStmt skipped
  const obj = cborMap([[cborTextString('authData'), cborByteString(authData)]]);
  return b64u(obj);
}

function clientData(challenge: string, origin: string, type: 'webauthn.create' | 'webauthn.get'): string {
  return b64uString(JSON.stringify({ type, challenge, origin }));
}

const ORIGIN = 'https://app.example.com';
const CHALLENGE = b64uString('register-challenge');

describe('verifyWebAuthnAttestation — coverage of lines 76-110', () => {
  it('happy path: returns publicKeyJwk + credentialId + rpIdHash from a real CBOR attestation', async () => {
    const { cose } = await genCoseKeyAndJwk();
    const authData = buildAuthData(cose);
    const attestation = buildAttestationB64u(authData);
    const cd = clientData(CHALLENGE, ORIGIN, 'webauthn.create');
    const result = await verifyWebAuthnAttestation(attestation, cd, CHALLENGE, ORIGIN);
    expect(result.publicKeyJwk.kty).toBe('EC');
    expect(result.publicKeyJwk.crv).toBe('P-256');
    expect(result.credentialId.length).toBe(16);
    expect(result.rpIdHash.length).toBe(32);
  });

  it('throws when clientDataJSON has wrong type (webauthn.get instead of webauthn.create) — line 71', async () => {
    const { cose } = await genCoseKeyAndJwk();
    const authData = buildAuthData(cose);
    const attestation = buildAttestationB64u(authData);
    const cd = clientData(CHALLENGE, ORIGIN, 'webauthn.get');
    await expect(verifyWebAuthnAttestation(attestation, cd, CHALLENGE, ORIGIN))
      .rejects.toThrow(/webauthn\.create:/);
  });

  it('throws when authData AT flag is not set — line 87', async () => {
    const { cose } = await genCoseKeyAndJwk();
    const authData = buildAuthData(cose, false);
    const attestation = buildAttestationB64u(authData);
    const cd = clientData(CHALLENGE, ORIGIN, 'webauthn.create');
    await expect(verifyWebAuthnAttestation(attestation, cd, CHALLENGE, ORIGIN))
      .rejects.toThrow(/AT.*flag/);
  });

  it('throws when COSE_Key alg is unsupported (-8 instead of -7 ES256) — line 104', async () => {
    const { xRaw, yRaw } = await genCoseKeyAndJwk();
    // alg=-8 (EdDSA) instead of -7 (ES256)
    const cose = cborMap([
      [cborSmallInt(1), cborSmallInt(2)],
      [cborSmallInt(3), cborSmallInt(-8)],
      [cborSmallInt(-1), cborSmallInt(1)],
      [cborSmallInt(-2), cborByteString(xRaw)],
      [cborSmallInt(-3), cborByteString(yRaw)],
    ]);
    const authData = buildAuthData(cose);
    const attestation = buildAttestationB64u(authData);
    const cd = clientData(CHALLENGE, ORIGIN, 'webauthn.create');
    await expect(verifyWebAuthnAttestation(attestation, cd, CHALLENGE, ORIGIN))
      .rejects.toThrow(/alg.*unsupported/);
  });

  it('throws when attestationObject is not a CBOR map — line 75', async () => {
    // CBOR for 0 (positive small int) — not a map
    const notAMap = b64u(Uint8Array.from([0x00]));
    const cd = clientData(CHALLENGE, ORIGIN, 'webauthn.create');
    await expect(verifyWebAuthnAttestation(notAMap, cd, CHALLENGE, ORIGIN))
      .rejects.toThrow(/attestationObject: not a CBOR map/);
  });

  it('throws when COSE_Key x is not a byte string (encoded as small-int) — line 108', async () => {
    // CBOR encodes x with cborSmallInt instead of cborByteString → x is
    // a number after decode → instanceof Uint8Array check fails → throws.
    const { yRaw } = await genCoseKeyAndJwk();
    const cose = cborMap([
      [cborSmallInt(1), cborSmallInt(2)],
      [cborSmallInt(3), cborSmallInt(-7)],
      [cborSmallInt(-1), cborSmallInt(1)],
      [cborSmallInt(-2), cborSmallInt(5)], // x is now a number, not bytes
      [cborSmallInt(-3), cborByteString(yRaw)],
    ]);
    const authData = buildAuthData(cose);
    const attestation = buildAttestationB64u(authData);
    const cd = clientData(CHALLENGE, ORIGIN, 'webauthn.create');
    await expect(verifyWebAuthnAttestation(attestation, cd, CHALLENGE, ORIGIN))
      .rejects.toThrow(/x\/y missing/);
  });
});
