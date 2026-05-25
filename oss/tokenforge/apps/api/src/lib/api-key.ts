/**
 * App API-key issuance + verification.
 *
 * Live key format: `tfk_live_<appId>.<32-byte b64url secret>`
 * Stored in `apps.api_key_hash` as base64url(SHA-256(secret)).
 *
 * Splitting by `.` lets us look up the row by appId in O(1) before
 * doing the constant-time hash compare. The hash never travels — only
 * the secret half does, exactly once at creation.
 */

import { randomB64Url } from './ids.js';

const KEY_PREFIX = 'tfk_live_';
const SECRET_BYTES = 32;

export interface IssuedApiKey {
  liveKey: string;
  hash: string;
}

export async function issueApiKey(appId: string): Promise<IssuedApiKey> {
  const secret = randomB64Url(SECRET_BYTES);
  const hash = await sha256B64Url(secret);
  return { liveKey: `${KEY_PREFIX}${appId}.${secret}`, hash };
}

export async function verifyApiKey(
  liveKey: string,
  expectedHash: string,
): Promise<{ ok: true; appId: string } | { ok: false }> {
  if (!liveKey.startsWith(KEY_PREFIX)) return { ok: false };
  const rest = liveKey.slice(KEY_PREFIX.length);
  const dot = rest.indexOf('.');
  if (dot <= 0) return { ok: false };
  const appId = rest.slice(0, dot);
  const secret = rest.slice(dot + 1);
  if (!secret) return { ok: false };
  const candidate = await sha256B64Url(secret);
  if (!timingSafeEqual(candidate, expectedHash)) return { ok: false };
  return { ok: true, appId };
}

export function appIdFromKey(liveKey: string): string | null {
  if (!liveKey.startsWith(KEY_PREFIX)) return null;
  const rest = liveKey.slice(KEY_PREFIX.length);
  const dot = rest.indexOf('.');
  if (dot <= 0) return null;
  return rest.slice(0, dot);
}

async function sha256B64Url(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input) as BufferSource,
  );
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
