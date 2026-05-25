/** CSV export endpoint — stream request rows for finance systems. */

import type { Env } from './types';
import { getAuthUser, checkProjectAccess } from './auth/rbac';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Escape a CSV field per RFC 4180. */
export function csvEscape(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build a CSV line from an array of cell values. */
export function csvLine(cells: unknown[]): string {
  return cells.map(csvEscape).join(',');
}

/** Validate & coerce ISO date, fall back to default. */
function parseDate(raw: string | null, fallback: string): string {
  return raw && ISO_DATE.test(raw) ? raw : fallback;
}

/** Last 30 days default (UTC). */
function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 3600 * 1000);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/** GET /v1/projects/:id/export.csv */
export async function handleExportCsv(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await checkProjectAccess(env, user.sub, projectId, 'admin');
  if (!access) return Response.json({ error: 'Only admins can export data' }, { status: 403 });

  const url = new URL(request.url);
  const dflt = defaultRange();
  const from = parseDate(url.searchParams.get('from'), dflt.from);
  const to = parseDate(url.searchParams.get('to'), dflt.to);

  const rows = await env.DB.prepare(`
    SELECT created_at, provider, model, tokens_in, tokens_out,
           latency_ms, cost, cached, boosted, session_id
    FROM requests
    WHERE project_id = ?
      AND date(created_at) >= ?
      AND date(created_at) <= ?
    ORDER BY created_at DESC
    LIMIT 50000
  `).bind(projectId, from, to).all<{
    created_at: string; provider: string; model: string;
    tokens_in: number; tokens_out: number; latency_ms: number;
    cost: number; cached: number; boosted: number; session_id: string | null;
  }>();

  const header = csvLine([
    'timestamp', 'provider', 'model', 'tokens_in', 'tokens_out',
    'latency_ms', 'cost_usd', 'cached', 'boosted', 'session_id',
  ]);

  const lines = (rows.results ?? []).map((r) => csvLine([
    r.created_at, r.provider, r.model, r.tokens_in, r.tokens_out,
    r.latency_ms, r.cost.toFixed(6), r.cached, r.boosted, r.session_id ?? '',
  ]));

  const body = [header, ...lines].join('\n') + '\n';
  const filename = `clawpipe-${projectId}-${from}-to-${to}.csv`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/** Dispatch /v1/projects/:id/export.csv. */
export async function routeExport(
  request: Request, env: Env, path: string, method: string,
): Promise<Response | null> {
  const match = path.match(/^\/v1\/projects\/([^/]+)\/export\.csv$/);
  if (match && method === 'GET') return handleExportCsv(request, env, match[1]);
  return null;
}
