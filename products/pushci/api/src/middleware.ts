import type { Context, Next } from "hono";
import { verifyJwt, createJwt } from "./auth";
import type { Env, JwtPayload } from "./types";
import { checkRateLimit } from "./rate-limit-do";

type MwEnv = Env & { RUNNERS: KVNamespace };

/** Bridge/webhook/runs/aws limit — stricter because these endpoints
 *  accept long-lived PATs and external payloads. */
export const BRIDGE_RATE_LIMIT = 120;

/** General API limit — preserved for backward compat with /api/* path. */
export const GENERAL_RATE_LIMIT = 300;

const ALLOWED_ORIGINS = [
  "https://pushci.dev",
  "https://app.pushci.dev",
  "https://pushci-app.pages.dev",
  "http://localhost:5173",
  "http://localhost:3000",
];

export async function corsMiddleware(c: Context<{ Bindings: MwEnv }>, next: Next) {
  const origin = c.req.header("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : "";

  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Authorization,Content-Type,Idempotency-Key,X-Requested-With",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  await next();
  if (allowed) {
    c.res.headers.set("Access-Control-Allow-Origin", allowed);
    c.res.headers.set("Access-Control-Expose-Headers", "X-Refreshed-Token");
  }
}

export async function rateLimitMiddleware(c: Context<{ Bindings: MwEnv }>, next: Next) {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const key = `rl:${ip}:${Math.floor(Date.now() / 60000)}`;

  const current = await c.env.RUNNERS.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= 120) {
    return c.json(
      { error: "rate limit exceeded" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  await c.env.RUNNERS.put(key, String(count + 1), { expirationTtl: 120 });
  await next();
}

/**
 * Durable-Object-backed rate limiter (I-002 fix). Strongly consistent
 * across CF pops — attackers can no longer exceed the quota by hitting
 * different edge nodes. Use this on bridges/webhooks/runs/aws.
 *
 * Falls back to the KV path if `env.RATE_LIMITER` is unbound so existing
 * tests and `wrangler dev` without the DO migration still work.
 */
export function rateLimitMiddlewareDO(limit: number = BRIDGE_RATE_LIMIT) {
  return async function (c: Context<{ Bindings: MwEnv }>, next: Next) {
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const ns = c.env.RATE_LIMITER;
    if (!ns) {
      // Fallback: legacy KV path so dev/test envs without the binding still work.
      return rateLimitMiddleware(c, next);
    }
    const id = ns.idFromName(`bridge:${ip}`);
    const stub = ns.get(id);
    const result = await checkRateLimit(stub, ip, limit);
    if (!result.allowed) {
      return c.json(
        { error: "rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(result.retryAfter) } }
      );
    }
    await next();
  };
}

export async function authRateLimitMiddleware(c: Context<{ Bindings: MwEnv }>, next: Next) {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const key = `rl:auth:${ip}:${Math.floor(Date.now() / 60000)}`;

  const current = await c.env.RUNNERS.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= 20) {
    return c.json(
      { error: "too many auth attempts" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  await c.env.RUNNERS.put(key, String(count + 1), { expirationTtl: 120 });
  await next();
}

export async function requireAuth(c: Context<{ Bindings: MwEnv }>, next: Next) {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: "unauthorized" }, 401);
  }

  await next();
  await refreshTokenIfNeeded(c, payload);
}

async function refreshTokenIfNeeded(c: Context<{ Bindings: MwEnv }>, payload: JwtPayload) {
  const now = Math.floor(Date.now() / 1000);
  const halfLife = payload.iat + Math.floor((payload.exp - payload.iat) / 2);
  if (now < halfLife) return;
  const fresh: JwtPayload = { ...payload, iat: now, exp: now + 604800 };
  const newToken = await createJwt(fresh, c.env.JWT_SECRET);
  c.res.headers.set("X-Refreshed-Token", newToken);
}

export async function requestLogger(c: Context<{ Bindings: MwEnv }>, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;
  const ip = c.req.header("cf-connecting-ip") ?? "-";

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      method,
      path,
      status,
      duration_ms: duration,
      ip,
    })
  );
}

export async function errorHandler(c: Context<{ Bindings: MwEnv }>, next: Next) {
  try {
    await next();
  } catch (err) {
    const id = crypto.randomUUID().slice(0, 8);
    const msg = err instanceof Error ? err.message : "unknown";
    console.error(JSON.stringify({ error_id: id, message: msg, stack: String(err) }));
    return c.json({ error: "internal error", error_id: id }, 500);
  }
}
