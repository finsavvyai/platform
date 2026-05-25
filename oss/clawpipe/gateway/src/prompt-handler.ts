/** Extracted /v1/prompt handler — validates, enforces quotas + budgets, dispatches to provider. */

import type { Env, PromptRequest, PromptResponse } from './types';
import { getAdapter, getApiKey } from './providers/registry';
import { requestLogger } from './logger';
import { isWithinLimits, getProjectTier } from './billing/usage';
import { attributionForTier } from './attribution';
import type { RequestMeta } from './request-meta';
import { withProviderTimeout } from './rate-limit';
import { getBudgetStatus, maybeFireBudgetAlerts, getProjectTeamId, getTeamBudgetStatus, getTeamRateLimit } from './budget';
import { maybeFireAnomalyAlert } from './anomaly';
import type { SemanticCache } from './semantic-cache';
import { readKey, getIdempotent, saveIdempotent } from './idempotency';
import { computeRateLimit, withRateLimitHeaders } from './ratelimit-headers';

const MAX_LOGGED_FIELD_CHARS = 10_000;
const MAX_PROMPT_CHARS = 100_000;
const MAX_SYSTEM_CHARS = 50_000;

function truncate(s: string): string {
  return s.length > MAX_LOGGED_FIELD_CHARS ? s.slice(0, MAX_LOGGED_FIELD_CHARS) + '…' : s;
}

async function logRequest(
  env: Env, projectId: string, userId: string | null, req: PromptRequest, res: PromptResponse, meta: RequestMeta,
): Promise<void> {
  try {
    const cacheStatus = meta.cacheForceRefresh ? 'REFRESH' : 'DISABLED';
    await env.DB.prepare(
      `INSERT INTO requests (id, project_id, user_id, prompt_hash, provider, model, tokens_in, tokens_out, latency_ms, cached, boosted, created_at, properties, session_id, parent_session_id, cache_status, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, datetime('now'), ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(), projectId, userId ?? null,
      'ph_' + crypto.randomUUID().slice(0, 8),
      req.provider, req.model, res.tokensIn, res.tokensOut, res.latencyMs,
      meta.properties ? JSON.stringify(meta.properties) : null,
      meta.sessionId, meta.parentSessionId, cacheStatus,
      meta.tags ? JSON.stringify(meta.tags) : null,
    ).run();
  } catch {
    // Non-blocking — don't fail the request if logging fails
  }
}

export async function handlePrompt(
  request: Request, env: Env, projectId: string, userId: string | null,
  log: ReturnType<typeof requestLogger>, meta: RequestMeta, semanticCache: SemanticCache,
): Promise<Response> {
  const idemKey = readKey(request);
  if (idemKey instanceof Response) return idemKey;
  if (idemKey) {
    const replay = await getIdempotent(env, projectId, idemKey);
    if (replay) {
      const view = await computeRateLimit(env, projectId);
      return withRateLimitHeaders(replay, view);
    }
  }

  let body: PromptRequest;
  try { body = await request.json() as PromptRequest; }
  catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  if (typeof body.prompt !== 'string' || typeof body.provider !== 'string' || typeof body.model !== 'string') {
    return Response.json({ error: 'Missing or invalid fields: prompt, provider, model must be strings' }, { status: 400 });
  }
  if (body.prompt.length > MAX_PROMPT_CHARS) {
    return Response.json({ error: `prompt exceeds ${MAX_PROMPT_CHARS} chars` }, { status: 413 });
  }
  if (body.system && (typeof body.system !== 'string' || body.system.length > MAX_SYSTEM_CHARS)) {
    return Response.json({ error: `system exceeds ${MAX_SYSTEM_CHARS} chars or is not a string` }, { status: 413 });
  }
  if (!(await isWithinLimits(env, projectId))) {
    return Response.json({ error: 'Daily quota exceeded for this project' }, { status: 429 });
  }
  const budget = await getBudgetStatus(env, projectId);
  if (budget.over) {
    return Response.json({ error: 'Monthly budget exceeded for this project', budget }, { status: 402 });
  }
  const teamId = await getProjectTeamId(env, projectId);
  if (teamId) {
    const teamBudget = await getTeamBudgetStatus(env, teamId);
    if (teamBudget.over) {
      return Response.json({ error: 'Monthly budget exceeded for this team', teamBudget }, { status: 402 });
    }
    const teamRate = await getTeamRateLimit(env, teamId);
    if (teamRate.over) {
      return Response.json({ error: 'Daily team quota exceeded', teamRate }, { status: 429 });
    }
  }
  const adapter = getAdapter(body.provider);
  if (!adapter) return Response.json({ error: `Unknown provider: ${body.provider}` }, { status: 400 });
  const apiKey = await getApiKey(body.provider, env, projectId);
  if (!apiKey) return Response.json({ error: `Provider ${body.provider} not configured` }, { status: 503 });

  const tier = await getProjectTier(env, projectId);
  const attribution = attributionForTier(tier);

  if (!meta.cacheForceRefresh) {
    const cached = await semanticCache.get(body.prompt);
    if (cached) {
      const rlView = await computeRateLimit(env, projectId);
      const resp = Response.json(
        {
          text: cached, tokensIn: 0, tokensOut: 0, latencyMs: 0,
          meta: { cached: true, ...(attribution ? { attribution } : {}) },
        },
        { headers: { 'x-clawpipe-cache': 'SEMANTIC_HIT' } },
      );
      const withRL = withRateLimitHeaders(resp, rlView);
      return idemKey ? saveIdempotent(env, projectId, idemKey, withRL) : withRL;
    }
  }

  try {
    const requestId = crypto.randomUUID();
    const result: PromptResponse = await withProviderTimeout(adapter.call(body, apiKey));
    log.info('prompt complete', { provider: body.provider, model: body.model, tokensIn: result.tokensIn, tokensOut: result.tokensOut });
    await logRequest(env, projectId, userId, body, result, meta);
    await semanticCache.set(body.prompt, result.text);
    maybeFireBudgetAlerts(env, projectId).catch(() => { /* non-blocking */ });
    maybeFireAnomalyAlert(env, projectId).catch(() => { /* non-blocking */ });
    const cacheStatus = meta.cacheForceRefresh ? 'REFRESH' : 'MISS';
    const meta_ = attribution ? { attribution } : undefined;
    const payload = meta_ ? { ...result, request_id: requestId, meta: meta_ } : { ...result, request_id: requestId };
    const resp = Response.json(payload, { headers: { 'x-clawpipe-cache': cacheStatus } });
    const rlView = await computeRateLimit(env, projectId);
    const withRL = withRateLimitHeaders(resp, rlView);
    return idemKey ? saveIdempotent(env, projectId, idemKey, withRL) : withRL;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provider error';
    log.error('provider error', { provider: body.provider, error: truncate(message) });
    return Response.json({ error: message }, { status: 502 });
  }
}
