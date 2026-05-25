/**
 * App API-key generator.
 *
 * MUST stay byte-compatible with `apps/api/src/lib/api-key.ts` so a
 * key issued by the dashboard verifies against the API Worker. Both
 * sides use SHA-256 of the secret half + timing-safe compare.
 */

import { randomB64Url } from './ids.js';

const KEY_PREFIX = 'tfk_live_';
const SECRET_BYTES = 32;

export interface IssuedApiKey {
  /** The full live key — show ONCE then discard. */
  liveKey: string;
  /** Stable hash to persist in `apps.api_key_hash`. */
  hash: string;
}

export async function issueApiKey(appId: string): Promise<IssuedApiKey> {
  const secret = randomB64Url(SECRET_BYTES);
  const hash = await sha256B64Url(secret);
  return { liveKey: `${KEY_PREFIX}${appId}.${secret}`, hash };
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
