import type { TokenForgeServerOptions } from '../shared/types.js';

/**
 * Callback surface for TOTP attempt rate-limiting. Callers plug in a
 * storage-backed counter (KV, Redis, D1); when absent, lockout is
 * disabled and the caller MUST enforce rate-limiting elsewhere.
 *
 *  - `getFailedAttempts(userId)` returns the number of failed TOTP
 *    verifications for the user within the current lockout window.
 *  - `recordFailedAttempt(userId)` atomically increments the counter
 *    and sets a TTL of `windowSeconds`.
 *  - `resetFailedAttempts(userId)` clears the counter on a successful
 *    verification.
 */
export interface TotpRateLimiter {
  getFailedAttempts(userId: string): Promise<number>;
  recordFailedAttempt(userId: string, windowSeconds: number): Promise<void>;
  resetFailedAttempts(userId: string): Promise<void>;
}

export const TOTP_MAX_ATTEMPTS = 5;
export const TOTP_LOCKOUT_WINDOW_SECONDS = 300; // 5 min — matches the OWASP ASVS V6.2.6 guidance

export class TotpLockedOutError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(`Too many failed TOTP attempts; locked out for ${retryAfterSeconds}s`);
    this.name = 'TotpLockedOutError';
  }
}

/**
 * TOTP verification (RFC 6238) using HMAC-SHA1.
 * Time step: 30 seconds, window: +/-1 step tolerance.
 *
 * Rate-limiting: when `options.rateLimiter` is provided, the user is
 * locked out for TOTP_LOCKOUT_WINDOW_SECONDS after TOTP_MAX_ATTEMPTS
 * failures. A TotpLockedOutError is thrown while locked so callers can
 * return a distinct 429 to the client instead of a generic "invalid
 * code". A successful verification resets the counter immediately.
 *
 * @param code - The 6-digit TOTP code from the user.
 * @param userId - User whose TOTP secret to look up.
 * @param options - Server options; must include `getTotpSecret` callback.
 * @returns True if the code is valid for the current or adjacent time window.
 * @throws TotpLockedOutError if the user is currently locked out.
 */
export async function verifyTotp(
  code: string,
  userId: string,
  options: TokenForgeServerOptions & {
    getTotpSecret?: (userId: string) => Promise<string | null>;
    rateLimiter?: TotpRateLimiter;
  },
): Promise<boolean> {
  if (!options.getTotpSecret) return false;

  const limiter = options.rateLimiter;
  if (limiter) {
    const attempts = await limiter.getFailedAttempts(userId);
    if (attempts >= TOTP_MAX_ATTEMPTS) {
      throw new TotpLockedOutError(TOTP_LOCKOUT_WINDOW_SECONDS);
    }
  }

  const secret = await options.getTotpSecret(userId);
  if (!secret) {
    if (limiter) await limiter.recordFailedAttempt(userId, TOTP_LOCKOUT_WINDOW_SECONDS);
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const timeStep = 30;

  // Check current window and ±1 step for clock skew tolerance
  for (const offset of [-1, 0, 1]) {
    const counter = Math.floor((now + offset * timeStep) / timeStep);
    const expected = await generateTotp(secret, counter);
    if (timingSafeEqual(code, expected)) {
      if (limiter) await limiter.resetFailedAttempts(userId);
      return true;
    }
  }

  if (limiter) await limiter.recordFailedAttempt(userId, TOTP_LOCKOUT_WINDOW_SECONDS);
  return false;
}

/**
 * Generate a TOTP code for a given counter value.
 * Uses HMAC-SHA1 per RFC 4226, with 6-digit output.
 * @param secretBase32 - Base32-encoded shared secret.
 * @param counter - HMAC counter value (typically `floor(time / 30)`).
 * @returns A 6-digit zero-padded TOTP code.
 */
export async function generateTotp(secretBase32: string, counter: number): Promise<string> {
  const keyBytes = base32Decode(secretBase32);
  const counterBytes = new ArrayBuffer(8);
  const view = new DataView(counterBytes);
  view.setBigUint64(0, BigInt(counter));

  const key = await crypto.subtle.importKey(
    'raw', keyBytes.buffer as ArrayBuffer, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const hmac = await crypto.subtle.sign('HMAC', key, counterBytes);
  const hmacArray = new Uint8Array(hmac);

  // Dynamic truncation (RFC 4226 section 5.3)
  const offset = hmacArray[hmacArray.length - 1]! & 0x0f;
  const binary =
    ((hmacArray[offset]! & 0x7f) << 24) |
    ((hmacArray[offset + 1]! & 0xff) << 16) |
    ((hmacArray[offset + 2]! & 0xff) << 8) |
    (hmacArray[offset + 3]! & 0xff);

  return (binary % 1000000).toString().padStart(6, '0');
}

/** Decode a base32-encoded string (RFC 4648, no padding required) */
function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.replace(/[= ]/g, '').toUpperCase();
  const bits: number[] = [];

  for (const char of clean) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    for (let i = 4; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | (bits[i * 8 + j] ?? 0);
    }
    bytes[i] = byte;
  }
  return bytes;
}

/** Constant-time string comparison to prevent timing attacks */
function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let result = a.length ^ b.length; // length mismatch contributes to failure
  for (let i = 0; i < maxLen; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return result === 0;
}
