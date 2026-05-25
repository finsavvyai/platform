/**
 * DBSC (Device Bound Session Credentials) verification for the
 * verifyRequest pipeline. Additive check — never blocks when ECDSA
 * already passed, but sets degraded status and rotation flags.
 */

import { hashBoundCookie, BOUND_COOKIE_NAME } from './bound-cookie.js';
import type { DbscConfig, DeviceSession } from '../shared/types.js';

const DEFAULT_COOKIE_NAME = BOUND_COOKIE_NAME;
const DEFAULT_ROTATION_INTERVAL = 300;

/** Result of the DBSC cookie verification step. */
export interface DbscCheckResult {
  /** Whether the bound cookie is valid. */
  cookieValid: boolean;
  /** Reason for degradation (if any). */
  reason?: 'cookie_missing' | 'cookie_invalid';
  /** True if the cookie should be rotated (near expiry). */
  rotateCookie: boolean;
}

/**
 * Parse a specific cookie value from a raw Cookie header string.
 * @param cookieHeader - Raw `Cookie` header value (e.g. "a=1; b=2").
 * @param name - Cookie name to look up.
 * @returns The cookie value, or null if not found.
 */
export function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    if (key === name) return pair.slice(eqIdx + 1).trim();
  }
  return null;
}

/**
 * Run the DBSC bound-cookie check against a device session.
 *
 * @param cookieHeader - Raw Cookie header from the request.
 * @param session - The device session (must include bound_cookie_hash).
 * @param dbsc - DBSC configuration.
 * @returns Check result with validity, reason, and rotation flag.
 */
export async function verifyDbscCookie(
  cookieHeader: string | null,
  session: DeviceSession,
  dbsc: DbscConfig,
): Promise<DbscCheckResult> {
  const cookieName = dbsc.cookieName ?? DEFAULT_COOKIE_NAME;
  const rotationInterval = dbsc.rotationInterval ?? DEFAULT_ROTATION_INTERVAL;

  const cookieValue = parseCookie(cookieHeader, cookieName);
  if (!cookieValue) {
    return { cookieValid: false, reason: 'cookie_missing', rotateCookie: false };
  }

  const storedHash = session.bound_cookie_hash;
  if (!storedHash) {
    return { cookieValid: false, reason: 'cookie_missing', rotateCookie: false };
  }

  const computedHash = await hashBoundCookie(cookieValue);
  if (computedHash !== storedHash) {
    return { cookieValid: false, reason: 'cookie_invalid', rotateCookie: false };
  }

  // Check if cookie is near expiry (< half rotation interval remaining)
  const rotateCookie = isCookieNearExpiry(
    session.bound_cookie_expires_at,
    rotationInterval,
  );

  return { cookieValid: true, rotateCookie };
}

/** True when the cookie has less than half its rotation interval remaining. */
function isCookieNearExpiry(
  expiresAt: string | null | undefined,
  rotationInterval: number,
): boolean {
  if (!expiresAt) return true;
  const expiresMs = new Date(expiresAt).getTime();
  const now = Date.now();
  const remainingSeconds = (expiresMs - now) / 1000;
  return remainingSeconds < rotationInterval / 2;
}
