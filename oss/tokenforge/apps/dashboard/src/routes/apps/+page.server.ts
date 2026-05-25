import type { PageServerLoad } from './$types.js';
import { requireTenant } from '$lib/server/context.js';
import { getStore } from '$lib/server/store-singleton.js';

export const load: PageServerLoad = async () => {
  const tenant = await requireTenant();
  const store = getStore();
  const apps = await store.listApps(tenant.id);
  const rows = await Promise.all(
    apps.map(async (a) => ({
      id: a.id,
      name: a.name,
      mode: a.mode,
      origin: a.origin,
      createdAt: a.createdAt.toISOString(),
      activeSessions: await store.countActiveSessions(a.id),
    })),
  );
  return { apps: rows };
};
