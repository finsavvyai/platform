/**
 * Server-side WebAuthn verifier — runs in Cloudflare Workers (Web Crypto only).
 *
 * Limitations (intentional, documented):
 *  - We use attestation: 'none' on the client, so attestation statement
 *    verification is skipped (only the authData → COSE_Key extraction matters).
 *  - Only ES256 (alg -7, ECDSA P-256) keys are accepted on the server. EdDSA
 *    is offered to the client for forward-compat but Web Crypto support is
 *    spotty in Workers; reject EdDSA at verify time with a clear error.
 *  - Counter check is not enforced here. Callers can read the 4-byte counter
 *    out of authenticatorData[33..37] if they want to persist + compare.
 */

import { decodeCbor } from './cbor.js';

export interface AttestationVerifyResult {
  publicKeyJwk: JsonWebKey;
  credentialId: Uint8Array;
  rpIdHash: Uint8Array;
}

/** base64url → ArrayBuffer */
export function b64uToBuf(b64url: string): ArrayBuffer {
  const base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Uint8Array → base64url (no padding). */
export function bufToB64u(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Parse clientDataJSON and verify challenge + origin. */
export function verifyClientDataJSON(
  clientDataJSON: string,
  expectedChallenge: string,
  expectedOrigin: string,
  expectedType: 'webauthn.create' | 'webauthn.get',
): { ok: true } | { ok: false; reason: string } {
  let json: { type: string; challenge: string; origin: string };
  try {
    const text = new TextDecoder().decode(b64uToBuf(clientDataJSON));
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'clientDataJSON malformed' };
  }
  if (json.type !== expectedType) return { ok: false, reason: `type mismatch: ${json.type}` };
  if (json.challenge !== expectedChallenge) return { ok: false, reason: 'challenge mismatch' };
  if (json.origin !== expectedOrigin) return { ok: false, reason: `origin mismatch: ${json.origin}` };
  return { ok: true };
}

/**
 * Verify a WebAuthn attestation (registration). Returns the extracted
 * public key as JWK plus the credentialId for persistence.
 */
export async function verifyWebAuthnAttestation(
  attestationObjectB64u: string,
  clientDataJSONB64u: string,
  expectedChallenge: string,
  expectedOrigin: string,
): Promise<AttestationVerifyResult> {
  const cd = verifyClientDataJSON(clientDataJSONB64u, expectedChallenge, expectedOrigin, 'webauthn.create');
  if (!cd.ok) throw new Error(`webauthn.create: ${cd.reason}`);

  const attBuf = new Uint8Array(b64uToBuf(attestationObjectB64u));
  const decoded = decodeCbor(attBuf);
  if (!(decoded instanceof Map)) throw new Error('attestationObject: not a CBOR map');
  const authData = decoded.get('authData');
  if (!(authData instanceof Uint8Array)) throw new Error('attestationObject: authData missing');

  return parseAuthDataAttestedCredential(authData);
}

/** Pull rpIdHash + credentialId + COSE_Key out of attested authData. */
function parseAuthDataAttestedCredential(authData: Uint8Array): AttestationVerifyResult {
  if (authData.length < 37 + 18) throw new Error('authData too short for attested credential');
  const rpIdHash = authData.slice(0, 32);
  const flags = authData[32] ?? 0;
  if ((flags & 0x40) === 0) throw new Error('authData: AT (attested credential) flag not set');
  // skip signCount (4 bytes), aaguid (16 bytes)
  let p = 37 + 16;
  const credIdLen = ((authData[p] ?? 0) << 8) | (authData[p + 1] ?? 0);
  p += 2;
  const credentialId = authData.slice(p, p + credIdLen);
  p += credIdLen;
  const cosePublicKey = decodeCbor(authData.slice(p));
  return { publicKeyJwk: coseToJwk(cosePublicKey), credentialId, rpIdHash };
}

/** Convert a COSE_Key (CBOR map) → JWK. ES256 only. */
function coseToJwk(cose: unknown): JsonWebKey {
  if (!(cose instanceof Map)) throw new Error('COSE_Key: not a map');
  const kty = cose.get(1);
  const alg = cose.get(3);
  if (kty !== 2) throw new Error(`COSE_Key kty=${String(kty)} unsupported (need EC2)`);
  if (alg !== -7) throw new Error(`COSE_Key alg=${String(alg)} unsupported (need ES256/-7)`);
  const x = cose.get(-2);
  const y = cose.get(-3);
  if (!(x instanceof Uint8Array) || !(y instanceof Uint8Array)) {
    throw new Error('COSE_Key: x/y missing');
  }
  return { kty: 'EC', crv: 'P-256', x: bufToB64u(x), y: bufToB64u(y) };
}

/**
 * Verify a WebAuthn assertion. The signature is over
 * (authenticatorData || sha256(clientDataJSON)).
 */
export async function verifyWebAuthnAssertion(
  signatureB64u: string,
  authenticatorDataB64u: string,
  clientDataJSONB64u: string,
  publicKeyJwk: JsonWebKey,
  expectedChallenge: string,
  expectedOrigin: string,
): Promise<boolean> {
  const cd = verifyClientDataJSON(clientDataJSONB64u, expectedChallenge, expectedOrigin, 'webauthn.get');
  if (!cd.ok) return false;

  const authData = new Uint8Array(b64uToBuf(authenticatorDataB64u));
  const clientDataBuf = new Uint8Array(b64uToBuf(clientDataJSONB64u));
  const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBuf));
  const signed = new Uint8Array(authData.length + clientDataHash.length);
  signed.set(authData, 0);
  signed.set(clientDataHash, authData.length);

  const key = await crypto.subtle.importKey(
    'jwk', publicKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'],
  );
  const sigDer = new Uint8Array(b64uToBuf(signatureB64u));
  let sigRaw: Uint8Array;
  try { sigRaw = derToRawEcdsa(sigDer); } catch { return false; }

  try {
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      key,
      copyToArrayBuffer(sigRaw),
      copyToArrayBuffer(signed),
    );
  } catch {
    return false;
  }
}

/** Copy a Uint8Array into a freshly allocated ArrayBuffer (escapes SharedArrayBuffer typing). */
function copyToArrayBuffer(src: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(src.byteLength);
  new Uint8Array(out).set(src);
  return out;
}

/** WebAuthn ECDSA sigs are DER-encoded; Web Crypto wants raw r||s. */
export function derToRawEcdsa(der: Uint8Array): Uint8Array {
  // SEQUENCE 0x30, total len, INTEGER 0x02, rLen, r, INTEGER 0x02, sLen, s
  const at = (i: number): number => {
    const v = der[i];
    if (v === undefined) throw new Error('DER: truncated');
    return v;
  };
  if (at(0) !== 0x30) throw new Error('DER: not a SEQUENCE');
  let p = 2;
  if (at(1) & 0x80) p = 2 + (at(1) & 0x7f);
  if (at(p) !== 0x02) throw new Error('DER: r not INTEGER');
  let rLen = at(p + 1); let rStart = p + 2;
  if (rLen > 32) { rStart += rLen - 32; rLen = 32; }
  const r = der.slice(rStart, rStart + rLen);
  p = rStart + rLen;
  if (at(p) !== 0x02) throw new Error('DER: s not INTEGER');
  let sLen = at(p + 1); let sStart = p + 2;
  if (sLen > 32) { sStart += sLen - 32; sLen = 32; }
  const s = der.slice(sStart, sStart + sLen);
  const raw = new Uint8Array(64);
  raw.set(r, 32 - r.length);
  raw.set(s, 64 - s.length);
  return raw;
}
