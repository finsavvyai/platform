/**
 * Short-lived bound-cookie issuer for DBSC.
 *
 * Cookie value = base64url(random 32 bytes). We never store the value
 * itself — only its SHA-256 hash. On every refresh the cookie rotates,
 * so a leaked cookie expires within `maxAgeSeconds` and cannot be
 * extended without a fresh JWS-signed refresh.
 *
 * The TLS-exporter binding hook is exposed but optional: workerd does
 * not yet expose RFC 9266 channel-binding material, so we fall through
 * gracefully and emit a `Sec-TF-Channel-Bound: 0` warning header at the
 * route layer when the runtime cannot bind.
 */

const COOKIE_BYTES = 32;
const DEFAULT_MAX_AGE_SECONDS = 300;
const COOKIE_NAME = '__Secure-tf-bound';

export interface BoundCookie {
  /** Opaque value sent to the client. */
  value: string;
  /** SHA-256 hash of value — store this, never the value. */
  hash: string;
  /** Max-Age in seconds. */
  maxAgeSeconds: number;
  /** Issued-at ISO timestamp. */
  issuedAt: string;
  /** Expires-at ISO timestamp. */
  expiresAt: string;
}

export interface IssueBoundCookieOptions {
  maxAgeSeconds?: number;
  /**
   * Optional RFC 9266 TLS exporter material. If present, the cookie
   * hash mixes the exporter so a session can't be replayed across
   * a different TLS connection.
   */
  tlsExporterHex?: string;
}

export async function issueBoundCookie(
  opts: IssueBoundCookieOptions = {},
): Promise<BoundCookie> {
  const bytes = new Uint8Array(COOKIE_BYTES);
  crypto.getRandomValues(bytes);
  const value = bytesToBase64Url(bytes);
  const hash = await hashWithExporter(value, opts.tlsExporterHex);
  const maxAge = opts.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  const issued = new Date();
  const expires = new Date(issued.getTime() + maxAge * 1000);
  return {
    value,
    hash,
    maxAgeSeconds: maxAge,
    issuedAt: issued.toISOString(),
    expiresAt: expires.toISOString(),
  };
}

export async function hashBoundCookie(value: string, tlsExporterHex?: string): Promise<string> {
  return hashWithExporter(value, tlsExporterHex);
}

export function setBoundCookieHeader(cookie: BoundCookie): string {
  return [
    `${COOKIE_NAME}=${cookie.value}`,
    `Max-Age=${cookie.maxAgeSeconds}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
  ].join('; ');
}

export const BOUND_COOKIE_NAME = COOKIE_NAME;

async function hashWithExporter(value: string, exporterHex: string | undefined): Promise<string> {
  const enc = new TextEncoder();
  const input = exporterHex ? `${value}|${exporterHex}` : value;
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return bytesToBase64Url(new Uint8Array(buf));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
