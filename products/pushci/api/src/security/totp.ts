// TOTP verification + generation, RFC 6238 (HMAC-SHA1, 30s step, ±1 skew).
//
// Vendored from @opensyber/tokenforge v0.1.1 (packages/tokenforge/src/server/totp.ts)
// on 2026-04-22 for PushCI v1.7.0 enterprise MFA. Kept as a vendored copy
// rather than an npm dependency so this file can be security-reviewed
// alongside the rest of api/src/ and so the Workers bundle stays
// dependency-free. Upgrade by diffing against opensyber upstream.
//
// Implementation notes:
// - Constant-time comparison to defeat timing attacks.
// - ±1 step tolerance (RFC 6238 §5.2) for clock skew.
// - Base32 decode is RFC 4648 with padding stripped.
// - Rate-limiting is the caller's responsibility; see mfa-routes.ts.

export const TOTP_MAX_ATTEMPTS = 5;
export const TOTP_LOCKOUT_WINDOW_SECONDS = 300; // OWASP ASVS V6.2.6

export class TotpLockedOutError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(`Too many failed TOTP attempts; locked out for ${retryAfterSeconds}s`);
    this.name = "TotpLockedOutError";
  }
}

export interface TotpRateLimiter {
  getFailedAttempts(userId: string): Promise<number>;
  recordFailedAttempt(userId: string, windowSeconds: number): Promise<void>;
  resetFailedAttempts(userId: string): Promise<void>;
}

export interface VerifyTotpOptions {
  getTotpSecret: (userId: string) => Promise<string | null>;
  rateLimiter?: TotpRateLimiter;
}

/** Verify a 6-digit code against the user's stored secret. Returns false on
 *  miss; throws TotpLockedOutError if the rate-limiter is tripped. */
export async function verifyTotp(
  code: string,
  userId: string,
  opts: VerifyTotpOptions,
): Promise<boolean> {
  const limiter = opts.rateLimiter;
  if (limiter) {
    const attempts = await limiter.getFailedAttempts(userId);
    if (attempts >= TOTP_MAX_ATTEMPTS) {
      throw new TotpLockedOutError(TOTP_LOCKOUT_WINDOW_SECONDS);
    }
  }

  const secret = await opts.getTotpSecret(userId);
  if (!secret) {
    if (limiter) await limiter.recordFailedAttempt(userId, TOTP_LOCKOUT_WINDOW_SECONDS);
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const step = 30;
  for (const offset of [-1, 0, 1]) {
    const counter = Math.floor((now + offset * step) / step);
    const expected = await generateTotp(secret, counter);
    if (timingSafeEqual(code, expected)) {
      if (limiter) await limiter.resetFailedAttempts(userId);
      return true;
    }
  }

  if (limiter) await limiter.recordFailedAttempt(userId, TOTP_LOCKOUT_WINDOW_SECONDS);
  return false;
}

/** Generate a 6-digit TOTP for a specific counter. Used by enrollment flows
 *  to render the first verification code in the setup UI. */
export async function generateTotp(
  secretBase32: string,
  counter: number,
): Promise<string> {
  const keyBytes = base32Decode(secretBase32);
  const counterBytes = new ArrayBuffer(8);
  new DataView(counterBytes).setBigUint64(0, BigInt(counter));

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes));

  const offset = hmac[hmac.length - 1]! & 0x0f;
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (bin % 1_000_000).toString().padStart(6, "0");
}

/** Generate a fresh 160-bit (20-byte) TOTP secret, base32-encoded per
 *  RFC 4648. 160 bits is the RFC 4226 §4 recommended minimum for HMAC-SHA1. */
export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

/** Build an otpauth://totp URI for QR code rendering (Google Authenticator,
 *  1Password, Authy, Yubico Authenticator all consume this format). */
export function buildOtpauthUri(
  issuer: string,
  accountName: string,
  secret: string,
): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function base32Decode(input: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/[= ]/g, "").toUpperCase();
  const bits: number[] = [];
  for (const ch of clean) {
    const v = alphabet.indexOf(ch);
    if (v === -1) continue;
    for (let i = 4; i >= 0; i--) bits.push((v >> i) & 1);
  }
  const out = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i * 8 + j] ?? 0);
    out[i] = byte;
  }
  return out;
}

function base32Encode(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    out += alphabet[parseInt(chunk, 2)]!;
  }
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length);
  let r = a.length ^ b.length;
  for (let i = 0; i < max; i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0;
}
