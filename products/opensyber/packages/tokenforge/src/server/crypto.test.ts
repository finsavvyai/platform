import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { importPublicKey, verifySignature } from './crypto.js';

const subtle = (webcrypto as unknown as Crypto).subtle;

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function spkiToPem(spki: ArrayBuffer): string {
  const b64 = Buffer.from(spki).toString('base64');
  const lines = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

function rawToDer(raw: Uint8Array): Uint8Array {
  // raw r||s (64 bytes for P-256) → DER SEQUENCE { INTEGER r, INTEGER s }
  const r = trimAndPad(raw.slice(0, 32));
  const s = trimAndPad(raw.slice(32, 64));
  const total = 2 + r.length + 2 + s.length;
  const out = new Uint8Array(2 + total);
  out[0] = 0x30; out[1] = total;
  out[2] = 0x02; out[3] = r.length; out.set(r, 4);
  out[4 + r.length] = 0x02; out[5 + r.length] = s.length; out.set(s, 6 + r.length);
  return out;
}

function trimAndPad(coord: Uint8Array): Uint8Array {
  // Strip leading zeros, then add a sign-bit zero if MSB is set.
  let i = 0;
  while (i < coord.length - 1 && coord[i] === 0x00) i++;
  const trimmed = coord.slice(i);
  if (trimmed[0]! & 0x80) {
    const padded = new Uint8Array(trimmed.length + 1);
    padded.set(trimmed, 1);
    return padded;
  }
  return trimmed;
}

async function genSignSetup(payload: string) {
  const pair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'],
  );
  const jwk = await subtle.exportKey('jwk', pair.publicKey);
  const spki = await subtle.exportKey('spki', pair.publicKey);
  const sigBuf = await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey,
    new TextEncoder().encode(payload),
  );
  return { jwk, spki, raw: new Uint8Array(sigBuf) };
}

describe('importPublicKey + verifySignature', () => {
  it('verifies JWK pubkey + raw r||s signature (browser SDK path)', async () => {
    const payload = 'sess-1:nonce-abc:1700000000';
    const { jwk, raw } = await genSignSetup(payload);
    const key = await importPublicKey(JSON.stringify(jwk));
    const ok = await verifySignature(key, bytesToBase64Url(raw), payload);
    expect(ok).toBe(true);
  });

  it('verifies PEM SPKI pubkey + DER signature (native SDK path)', async () => {
    const payload = 'sess-2:nonce-xyz:1700000001';
    const { spki, raw } = await genSignSetup(payload);
    const pem = spkiToPem(spki);
    const der = rawToDer(raw);
    const key = await importPublicKey(pem);
    const ok = await verifySignature(key, bytesToBase64Url(der), payload);
    expect(ok).toBe(true);
  });

  it('rejects a tampered payload', async () => {
    const payload = 'sess-3:nonce-q:1700000002';
    const { jwk, raw } = await genSignSetup(payload);
    const key = await importPublicKey(JSON.stringify(jwk));
    const ok = await verifySignature(key, bytesToBase64Url(raw), payload + 'x');
    expect(ok).toBe(false);
  });

  it('returns false for malformed signature bytes', async () => {
    const payload = 'sess-4:nonce-m:1700000003';
    const { jwk } = await genSignSetup(payload);
    const key = await importPublicKey(JSON.stringify(jwk));
    const ok = await verifySignature(key, bytesToBase64Url(new Uint8Array([1, 2, 3])), payload);
    expect(ok).toBe(false);
  });

  it('importPublicKey rejects bogus PEM (invalid SPKI bytes)', async () => {
    const bogusPem = '-----BEGIN PUBLIC KEY-----\nQUJDREVGRw==\n-----END PUBLIC KEY-----';
    await expect(importPublicKey(bogusPem)).rejects.toThrow();
  });

  it('importPublicKey rejects JWK with wrong curve (P-384 not P-256)', async () => {
    const jwk = JSON.stringify({ kty: 'EC', crv: 'P-384', x: 'aaa', y: 'bbb' });
    await expect(importPublicKey(jwk)).rejects.toThrow();
  });

  it('verifySignature handles whitespace-padded base64url without crashing', async () => {
    const payload = 'p';
    const { jwk } = await genSignSetup(payload);
    const key = await importPublicKey(JSON.stringify(jwk));
    // base64url with trailing whitespace gets passed through; the internal
    // base64 decoder either tolerates it or returns false — never crashes.
    const ok = await verifySignature(key, '   ', payload);
    expect(ok).toBe(false);
  });

  it('importPublicKey trims leading/trailing whitespace before sniffing PEM vs JWK', async () => {
    const payload = 'q';
    const { jwk, raw } = await genSignSetup(payload);
    const padded = `\n  ${JSON.stringify(jwk)}  \n`;
    const key = await importPublicKey(padded);
    const ok = await verifySignature(key, bytesToBase64Url(raw), payload);
    expect(ok).toBe(true);
  });

  it('verifySignature rejects DER that starts with 0x30 but has corrupt structure', async () => {
    const payload = 'r';
    const { jwk } = await genSignSetup(payload);
    const key = await importPublicKey(JSON.stringify(jwk));
    // Starts with 0x30 (SEQUENCE) but the inner length doesn't match.
    const fakeDer = new Uint8Array([0x30, 0x10, 0x02, 0x01, 0x00]); // 5 bytes total, advertised 18
    const ok = await verifySignature(key, bytesToBase64Url(fakeDer), payload);
    expect(ok).toBe(false);
  });
});
