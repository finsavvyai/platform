import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { getStore } from '$lib/server/store-singleton.js';

export const load: PageServerLoad = async ({ params }) => {
  const store = getStore();
  const app = await store.getApp(params.id);
  if (!app) throw error(404, 'app_not_found');
  const events = await store.listAuditEvents(app.id, app.tenantId, 1000);
  return {
    app: { id: app.id, name: app.name },
    eventCount: events.length,
    eventTypes: countEventTypes(events.map((e) => e.type)),
    earliest: events.length > 0 ? events[events.length - 1]!.at.toISOString() : null,
    latest: events.length > 0 ? events[0]!.at.toISOString() : null,
  };
};

function countEventTypes(types: string[]): { type: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}
