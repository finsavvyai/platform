/**
 * Short-lived HS256 bridge tokens. Auth.js session cookie → Bearer for
 * portfolio APIs on other Cloudflare Worker subdomains. Tokens are
 * prefixed with `sjwt_` so Bearer handlers can distinguish them from
 * long-lived API keys. Built on @finsavvyai/auth primitives.
 */

import {
  importHs256Secret,
  signToken,
  verifyToken,
  type SigningKey,
} from '@finsavvyai/auth';

const PREFIX = 'sjwt_';
const TTL_SECONDS = 3600;
const ISSUER = 'opensyber.cloud';
const AUDIENCE = 'opensyber-api';

export interface ApiTokenClaims {
  sub: string;
  email: string | null;
}

const keyFor = (secret: string): SigningKey => importHs256Secret(secret);

export async function encodeApiToken(
  userId: string,
  email: string | null | undefined,
  secret: string,
): Promise<string> {
  const { token } = await signToken(keyFor(secret), {
    issuer: ISSUER,
    audience: AUDIENCE,
    subject: userId,
    ttlSeconds: TTL_SECONDS,
    claims: email ? { email } : {},
  });
  return `${PREFIX}${token}`;
}

export async function verifyApiToken(
  token: string,
  secret: string,
): Promise<ApiTokenClaims | null> {
  if (!token.startsWith(PREFIX)) return null;
  const raw = token.slice(PREFIX.length);
  const res = await verifyToken(keyFor(secret), raw, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (!res.ok) return null;
  return {
    sub: res.claims.sub,
    email: typeof res.claims.email === 'string' ? res.claims.email : null,
  };
}

export { PREFIX as SJWT_PREFIX };
