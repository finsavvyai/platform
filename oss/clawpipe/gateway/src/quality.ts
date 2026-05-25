/** Quality score storage — POST /v1/quality and GET /v1/analytics/quality. */

import type { Env } from './types';

interface QualityPayload {
  request_id: string;
  model: string;
  provider: string;
  score: number;
}

function parsePayload(raw: unknown): { ok: true; data: QualityPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'body must be an object' };
  const r = raw as Record<string, unknown>;
  if (typeof r.request_id !== 'string') return { ok: false, error: 'request_id must be a string' };
  if (typeof r.model !== 'string') return { ok: false, error: 'model must be a string' };
  if (typeof r.provider !== 'string') return { ok: false, error: 'provider must be a string' };
  const score = Number(r.score);
  if (isNaN(score) || score < 0 || score > 1) return { ok: false, error: 'score must be a number in [0,1]' };
  return { ok: true, data: { request_id: r.request_id as string, model: r.model as string, provider: r.provider as string, score } };
}

export async function handlePostQuality(req: Request, env: Env, projectId: string): Promise<Response> {
  let raw: unknown;
  try { raw = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = parsePayload(raw);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const { request_id, model, provider, score } = parsed.data;
  try {
    await env.DB.prepare(
      'INSERT INTO quality_scores (request_id, project_id, model, provider, score) VALUES (?,?,?,?,?)',
    ).bind(request_id, projectId, model, provider, score).run();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: 'DB error' }, { status: 500 });
  }
}

export async function handleGetQualityTrend(_req: Request, env: Env, projectId: string): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT date(created_at) as date, model, provider, AVG(score) as avg_score
     FROM quality_scores WHERE project_id=?
     GROUP BY date(created_at), model, provider
     ORDER BY date DESC LIMIT 30`,
  ).bind(projectId).all();
  return Response.json(rows.results);
}
