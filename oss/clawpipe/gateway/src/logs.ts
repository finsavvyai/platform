/** Request logs — observability endpoints for project request history. */

import type { Env } from './types';

interface LogRow {
  id: string;
  created_at: string;
  provider: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  cost: number;
  cached: number;
  boosted: number;
  prompt_hash: string;
}

interface CountRow { total: number }

interface LogFilters {
  limit: number;
  offset: number;
  provider?: string;
  model?: string;
  cached?: number;
  boosted?: number;
  from?: string;
  to?: string;
}

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;

/** Parse and clamp query params into typed filters. */
function parseFilters(url: URL): LogFilters {
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '', 10);
  const rawOffset = parseInt(url.searchParams.get('offset') ?? '', 10);
  const limit = Math.min(
    Math.max(isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit, 1),
    MAX_LIMIT,
  );
  const offset = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0);
  const f: LogFilters = { limit, offset };
  const provider = url.searchParams.get('provider');
  const model = url.searchParams.get('model');
  const cached = url.searchParams.get('cached');
  const boosted = url.searchParams.get('boosted');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (provider) f.provider = provider;
  if (model) f.model = model;
  if (cached != null) f.cached = cached === 'true' || cached === '1' ? 1 : 0;
  if (boosted != null) f.boosted = boosted === 'true' || boosted === '1' ? 1 : 0;
  if (from) f.from = from;
  if (to) f.to = to;
  return f;
}

/** Build WHERE fragment and bound params for filters (excluding LIMIT/OFFSET). */
function buildWhere(projectId: string, f: LogFilters): { sql: string; params: unknown[] } {
  const clauses: string[] = ['project_id = ?'];
  const params: unknown[] = [projectId];
  if (f.provider) { clauses.push('provider = ?'); params.push(f.provider); }
  if (f.model) { clauses.push('model = ?'); params.push(f.model); }
  if (f.cached != null) { clauses.push('cached = ?'); params.push(f.cached); }
  if (f.boosted != null) { clauses.push('boosted = ?'); params.push(f.boosted); }
  if (f.from) { clauses.push('created_at >= ?'); params.push(f.from); }
  if (f.to) { clauses.push('created_at <= ?'); params.push(f.to); }
  return { sql: clauses.join(' AND '), params };
}

function mapLog(r: LogRow) {
  return {
    id: r.id,
    timestamp: r.created_at,
    provider: r.provider,
    model: r.model,
    tokens_in: r.tokens_in,
    tokens_out: r.tokens_out,
    latency_ms: r.latency_ms,
    cost: Math.round((r.cost ?? 0) * 10000) / 10000,
    cached: !!r.cached,
    boosted: !!r.boosted,
    prompt_hash: r.prompt_hash,
  };
}

/** GET /v1/logs — recent requests for the authenticated project. */
export async function handleLogsList(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const url = new URL(request.url);
  const f = parseFilters(url);
  const { sql: where, params } = buildWhere(projectId, f);

  const listSql = `
    SELECT id, created_at, provider, model, tokens_in, tokens_out,
           latency_ms, COALESCE(cost, 0) as cost, cached, boosted, prompt_hash
    FROM requests WHERE ${where}
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `;
  const countSql = `SELECT COUNT(*) as total FROM requests WHERE ${where}`;

  const [listRes, countRes] = await Promise.all([
    env.DB.prepare(listSql).bind(...params, f.limit, f.offset).all<LogRow>(),
    env.DB.prepare(countSql).bind(...params).first<CountRow>(),
  ]);

  const total = countRes?.total ?? 0;
  const logs = (listRes.results ?? []).map(mapLog);
  return Response.json({
    logs, total, hasMore: f.offset + logs.length < total,
  });
}

/** GET /v1/logs/:id — full row plus related cache entry if cached. */
export async function handleLogDetail(
  env: Env, projectId: string, id: string,
): Promise<Response> {
  const row = await env.DB.prepare(`
    SELECT id, created_at, provider, model, tokens_in, tokens_out,
           latency_ms, COALESCE(cost, 0) as cost, cached, boosted, prompt_hash
    FROM requests WHERE id = ? AND project_id = ?
  `).bind(id, projectId).first<LogRow>();

  if (!row) return Response.json({ error: 'Log not found' }, { status: 404 });

  const log = mapLog(row);
  let cacheEntry: unknown = null;
  if (row.cached) {
    cacheEntry = await env.DB.prepare(`
      SELECT id, prompt_hash, response, ttl, created_at
      FROM cache_entries WHERE project_id = ? AND prompt_hash = ?
      LIMIT 1
    `).bind(projectId, row.prompt_hash).first().catch(() => null);
  }
  return Response.json({ log, cacheEntry });
}
