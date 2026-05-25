import type { PageServerLoad } from './$types.js';
import { requireTenant } from '$lib/server/context.js';
import { getStore } from '$lib/server/store-singleton.js';

export const load: PageServerLoad = async () => {
  const tenant = await requireTenant();
  const store = getStore();
  const apps = await store.listApps(tenant.id);
  let activeSessions = 0;
  for (const a of apps) activeSessions += await store.countActiveSessions(a.id);
  const recentAudit = await store.listAuditEvents(null, tenant.id, 5);
  return {
    tenant: { id: tenant.id, name: tenant.name, plan: tenant.plan },
    counts: { apps: apps.length, activeSessions, audit: recentAudit.length },
    recentAudit: recentAudit.map((e) => ({
      id: e.id,
      type: e.type,
      severity: e.severity,
      at: e.at.toISOString(),
    })),
  };
};
