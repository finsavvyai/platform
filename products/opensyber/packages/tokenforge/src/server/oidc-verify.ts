/**
 * OIDC ID-token verifier (Sprint 40 — workforce mode).
 *
 * Verifies an OIDC ID token against an IdP's JWKS by `kid`. Supports
 * RS256 + ES256 — the algorithms that Okta, Entra, Google Workspace,
 * and Auth0 ship by default. Stateless: the JWKS is passed in, so
 * caching/HTTP lives one layer up (see jwks-cache.ts).
 *
 * Validates signature, `iss`, `aud`, `exp`, `nbf`, `iat`. Returns the
 * verified claims so the caller can extract `sub` and link it to a
 * subject row before issuing a DBSC challenge.
 */

export interface OidcClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nbf?: number;
  email?: string;
  name?: string;
  groups?: string[];
  [key: string]: unknown;
}

export interface JwksKey {
  kid: string;
  kty: 'RSA' | 'EC';
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
  crv?: string;
  x?: string;
  y?: string;
}

export interface VerifyOidcOptions {
  expectedIssuer: string;
  expectedAudience: string;
  jwks: { keys: JwksKey[] };
  /** Override for tests. */
  now?: Date;
  /** Clock skew tolerance in seconds (default 60). */
  clockSkewSeconds?: number;
}

export type VerifyOidcResult =
  | { ok: true; claims: OidcClaims; protectedHeader: Record<string, unknown> }
  | { ok: false; reason: string };

const SUPPORTED_ALGS = new Set(['RS256', 'ES256']);

export async function verifyOidcIdToken(
  jwt: string,
  opts: VerifyOidcOptions,
): Promise<VerifyOidcResult> {
  const parts = jwt.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'jwt_malformed' };
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  let header: Record<string, unknown>;
  let claims: OidcClaims;
  try {
    header = JSON.parse(b64UrlDecodeString(headerB64));
    claims = JSON.parse(b64UrlDecodeString(payloadB64)) as OidcClaims;
  } catch {
    return { ok: false, reason: 'jwt_malformed' };
  }

  const alg = header.alg;
  const kid = header.kid;
  if (typeof alg !== 'string' || !SUPPORTED_ALGS.has(alg)) {
    return { ok: false, reason: 'jwt_unsupported_alg' };
  }
  if (typeof kid !== 'string') return { ok: false, reason: 'jwt_missing_kid' };

  const key = opts.jwks.keys.find((k) => k.kid === kid);
  if (!key) return { ok: false, reason: 'jwks_kid_not_found' };

  if (claims.iss !== opts.expectedIssuer) return { ok: false, reason: 'iss_mismatch' };
  const audMatch = Array.isArray(claims.aud)
    ? claims.aud.includes(opts.expectedAudience)
    : claims.aud === opts.expectedAudience;
  if (!audMatch) return { ok: false, reason: 'aud_mismatch' };

  const now = opts.now ?? new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const skew = opts.clockSkewSeconds ?? 60;
  if (typeof claims.exp !== 'number' || claims.exp + skew < nowSec) {
    return { ok: false, reason: 'jwt_expired' };
  }
  if (typeof claims.nbf === 'number' && claims.nbf - skew > nowSec) {
    return { ok: false, reason: 'jwt_not_yet_valid' };
  }
  if (typeof claims.iat !== 'number' || claims.iat - skew > nowSec) {
    return { ok: false, reason: 'jwt_future_iat' };
  }

  const cryptoKey = await importJwk(key, alg);
  if (!cryptoKey) return { ok: false, reason: 'jwks_bad_key' };

  const signingInput = toAb(new TextEncoder().encode(`${headerB64}.${payloadB64}`));
  const signatureBytes = base64UrlToBytes(sigB64);
  if (!signatureBytes) return { ok: false, reason: 'jwt_bad_signature' };
  const signature = toAb(signatureBytes);

  const verified = alg === 'RS256'
    ? await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signingInput)
    : await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, signature, signingInput);
  if (!verified) return { ok: false, reason: 'jwt_bad_signature' };

  return { ok: true, claims, protectedHeader: header };
}

async function importJwk(key: JwksKey, alg: string): Promise<CryptoKey | null> {
  try {
    if (alg === 'RS256') {
      return await crypto.subtle.importKey(
        'jwk',
        { kty: key.kty, n: key.n, e: key.e, alg, ext: true } as JsonWebKey,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      );
    }
    return await crypto.subtle.importKey(
      'jwk',
      { kty: key.kty, crv: key.crv, x: key.x, y: key.y, ext: true } as JsonWebKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
  } catch {
    return null;
  }
}

function b64UrlDecodeString(b64: string): string {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  return atob(padded);
}

function toAb(u8: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(u8.byteLength);
  new Uint8Array(buf).set(u8);
  return buf;
}

function base64UrlToBytes(b64: string): Uint8Array | null {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  try {
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
