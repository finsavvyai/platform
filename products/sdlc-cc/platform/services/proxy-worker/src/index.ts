/**
 * SDLC.ai API Gateway - Cloudflare Worker
 *
 * Main entry point that orchestrates:
 * - API key validation & rate limiting
 * - Agent run routes (dispatch, status, cancel, callback)
 * - PII detection & redaction
 * - Backend proxy passthrough
 * - CORS & response finalization
 */

import type { Env } from './env';
import type { PIIMatch } from './pii-detector';
import type { RateLimitResult } from './rate-limiter';
import {
  checkRateLimit,
  rateLimitExceededResponse,
  getPlanType,
  KVRateLimitStorage,
} from './rate-limiter';
import {
  checkAndConsumeQuota,
  quotaExceededResponse,
  tierFromPlan,
  KVQuotaStorage,
} from './monthly-quota';
import { handleAdminSetPlan } from './admin';
import { resolvePlan } from './tenant-plan';
import {
  handleAgentRoute,
  handleRunnerCallback,
  handleRunnerToolRequest,
  isRunnerToolRequest,
  AGENT_RUN_CALLBACK_PATTERN,
} from './agent-routes';
import {
  extractApiKey,
  validateApiKey,
  proxyToBackend,
  getOrCreateRequestId,
  withRequestId,
} from './proxy-backend';
import { detectAndRedactRequest, detectAndRedactResponse, logUsage } from './pii-handling';
import {
  finalizeResponse,
  getCorsHeaders,
  jsonResponse,
  unauthorizedResponse,
  errorResponse,
} from './response-helpers';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return handleRequest(request, env, ctx);
  },
};

export async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const requestId = getOrCreateRequestId(request);
  const requestWithId = withRequestId(request, requestId);
  const url = new URL(requestWithId.url);

  if (requestWithId.method === 'OPTIONS') {
    return finalizeResponse(
      new Response(null, { headers: getCorsHeaders() }),
      requestId
    );
  }

  // Admin: HMAC-protected plan updates from the Lemon Squeezy webhook.
  if (url.pathname === '/admin/plans') {
    return finalizeResponse(
      await handleAdminSetPlan(requestWithId, env.API_KEYS, env.ADMIN_HMAC_SECRET ?? ''),
      requestId
    );
  }

  if (url.pathname === '/health') {
    return finalizeResponse(
      jsonResponse(
        {
          status: 'ok',
          service: 'sdlc-proxy',
          version: '1.1.0',
          hosted_runner_dispatch: true,
        },
        200
      ),
      requestId
    );
  }

  // Public capabilities endpoint — landing page polls this to render the
  // OpenClaw capabilities section. Returning available:false makes the
  // component fall back to its hard-coded DEFAULT_* lists instead of
  // logging a 401 in the browser console.
  if (url.pathname === '/api/v1/openclaw/capabilities' && requestWithId.method === 'GET') {
    return finalizeResponse(
      jsonResponse(
        {
          available: false,
          channels: [],
          nodes: [],
          extensions: [],
          skills: [],
          note: 'live capabilities served by the gateway in non-edge deployments',
        },
        200
      ),
      requestId
    );
  }

  const callbackMatch = url.pathname.match(AGENT_RUN_CALLBACK_PATTERN);
  if (callbackMatch) {
    return finalizeResponse(
      await handleRunnerCallback(
        requestWithId,
        env,
        requestId,
        decodeURIComponent(callbackMatch[1])
      ),
      requestId
    );
  }

  if (isRunnerToolRequest(requestWithId, env)) {
    return finalizeResponse(
      await handleRunnerToolRequest(requestWithId, env),
      requestId
    );
  }

  try {
    const apiKey = extractApiKey(requestWithId);
    if (!apiKey) {
      return finalizeResponse(unauthorizedResponse('Missing API key'), requestId);
    }

    const keyData = await validateApiKey(apiKey, env);
    if (!keyData) {
      return finalizeResponse(unauthorizedResponse('Invalid API key'), requestId);
    }

    let rateLimitResult: RateLimitResult | null = null;

    if (env.RATE_LIMIT_ENABLED !== 'false') {
      const storage = new KVRateLimitStorage(env.API_KEYS);
      rateLimitResult = await checkRateLimit(
        storage,
        keyData.user_id,
        keyData.id,
        getPlanType(keyData)
      );

      if (!rateLimitResult.allowed) {
        return finalizeResponse(
          rateLimitExceededResponse(rateLimitResult),
          requestId
        );
      }
    }

    // Monthly plan-level quota — orthogonal to the per-minute throttle above.
    // Resolves effective plan from the plan:{userId} KV override (written
    // by the Lemon Squeezy webhook) and falls back to the key's stored plan.
    if (env.MONTHLY_QUOTA_ENABLED !== 'false') {
      const effectivePlan = await resolvePlan(env.API_KEYS, keyData.user_id, keyData.plan);
      const quotaStorage = new KVQuotaStorage(env.API_KEYS);
      const quota = await checkAndConsumeQuota(
        quotaStorage,
        keyData.user_id,
        tierFromPlan(effectivePlan)
      );
      if (!quota.allowed) {
        return finalizeResponse(quotaExceededResponse(quota), requestId);
      }
    }

    const agentRouteResponse = await handleAgentRoute(
      requestWithId,
      env,
      keyData,
      requestId
    );
    if (agentRouteResponse) {
      return finalizeResponse(agentRouteResponse, requestId, rateLimitResult);
    }

    return await proxyWithPII(requestWithId, env, ctx, keyData, rateLimitResult, requestId);
  } catch (error) {
    console.error('Proxy error:', error);
    return finalizeResponse(
      errorResponse(error instanceof Error ? error.message : String(error)),
      requestId
    );
  }
}

async function proxyWithPII(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  keyData: import('./api-keys').ApiKeyRecord,
  rateLimitResult: RateLimitResult | null,
  requestId: string
): Promise<Response> {
  const piiEnabled = env.PII_DETECTION_ENABLED !== 'false';
  let requestPII: PIIMatch[] = [];
  let modifiedRequest = request;

  if (piiEnabled && request.method === 'POST') {
    const result = await detectAndRedactRequest(request);
    modifiedRequest = result.request;
    requestPII = result.piiMatches;
  }

  const upstreamResponse = await proxyToBackend(modifiedRequest, env);

  let responsePII: PIIMatch[] = [];
  let finalResponse = upstreamResponse;

  if (piiEnabled) {
    const result = await detectAndRedactResponse(upstreamResponse);
    finalResponse = result.response;
    responsePII = result.piiMatches;
  }

  ctx.waitUntil(
    logUsage(keyData, request, finalResponse, requestPII, responsePII, env)
  );

  return finalizeResponse(finalResponse, requestId, rateLimitResult);
}
