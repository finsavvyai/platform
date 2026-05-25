/**
 * W3C Device Bound Session Credentials registration JWT verifier.
 *
 * Native DBSC posts a single compact JWS whose `protected` header
 * carries the device public key (`jwk` field) and whose payload binds
 * the registration to a specific challenge. We verify the signature
 * using that same in-band public key, then return the JWK to the
 * caller so the session row stores the device key directly.
 *
 *   header:  { alg: "ES256", typ: "jwt", jwk: { kty:"EC", crv:"P-256", x, y } }
 *   payload: { aud: <registration_url>, jti: <challenge> }
 */

import { importPublicKey, verifySignature } from './crypto.js';

export interface DbscRegistrationClaims {
  /** Audience — the registration URL the JWT was minted for. */
  aud: string;
  /** Single-use challenge issued by the server. */
  jti: string;
  /** Optional issued-at, epoch seconds. */
  iat?: number;
  /** Optional subject hint passed by the customer's backend. */
  sub?: string;
}

export interface VerifyDbscRegistrationOptions {
  /** Expected audience — registration URL. */
  expectedAud: string;
  /** Expected challenge — the one that was just issued. */
  expectedJti: string;
}

export type VerifyDbscRegistrationResult =
  | { ok: true; jwk: JsonWebKey; claims: DbscRegistrationClaims }
  | { ok: false; reason: string };

const SUPPORTED_ALGS = new Set(['ES256']);

export async function verifyDbscRegistrationJwt(
  jws: string,
  opts: VerifyDbscRegistrationOptions,
): Promise<VerifyDbscRegistrationResult> {
  const parts = jws.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'jws_malformed' };
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(b64UrlDecode(headerB64));
    payload = JSON.parse(b64UrlDecode(payloadB64));
  } catch {
    return { ok: false, reason: 'jws_malformed' };
  }

  const alg = header.alg;
  if (typeof alg !== 'string' || !SUPPORTED_ALGS.has(alg)) {
    return { ok: false, reason: 'jws_unsupported_alg' };
  }

  const jwk = header.jwk as JsonWebKey | undefined;
  if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y) {
    return { ok: false, reason: 'jws_missing_jwk' };
  }

  const claims = payload as Partial<DbscRegistrationClaims>;
  if (!claims.aud || !claims.jti) return { ok: false, reason: 'jws_missing_claims' };
  if (claims.aud !== opts.expectedAud) return { ok: false, reason: 'aud_mismatch' };
  if (claims.jti !== opts.expectedJti) return { ok: false, reason: 'jti_mismatch' };

  let key;
  try {
    key = await importPublicKey(JSON.stringify(jwk));
  } catch {
    return { ok: false, reason: 'jws_bad_public_key' };
  }
  const ok = await verifySignature(key, sigB64, `${headerB64}.${payloadB64}`);
  if (!ok) return { ok: false, reason: 'jws_bad_signature' };

  return {
    ok: true,
    jwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, alg: 'ES256', use: 'sig' },
    claims: claims as DbscRegistrationClaims,
  };
}

/**
 * Build the `Sec-Session-Registration` response header per W3C DBSC.
 *
 *   Sec-Session-Registration: (ES256);path="<registration_url>";challenge="<b64>"
 */
export function secSessionRegistrationHeader(opts: {
  registrationPath: string;
  challenge: string;
  algorithm?: string;
}): string {
  const alg = opts.algorithm ?? 'ES256';
  return `(${alg});path="${opts.registrationPath}";challenge="${opts.challenge}"`;
}

function b64UrlDecode(b64: string): string {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  return atob(padded);
}
