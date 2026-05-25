/**
 * Cookie-descriptor → Set-Cookie translator.
 *
 * TokenForge returns `CookieDescriptor` objects (name, value, max_age,
 * attributes). The customer's backend translates each into a real
 * `Set-Cookie` header on the response, so the cookie ends up
 * first-party on the customer's origin (per spec §6.2).
 */

import type { CookieDescriptor } from '@tokenforge/protocol';

export function toSetCookie(d: CookieDescriptor): string {
  return `${d.name}=${d.value}; Max-Age=${d.max_age}; ${d.attributes}`;
}

export function clearCookie(name: string): string {
  return `${name}=; Max-Age=0; Secure; HttpOnly; SameSite=Lax; Path=/`;
}
