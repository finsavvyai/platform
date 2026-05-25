/**
 * Server-side cryptographic utilities for TokenForge.
 * Uses Web Crypto API — compatible with Cloudflare Workers.
 *
 * Accepts public keys as JWK JSON (browser SDK) or PEM-encoded SPKI
 * (Python / Go / Swift / Kotlin / Swift native SDKs).
 *
 * Accepts signatures as base64url-encoded raw r||s (IEEE P1363, browser
 * SDK) or DER-encoded SEQUENCE { INTEGER r, INTEGER s } (native SDKs).
 */

const P256_COORD_BYTES = 32;

export async function importPublicKey(input: string): Promise<CryptoKey> {
  const trimmed = input.trim();
  if (trimmed.startsWith('-----BEGIN')) {
    const spki = pemToDer(trimmed);
    return crypto.subtle.importKey(
      'spki',
      spki,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
  }
  const jwk = JSON.parse(trimmed) as JsonWebKey;
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
}

export async function verifySignature(
  publicKey: CryptoKey,
  signatureBase64Url: string,
  payload: string,
): Promise<boolean> {
  try {
    const sigBytes = new Uint8Array(base64UrlToArrayBuffer(signatureBase64Url));
    const raw = normalizeEcdsaSignature(sigBytes);
    if (!raw) return false;
    const payloadBytes = new TextEncoder().encode(payload);
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      publicKey,
      raw as BufferSource,
      payloadBytes as BufferSource,
    );
  } catch {
    return false;
  }
}

function normalizeEcdsaSignature(sig: Uint8Array): Uint8Array | null {
  // Already raw r||s
  if (sig.length === P256_COORD_BYTES * 2) return sig;
  // DER SEQUENCE { INTEGER r, INTEGER s }
  if (sig[0] === 0x30) return derToRaw(sig);
  return null;
}

function derToRaw(der: Uint8Array): Uint8Array | null {
  // 0x30 totalLen 0x02 rLen <r> 0x02 sLen <s>
  if (der[0] !== 0x30) return null;
  let offset = 1;
  // total length (short form only — P-256 sigs are < 128 bytes)
  const total = der[offset++]!;
  if (total + 2 !== der.length) return null;
  if (der[offset++] !== 0x02) return null;
  const rLen = der[offset++]!;
  const r = der.slice(offset, offset + rLen);
  offset += rLen;
  if (der[offset++] !== 0x02) return null;
  const sLen = der[offset++]!;
  const s = der.slice(offset, offset + sLen);
  const out = new Uint8Array(P256_COORD_BYTES * 2);
  copyPadded(r, out, 0);
  copyPadded(s, out, P256_COORD_BYTES);
  return out;
}

function copyPadded(int: Uint8Array, dest: Uint8Array, destOffset: number): void {
  // Strip a single leading 0x00 (DER sign-bit pad), then right-align into 32 bytes.
  const start = int.length > P256_COORD_BYTES && int[0] === 0x00 ? 1 : 0;
  const slice = int.slice(start);
  const pad = P256_COORD_BYTES - slice.length;
  dest.set(slice, destOffset + Math.max(0, pad));
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [A-Z0-9 ]+-----/g, '')
    .replace(/-----END [A-Z0-9 ]+-----/g, '')
    .replace(/\s+/g, '');
  return base64ToArrayBuffer(b64);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return base64ToArrayBuffer(padded);
}
