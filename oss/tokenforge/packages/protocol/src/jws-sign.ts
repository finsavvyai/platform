/**
 * Server-side ES256 compact JWS signer.
 *
 * Used by the TokenForge Worker for step-up challenges, internal
 * audit-trail tokens, and JWKS-published service tokens. Browsers do
 * NOT use this — they sign refresh JWS with the bound private key
 * directly via Web Crypto inside `@tokenforge/browser`.
 *
 * Signature format is raw r||s (P1363) so it round-trips with
 * `verifyCompactJws` in ./jws-verify.ts.
 */

import { bytesToBase64Url } from './crypto.js';

export interface SignClaims {
  sub: string;
  iat: number;
  exp: number;
  nonce: string;
  /** Optional fields preserved verbatim. */
  [k: string]: unknown;
}

export interface SignOptions {
  /** Optional header `kid` for JWKS lookup. */
  kid?: string;
  /** Optional header `typ` (default: `JWT`). */
  typ?: string;
}

export async function signCompactJws(
  privateKey: CryptoKey,
  claims: SignClaims,
  opts: SignOptions = {},
): Promise<string> {
  const header: Record<string, unknown> = { alg: 'ES256', typ: opts.typ ?? 'JWT' };
  if (opts.kid) header.kid = opts.kid;
  const headerB64 = jsonToBase64Url(header);
  const payloadB64 = jsonToBase64Url(claims);
  const input = `${headerB64}.${payloadB64}`;
  const sigBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(input) as BufferSource,
  );
  const sigB64 = bytesToBase64Url(new Uint8Array(sigBuf));
  return `${input}.${sigB64}`;
}

function jsonToBase64Url(value: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}
