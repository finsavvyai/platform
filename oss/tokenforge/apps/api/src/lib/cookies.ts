/**
 * First-party cookie helpers.
 *
 * Per CISCO-dua.md §6.2 the bound cookies are SET on the customer's
 * own origin (not on tokenforge.dev) — we just emit the descriptor
 * the customer's backend forwards. Workforce mode may also set a long
 * cookie pinning the device for IdP step-up.
 */

import type { CookieDescriptor } from '@tokenforge/protocol';

export const SHORT_COOKIE_NAME = 'tf_bound';
export const LONG_COOKIE_NAME = 'tf_session';

export function shortCookieDescriptor(value: string, maxAge: number): CookieDescriptor {
  return {
    name: SHORT_COOKIE_NAME,
    value,
    max_age: maxAge,
    attributes: 'Secure;HttpOnly;SameSite=Lax;Path=/',
  };
}

export function longCookieDescriptor(value: string, maxAge: number): CookieDescriptor {
  return {
    name: LONG_COOKIE_NAME,
    value,
    max_age: maxAge,
    attributes: 'Secure;HttpOnly;SameSite=Lax;Path=/',
  };
}
