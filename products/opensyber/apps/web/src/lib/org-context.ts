/**
 * Extract the active org ID from an incoming request's X-Org-Id header.
 * Used by proxy route handlers to forward org context to the backend API.
 */
export function getOrgIdFromRequest(request: Request): string | null {
  return request.headers.get('X-Org-Id');
}

/**
 * Legacy unscoped key — kept as a constant only so the purge routine can
 * target it by name. New code must use the scoped helpers below so that
 * switching user accounts in the same browser does not inherit a stranger's
 * org selection (root cause of a 403 "not a member of this organization"
 * observed during LinkedIn signin after prior Google signin).
 */
export const ACTIVE_ORG_KEY = 'activeOrgId';

/** Per-user localStorage key. Null userId => no access (caller should skip). */
export function activeOrgKey(userId: string | null | undefined): string | null {
  return userId ? `${ACTIVE_ORG_KEY}:${userId}` : null;
}

export function readActiveOrgId(userId: string | null | undefined): string | null {
  if (typeof window === 'undefined') return null;
  const key = activeOrgKey(userId);
  return key ? window.localStorage.getItem(key) : null;
}

export function writeActiveOrgId(userId: string | null | undefined, orgId: string): void {
  if (typeof window === 'undefined') return;
  const key = activeOrgKey(userId);
  if (key) window.localStorage.setItem(key, orgId);
}

export function clearActiveOrgId(userId: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  const key = activeOrgKey(userId);
  if (key) window.localStorage.removeItem(key);
}

/** Remove the legacy unscoped key left by older builds. Idempotent. */
export function purgeLegacyActiveOrgId(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACTIVE_ORG_KEY);
}

/** Remove every scoped + legacy active-org key. Used on signOut to leave no residue. */
export function purgeAllActiveOrgIds(): void {
  if (typeof window === 'undefined') return;
  const ls = window.localStorage;
  const toRemove: string[] = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k === ACTIVE_ORG_KEY || (k && k.startsWith(`${ACTIVE_ORG_KEY}:`))) {
      toRemove.push(k);
    }
  }
  toRemove.forEach((k) => ls.removeItem(k));
}
