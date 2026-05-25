/**
 * Auth-context shim.
 *
 * Phase 6 returns the demo tenant for every request so the UI flows
 * are exercisable without Better Auth wiring. Phase 6.1 will read the
 * Better Auth session cookie, look up the tenant, and gate the
 * routes.
 */

import { DEMO_TENANT_ID, getStore } from './store-singleton.js';
import type { DashboardTenant } from './store.js';

export async function requireTenant(): Promise<DashboardTenant> {
  const store = getStore();
  const t = await store.getTenant(DEMO_TENANT_ID);
  if (!t) throw new Error('demo tenant missing');
  return t;
}
