import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { getStore } from '$lib/server/store-singleton.js';

export const load: PageServerLoad = async ({ params }) => {
  const store = getStore();
  const app = await store.getApp(params.id);
  if (!app) throw error(404, 'app_not_found');
  const sessionsCount = await store.countActiveSessions(app.id);
  const recentAudit = await store.listAuditEvents(app.id, app.tenantId, 10);
  return {
    app: {
      id: app.id,
      name: app.name,
      origin: app.origin,
      mode: app.mode,
      createdAt: app.createdAt.toISOString(),
      shortCookieTtlSec: app.shortCookieTtlSec,
      longCookieTtlSec: app.longCookieTtlSec,
    },
    sessionsCount,
    recentAudit: recentAudit.map((e) => ({
      id: e.id,
      type: e.type,
      severity: e.severity,
      at: e.at.toISOString(),
    })),
  };
};
