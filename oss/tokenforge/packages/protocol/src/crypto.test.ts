import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { importPublicKey, verifySignature, bytesToBase64Url, base64UrlToBytes } from './crypto.js';

const subtle = (webcrypto as unknown as Crypto).subtle;

function spkiToPem(spki: ArrayBuffer): string {
  const b64 = Buffer.from(spki).toString('base64');
  const lines = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

function rawToDer(raw: Uint8Array): Uint8Array {
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

  it('round-trips bytesToBase64Url ↔ base64UrlToBytes', () => {
    const input = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const enc = bytesToBase64Url(input);
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    const dec = base64UrlToBytes(enc);
    expect(Array.from(dec)).toEqual(Array.from(input));
  });
});
