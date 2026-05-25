import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getStore } from '$lib/server/store-singleton.js';

export const GET: RequestHandler = async ({ params }) => {
  const store = getStore();
  const app = await store.getApp(params.id);
  if (!app) throw error(404, 'app_not_found');
  const events = await store.listAuditEvents(app.id, app.tenantId, 5000);

  const header = 'id,app_id,session_id,type,severity,at,payload\n';
  const rows = events.map((e) => {
    const fields = [
      e.id,
      e.appId,
      e.sessionId ?? '',
      e.type,
      e.severity,
      e.at.toISOString(),
      JSON.stringify(e.payload ?? {}),
    ].map(csvEscape);
    return fields.join(',');
  });
  const body = header + rows.join('\n') + '\n';

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-${app.id}.csv"`,
    },
  });
};

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
