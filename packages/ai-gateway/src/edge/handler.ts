import type { AiGateway } from "../gateway.js";
import {
  GatewayExhaustedError,
  NoRouteError,
  NonRetryableProviderError,
} from "../errors.js";
import { emitAudit } from "./audit.js";
import { clientIpOf, extractAuth } from "./extract-auth.js";
import { EdgeBadRequestError } from "./errors.js";
import { parseCompletionBody } from "./parse-completion.js";
import { RateLimiter, defaultKeyFor, type RateLimitConfig } from "./rate-limit.js";
import { securityHeaders, withHeaders } from "./security-headers.js";
import type { AuditSink, KvStore } from "./types.js";

export type EdgeHandlerConfig = {
  readonly gateway: AiGateway;
  readonly jwtSecret: string;
  readonly kv: KvStore;
  readonly rateLimit: RateLimitConfig;
  readonly audit?: AuditSink;
  readonly enableHsts?: boolean;
  readonly gatewayVersion?: string;
  readonly now?: () => number;
};

const COMPLETE_PATH = "/v1/complete";
const HEALTH_PATH = "/health";

/**
 * Build a runtime-agnostic edge handler. Routes:
 *
 *   GET  /health           → 200 status JSON, no auth, no rate limit
 *   POST /v1/complete      → requires Bearer JWT, rate-limited, body parsed
 *                            into GatewayRequest and forwarded to
 *                            `AiGateway.complete`. Response shape mirrors
 *                            GatewayResponse for transport.
 *   *                      → 404 JSON
 *
 * Errors are mapped to stable HTTP status codes; every response carries
 * security headers per swarm convention.
 */
export function createEdgeHandler(
  cfg: EdgeHandlerConfig,
): (request: Request) => Promise<Response> {
  const limiter = new RateLimiter({
    kv: cfg.kv,
    config: cfg.rateLimit,
    ...(cfg.now ? { now: cfg.now } : {}),
  });
  const headerOpts: { enableHsts?: boolean; gatewayVersion?: string } = {};
  if (cfg.enableHsts !== undefined) headerOpts.enableHsts = cfg.enableHsts;
  if (cfg.gatewayVersion !== undefined) headerOpts.gatewayVersion = cfg.gatewayVersion;
  const sec = securityHeaders(headerOpts);

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (url.pathname === HEALTH_PATH && request.method === "GET") {
      return withSec(jsonResponse(200, { status: "ok" }), sec);
    }
    if (url.pathname !== COMPLETE_PATH) {
      return withSec(jsonResponse(404, { error: "not_found", path: url.pathname }), sec);
    }
    if (request.method !== "POST") {
      return withSec(
        jsonResponse(405, { error: "method_not_allowed", allow: "POST" }, { Allow: "POST" }),
        sec,
      );
    }
    return handleComplete(request, cfg, limiter, sec);
  };
}

async function handleComplete(
  request: Request,
  cfg: EdgeHandlerConfig,
  limiter: RateLimiter,
  sec: Record<string, string>,
): Promise<Response> {
  const now = cfg.now ?? Date.now;
  const auth = await extractAuth(request, {
    secret: cfg.jwtSecret,
    ...(cfg.now ? { now } : {}),
  });
  if (!auth.ok) {
    emitAudit(
      cfg.audit,
      {
        actorId: "anonymous",
        event: "edge.auth",
        resource: COMPLETE_PATH,
        decision: "deny",
        reason: auth.reason,
      },
      now,
    );
    return withSec(jsonResponse(auth.status, { error: auth.code, reason: auth.reason }), sec);
  }

  const actor = auth.claims.sub;
  const ip = clientIpOf(request);
  /* v8 ignore next -- verifyJwt enforces non-empty sub; `|| ip` is dead */
  const rlKey = defaultKeyFor(actor || ip, COMPLETE_PATH);
  const decision = await limiter.check(rlKey);
  const rlHeaders = rateLimitHeaders(decision);

  if (!decision.allowed) {
    const retryAfter = Math.max(1, Math.ceil((decision.resetEpochMs - now()) / 1000));
    emitAudit(
      cfg.audit,
      {
        actorId: actor,
        event: "edge.rate_limit",
        resource: COMPLETE_PATH,
        decision: "deny",
        reason: `limit=${decision.limit}`,
      },
      now,
    );
    return withSec(
      jsonResponse(
        429,
        { error: "rate_limited", retryAfterSeconds: retryAfter },
        { ...rlHeaders, "Retry-After": String(retryAfter) },
      ),
      sec,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withSec(jsonResponse(400, { error: "invalid_json" }, rlHeaders), sec);
  }

  try {
    const req = parseCompletionBody(body, auth.claims.tenantId);
    const response = await cfg.gateway.complete(req);
    emitAudit(
      cfg.audit,
      {
        actorId: actor,
        event: "edge.complete",
        resource: COMPLETE_PATH,
        decision: "allow",
        reason: `model=${response.model.model} cached=${response.cached}`,
      },
      now,
    );
    return withSec(jsonResponse(200, response, rlHeaders), sec);
  } catch (err) {
    return withSec(mapError(err, rlHeaders), sec);
  }
}

function mapError(err: unknown, rlHeaders: Record<string, string>): Response {
  if (err instanceof EdgeBadRequestError) {
    return jsonResponse(400, { error: err.code, reason: err.message }, rlHeaders);
  }
  if (err instanceof NoRouteError) {
    return jsonResponse(503, { error: err.code, reason: err.message }, rlHeaders);
  }
  if (err instanceof NonRetryableProviderError) {
    return jsonResponse(502, { error: err.code, reason: err.message }, rlHeaders);
  }
  if (err instanceof GatewayExhaustedError) {
    return jsonResponse(504, { error: err.code, reason: "upstream retries exhausted" }, rlHeaders);
  }
  return jsonResponse(500, { error: "internal_error" }, rlHeaders);
}

function rateLimitHeaders(d: {
  limit: number;
  remaining: number;
  resetEpochMs: number;
}): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(d.limit),
    "X-RateLimit-Remaining": String(d.remaining),
    "X-RateLimit-Reset": String(Math.floor(d.resetEpochMs / 1000)),
  };
}

function jsonResponse(
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function withSec(res: Response, sec: Record<string, string>): Response {
  return withHeaders(res, sec);
}
