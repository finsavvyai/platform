import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getStore } from '$lib/server/store-singleton.js';

export const GET: RequestHandler = async ({ params }) => {
  const store = getStore();
  const app = await store.getApp(params.id);
  if (!app) throw error(404, 'app_not_found');
  const events = await store.listAuditEvents(app.id, app.tenantId, 5000);

  const body = JSON.stringify(
    {
      app_id: app.id,
      generated_at: new Date().toISOString(),
      event_count: events.length,
      events: events.map((e) => ({
        id: e.id,
        app_id: e.appId,
        session_id: e.sessionId,
        type: e.type,
        severity: e.severity,
        at: e.at.toISOString(),
        payload: e.payload,
      })),
    },
    null,
    2,
  );

  return new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="audit-${app.id}.json"`,
    },
  });
};
