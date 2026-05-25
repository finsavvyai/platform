/**
 * OIDC ID-token verifier.
 *
 * Used in workforce mode: the customer's backend has already done
 * the OAuth redirect dance with their IdP (Okta / Entra / Auth0 /
 * Google Workspace) and now hands TokenForge the resulting
 * `id_token`. We verify the signature against the IdP's JWKS, check
 * `iss` / `aud` / `exp`, and return the claims so the caller can use
 * `sub` to bind a session.
 *
 * RS256 + ES256 are supported — the two algs every commercial IdP
 * either ships or can be configured to use.
 */

import { bytesToBase64Url, base64UrlToBytes } from './crypto.js';

export interface IdTokenClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  [k: string]: unknown;
}

export interface JwksKey {
  kty: 'RSA' | 'EC';
  use?: string;
  alg?: string;
  kid?: string;
  n?: string;
  e?: string;
  crv?: string;
  x?: string;
  y?: string;
}

export interface VerifyIdTokenOptions {
  jwks: { keys: JwksKey[] };
  expectedIssuer: string;
  expectedAudience: string;
  /** Optional nonce check (recommended for OIDC). */
  expectedNonce?: string;
  /** Override clock for tests. */
  now?: Date;
}

export type VerifyIdTokenResult =
  | { ok: true; claims: IdTokenClaims }
  | { ok: false; reason: string };

const SUPPORTED_ALGS = new Set(['RS256', 'ES256']);

export async function verifyIdToken(
  idToken: string,
  opts: VerifyIdTokenOptions,
): Promise<VerifyIdTokenResult> {
  const parts = idToken.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'jws_malformed' };
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  let header: Record<string, unknown>;
  let claims: Partial<IdTokenClaims>;
  try {
    header = JSON.parse(b64UrlDecode(headerB64));
    claims = JSON.parse(b64UrlDecode(payloadB64));
  } catch {
    return { ok: false, reason: 'jws_malformed' };
  }

  const alg = header.alg;
  if (typeof alg !== 'string' || !SUPPORTED_ALGS.has(alg)) {
    return { ok: false, reason: 'unsupported_alg' };
  }

  if (claims.iss !== opts.expectedIssuer) return { ok: false, reason: 'iss_mismatch' };
  if (!matchesAudience(claims.aud, opts.expectedAudience)) return { ok: false, reason: 'aud_mismatch' };
  if (typeof claims.exp !== 'number' || typeof claims.iat !== 'number' || !claims.sub) {
    return { ok: false, reason: 'missing_claims' };
  }
  const nowSec = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  if (claims.exp < nowSec) return { ok: false, reason: 'expired' };
  if (opts.expectedNonce && claims.nonce !== opts.expectedNonce) {
    return { ok: false, reason: 'nonce_mismatch' };
  }

  const kid = (header.kid as string | undefined) ?? null;
  const key = pickKey(opts.jwks.keys, alg, kid);
  if (!key) return { ok: false, reason: 'no_matching_jwk' };

  const cryptoKey = await importJwk(key, alg);
  const sigBytes = base64UrlToBytes(sigB64);
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const ok = await crypto.subtle.verify(
    algParams(alg),
    cryptoKey,
    sigBytes as BufferSource,
    signingInput as BufferSource,
  );
  if (!ok) return { ok: false, reason: 'bad_signature' };

  return { ok: true, claims: claims as IdTokenClaims };
}

function pickKey(keys: JwksKey[], alg: string, kid: string | null): JwksKey | null {
  if (kid) {
    const byKid = keys.find((k) => k.kid === kid);
    if (byKid) return byKid;
  }
  // Fall through to the first key matching the alg family.
  return keys.find((k) => (alg === 'RS256' ? k.kty === 'RSA' : k.kty === 'EC')) ?? null;
}

function matchesAudience(aud: string | string[] | undefined, expected: string): boolean {
  if (typeof aud === 'string') return aud === expected;
  if (Array.isArray(aud)) return aud.includes(expected);
  return false;
}

async function importJwk(key: JwksKey, alg: string): Promise<CryptoKey> {
  const params = alg === 'RS256'
    ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
    : { name: 'ECDSA', namedCurve: 'P-256' };
  return crypto.subtle.importKey(
    'jwk',
    key as JsonWebKey,
    params,
    false,
    ['verify'],
  );
}

function algParams(alg: string): AlgorithmIdentifier {
  if (alg === 'RS256') return { name: 'RSASSA-PKCS1-v1_5' } as AlgorithmIdentifier;
  return { name: 'ECDSA', hash: { name: 'SHA-256' } } as AlgorithmIdentifier;
}

function b64UrlDecode(b64: string): string {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  return atob(padded);
}

// Re-export helpers from crypto.ts for callers building tokens.
export { bytesToBase64Url, base64UrlToBytes };
