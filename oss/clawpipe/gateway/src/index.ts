/** ClawPipe Gateway — Cloudflare Worker entry point. */

import type { Env } from './types';
import { authenticate } from './auth';
import { handleGetWeights, handlePutWeights } from './weights';
import { routeAuth } from './auth/router';
import { routeSlack, runDigestForAllProjects } from './slack-routes';
import { routeSettings } from './settings-routes';
import { routeExport } from './export-csv';
import { routeTeams } from './teams-routes';
import { handleDemo } from './demo';
import { requestLogger } from './logger';
import { corsResponse } from './cors';
import { handleStream } from './stream';
import { extractRequestMeta } from './request-meta';
import { parseConfigHeader } from './config-parser';
import { routeAnalytics, routeObservability, routePrompts } from './routes';
import { handlePostQuality } from './quality';
import { SemanticCache } from './semantic-cache';
import { makeCFEmbeddingFn } from './semantic-cache-cf';
import { handlePrompt } from './prompt-handler';
import { checkResendDomainStatus } from './email-digest';
import { handleFinopsOverview } from './finops-overview'; import { handleFinopsByUser } from './finops-by-user';
import { routeInvitations } from './invitations';
import { routeMembers } from './members-routes';
import { routeTeamMembers } from './team-members-routes';
import { routeWebhooks } from './webhook-routes';
import { handleLSWebhook } from './billing/lemonsqueezy-webhook';
import { handleCheckout } from './billing/checkout-route';
import { handlePortal } from './billing/portal-route';
import { handleSavings } from './savings-route';
import { handleClawpipeIndex } from './clawpipe-index';
import { handlePublicStatus } from './status';
import { routeWebhookDlq } from './webhook-dlq-routes';
import { drainPending } from './webhook-dlq';
import { handleOpenApi } from './openapi-route';
import { warmCache } from './kv-warming';
import { handleChatCompletions } from './chat-completions-route';
import { routeAuditEvents } from './audit-events-routes';

// Module-level cache — persists across requests within a Worker isolate.
let _semanticCache: SemanticCache | null = null;
function getSemanticCache(env: Env): SemanticCache {
  if (!_semanticCache) {
    _semanticCache = new SemanticCache({ embeddingFn: makeCFEmbeddingFn(env) ?? undefined });
  }
  return _semanticCache;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const log = requestLogger(request);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return corsResponse(new Response(null, { status: 204 }), origin);
    }

    if (path === '/health' || path === '/') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return corsResponse(Response.json({ error: 'Method not allowed' }, { status: 405 }), origin);
      }
      return corsResponse(Response.json({
        status: 'ok', service: 'clawpipe-gateway', version: '1.0.0',
        timestamp: new Date().toISOString(),
      }), origin);
    }

    if (path === '/v1/demo' && request.method === 'POST') return corsResponse(await handleDemo(request, env), origin);
    if (path === '/v1/email/domain-status' && request.method === 'GET') return corsResponse(Response.json(await checkResendDomainStatus(env)), origin);
    if (path === '/v1/finops/overview' && request.method === 'GET') return corsResponse(await handleFinopsOverview(request, env), origin);
    if (path === '/v1/finops/by-user' && request.method === 'GET') return corsResponse(await handleFinopsByUser(request, env), origin);
    // Public no-auth routes — ClawPipe index, status (CORS allow-all), OpenAPI doc.
    if (path === '/v1/index' && request.method === 'GET') return corsResponse(await handleClawpipeIndex(env), origin);
    if (path === '/v1/status' && request.method === 'GET') return handlePublicStatus(env);
    if (path === '/v1/openapi.json' && request.method === 'GET') return corsResponse(handleOpenApi(), origin);

    if (path.match(/^\/v1\/(projects\/[^/]+\/invitations|invitations\/[^/]+)/)) {
      const invRes = await routeInvitations(request, env, path, request.method);
      if (invRes) return corsResponse(invRes, origin);
    }

    if (path.match(/^\/v1\/projects\/[^/]+\/members/)) {
      const memRes = await routeMembers(request, env, path, request.method);
      if (memRes) return corsResponse(memRes, origin);
    }

    if (path.match(/^\/v1\/teams\/[^/]+\/members/)) {
      const tmRes = await routeTeamMembers(request, env, path, request.method);
      if (tmRes) return corsResponse(tmRes, origin);
    }

    if (path.match(/^\/v1\/projects\/[^/]+\/webhooks/)) {
      const whRes = await routeWebhooks(request, env, path, request.method);
      if (whRes) return corsResponse(whRes, origin);
    }

    const auditRes = path.match(/^\/v1\/projects\/[^/]+\/audit\/events$/) ? await routeAuditEvents(request, env, path, request.method) : null;
    if (auditRes) return corsResponse(auditRes, origin);

    if (path === '/v1/webhooks/lemonsqueezy' && request.method === 'POST') {
      return corsResponse(await handleLSWebhook(env, request), origin);
    }

    if (path.startsWith('/auth/') || path === '/v1/projects' || path.match(/^\/v1\/projects\/[^/]+\/keys/) || path.match(/^\/v1\/projects\/[^/]+\/provider-keys/)) {
      const authRes = await routeAuth(request, env, path, request.method);
      if (authRes) return corsResponse(authRes, origin);
    }

    if (path.match(/^\/v1\/projects\/[^/]+\/slack-/)) {
      const slackRes = await routeSlack(request, env, path, request.method);
      if (slackRes) return corsResponse(slackRes, origin);
    }

    if (path.match(/^\/v1\/projects\/[^/]+\/(settings|budget|digest-email(\/test)?)$/)) {
      const settingsRes = await routeSettings(request, env, path, request.method);
      if (settingsRes) return corsResponse(settingsRes, origin);
    }

    if (path.match(/^\/v1\/projects\/[^/]+\/export\.csv$/)) {
      const expRes = await routeExport(request, env, path, request.method);
      if (expRes) return corsResponse(expRes, origin);
    }

    if (path.startsWith('/v1/teams') || path.match(/^\/v1\/projects\/[^/]+\/team$/)) {
      const teamRes = await routeTeams(request, env, path, request.method);
      if (teamRes) return corsResponse(teamRes, origin);
    }

    if (!['POST', 'GET', 'PUT', 'DELETE'].includes(request.method)) {
      return corsResponse(Response.json({ error: 'Method not allowed' }, { status: 405 }), origin);
    }

    const auth = await authenticate(request, env);
    if (!auth.valid) {
      return corsResponse(Response.json({ error: auth.error }, { status: 401 }), origin);
    }
    const projectId = auth.projectId!; const userId = auth.userId ?? null;

    if (path === '/v1/chat/completions' && request.method === 'POST') return corsResponse(await handleChatCompletions(request, env, projectId), origin);
    if (path === '/v1/prompt' && request.method === 'POST') {
      const meta = extractRequestMeta(request);
      const cfg = parseConfigHeader(request.headers.get('x-clawpipe-config'));
      if (!cfg.ok) return corsResponse(Response.json({ error: 'bad x-clawpipe-config', details: cfg.errors }, { status: 400 }), origin);
      log.info('prompt request', { projectId, session: meta.sessionId ?? '', strategy: cfg.config.strategy ?? 'single' });
      return corsResponse(await handlePrompt(request, env, projectId, userId, log, meta, getSemanticCache(env)), origin);
    }

    if (path === '/v1/stream' && request.method === 'POST') return corsResponse(await handleStream(request, env, projectId), origin);
    if (path === '/v1/weights' && request.method === 'GET') return corsResponse(await handleGetWeights(env, projectId), origin);
    if (path === '/v1/weights' && request.method === 'PUT') return corsResponse(await handlePutWeights(request, env, projectId), origin);
    if (path === '/v1/quality' && request.method === 'POST') return corsResponse(await handlePostQuality(request, env, projectId), origin);
    if (path === '/v1/billing/checkout' && request.method === 'POST') return corsResponse(await handleCheckout(request, env, projectId), origin);
    if (path === '/v1/billing/portal' && request.method === 'GET') return corsResponse(await handlePortal(env, projectId), origin);
    if (path === '/v1/savings' && request.method === 'GET') return corsResponse(await handleSavings(env, projectId), origin);

    const dlqRes = await routeWebhookDlq(request, env, path, projectId);
    if (dlqRes) return corsResponse(dlqRes, origin);

    if (request.method === 'GET' && path.startsWith('/v1/analytics/')) {
      return corsResponse(await routeAnalytics(path, env, projectId), origin);
    }

    const prompts = await routePrompts(request, env, path, projectId);
    if (prompts) return corsResponse(prompts, origin);

    const obs = await routeObservability(request, env, path, projectId);
    if (obs) return corsResponse(obs, origin);

    return corsResponse(Response.json({ error: 'Not found' }, { status: 404 }), origin);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Weekly digest cron (Mon 09:00 UTC) — preserved on its own schedule.
    if (event.cron === '0 9 * * 1') {
      ctx.waitUntil(runDigestForAllProjects(env).then((r) => {
        console.log(`slack-digest cron: sent=${r.sent} failed=${r.failed}`);
      }));
    }
    // Webhook DLQ drain — every cron tick. drainPending self-bounds at 50 rows.
    ctx.waitUntil(drainPending(env).then((r) => {
      console.log(`webhook-dlq drain: tried=${r.tried} sent=${r.sent} dead=${r.dead}`);
    }));
    // KV cache warming — pre-populate hot keys so isolate cold starts hit KV not D1.
    ctx.waitUntil(warmCache(env).then((r) => {
      console.log(`kv-warming: scanned=${r.scanned} written=${r.written}`);
    }));
  },
};
