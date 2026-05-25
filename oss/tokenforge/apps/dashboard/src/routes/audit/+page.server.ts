import type { PageServerLoad } from './$types.js';
import { requireTenant } from '$lib/server/context.js';
import { getStore } from '$lib/server/store-singleton.js';

export const load: PageServerLoad = async ({ url }) => {
  const tenant = await requireTenant();
  const store = getStore();
  const appId = url.searchParams.get('app') || null;
  const events = await store.listAuditEvents(appId, tenant.id, 200);
  const apps = await store.listApps(tenant.id);
  return {
    appId,
    apps: apps.map((a) => ({ id: a.id, name: a.name })),
    events: events.map((e) => ({
      id: e.id,
      appId: e.appId,
      type: e.type,
      severity: e.severity,
      at: e.at.toISOString(),
      payload: e.payload,
    })),
  };
};
