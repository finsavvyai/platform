// Shared cryptographic helpers for the PushCI API. All routines run on
// Cloudflare Workers — WebCrypto only, no Node built-ins.
//
// Security properties:
// - timingSafeEqual: constant-time string comparison to block timing
//   side-channel recovery of HMAC-based signatures / tokens.
//
// Consumers:
// - auth.ts          — JWT signature comparison (was `!==`)
// - cepien-integration.ts — webhook HMAC signature verification
// - crypto-envelope.ts    — GCM tag check is handled by WebCrypto, but
//   plaintext key comparisons use this helper.

/**
 * Constant-time string comparison. Returns true iff `a === b`. Runs in
 * O(max(|a|,|b|)) and never short-circuits on the first mismatching
 * character, so timing does not leak prefix equality.
 *
 * Contract: both arguments are strings. Non-ASCII input is compared
 * per-codeunit, which is sufficient for our use (hex digests, base64url
 * JWT signatures, both ASCII). Callers that need raw-byte comparison
 * should encode to hex or base64url first.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
