/** Weight persistence endpoints — save/load router weights in D1. */

import type { Env } from './types';

interface WeightRow {
  provider: string;
  model: string;
  total_calls: number;
  avg_latency_ms: number;
  avg_tokens_out: number;
  score: number;
}

interface WeightPayload {
  provider: string;
  model: string;
  totalCalls: number;
  avgLatencyMs: number;
  avgTokensOut: number;
  score: number;
}

/** GET /v1/weights — load all weights for a project. */
export async function handleGetWeights(
  env: Env, projectId: string,
): Promise<Response> {
  const rows = await env.DB.prepare(
    'SELECT provider, model, total_calls, avg_latency_ms, avg_tokens_out, score FROM weight_history WHERE project_id = ?',
  ).bind(projectId).all<WeightRow>();

  const weights = (rows.results ?? []).map((r) => ({
    provider: r.provider,
    model: r.model,
    totalCalls: r.total_calls,
    avgLatencyMs: r.avg_latency_ms,
    avgTokensOut: r.avg_tokens_out,
    score: r.score,
  }));

  return Response.json({ weights });
}

/** PUT /v1/weights — save/update weights for a project. */
export async function handlePutWeights(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  let body: { weights: WeightPayload[] };
  try {
    body = await request.json() as { weights: WeightPayload[] };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.weights)) {
    return Response.json({ error: 'Missing weights array' }, { status: 400 });
  }

  const stmt = env.DB.prepare(
    `INSERT INTO weight_history (id, project_id, provider, model, total_calls, avg_latency_ms, avg_tokens_out, score, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (project_id, provider, model)
     DO UPDATE SET total_calls = ?, avg_latency_ms = ?, avg_tokens_out = ?, score = ?, updated_at = datetime('now')`,
  );

  const batch = body.weights.map((w) =>
    stmt.bind(
      crypto.randomUUID(), projectId, w.provider, w.model,
      w.totalCalls, w.avgLatencyMs, w.avgTokensOut, w.score,
      w.totalCalls, w.avgLatencyMs, w.avgTokensOut, w.score,
    ),
  );

  if (batch.length > 0) {
    await env.DB.batch(batch);
  }

  return Response.json({ saved: batch.length });
}
