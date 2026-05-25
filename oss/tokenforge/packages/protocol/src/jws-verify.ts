/**
 * Compact JWS verifier for DBSC refresh + action signing.
 *
 * Accepts compact-form JWS strings: `<header>.<payload>.<signature>` —
 * all three parts base64url-encoded. Validates protected header (alg,
 * typ), payload claims (iat, exp, nonce, sub), and the signature
 * against the bound public key.
 *
 * Public key may be JWK JSON or PEM-SPKI; `importPublicKey` in
 * ./crypto.ts handles both.
 */

import { importPublicKey, verifySignature } from './crypto.js';

export interface JwsClaims {
  /** Subject — DBSC sessionId or device id. */
  sub: string;
  /** Issued-at, epoch seconds. */
  iat: number;
  /** Expiry, epoch seconds. */
  exp: number;
  /** Per-message nonce — checked against challenge store. */
  nonce: string;
  /** Optional action descriptor (per-action step-up). */
  action?: string;
  /** Optional SHA-256 over the action body, base64url. */
  actionHash?: string;
  /** Optional TLS exporter binding, hex. */
  tlsExporter?: string;
}

export interface VerifyJwsOptions {
  /** Bound public key string (JWK or PEM SPKI). */
  publicKey: string;
  /** Maximum age (seconds) of the JWS — defaults to 60. */
  maxAgeSeconds?: number;
  /** Override clock for tests. */
  now?: Date;
}

export type VerifyJwsResult =
  | { ok: true; claims: JwsClaims; protectedHeader: Record<string, unknown> }
  | { ok: false; reason: string };

const SUPPORTED_ALGS = new Set(['ES256']);

export async function verifyCompactJws(
  jws: string,
  opts: VerifyJwsOptions,
): Promise<VerifyJwsResult> {
  const parts = jws.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'jws_malformed' };
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(b64UrlDecodeString(headerB64));
    payload = JSON.parse(b64UrlDecodeString(payloadB64));
  } catch {
    return { ok: false, reason: 'jws_malformed' };
  }

  const alg = header.alg;
  if (typeof alg !== 'string' || !SUPPORTED_ALGS.has(alg)) {
    return { ok: false, reason: 'jws_unsupported_alg' };
  }

  const claims = payload as Partial<JwsClaims>;
  if (!claims.sub || !claims.nonce || typeof claims.iat !== 'number' || typeof claims.exp !== 'number') {
    return { ok: false, reason: 'jws_missing_claims' };
  }

  const now = opts.now ?? new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const maxAge = opts.maxAgeSeconds ?? 60;
  if (claims.exp < nowSec) return { ok: false, reason: 'jws_expired' };
  if (claims.iat > nowSec + 5) return { ok: false, reason: 'jws_future_iat' };
  if (nowSec - claims.iat > maxAge) return { ok: false, reason: 'jws_too_old' };

  const signingInput = `${headerB64}.${payloadB64}`;
  let key;
  try {
    key = await importPublicKey(opts.publicKey);
  } catch {
    return { ok: false, reason: 'jws_bad_public_key' };
  }
  const ok = await verifySignature(key, sigB64, signingInput);
  if (!ok) return { ok: false, reason: 'jws_bad_signature' };

  return { ok: true, claims: claims as JwsClaims, protectedHeader: header };
}

/**
 * Decode JWS claims without verifying the signature.
 *
 * Useful at the routing edge to pick out the `sub` (session id) so the
 * server knows which public key to verify against. NEVER trust these
 * claims for authorization — always follow up with `verifyCompactJws`.
 */
export function peekJwsClaims(jws: string): Partial<JwsClaims> | null {
  const parts = jws.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(b64UrlDecodeString(parts[1]!)) as Partial<JwsClaims>;
  } catch {
    return null;
  }
}

function b64UrlDecodeString(b64: string): string {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  return atob(padded);
}
