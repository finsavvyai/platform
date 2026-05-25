/**
 * Cloudflare Worker entry for @finsavvyai/ai-gateway.
 *
 * Wraps the round-2 `createEdgeHandler` and adds a richer `/health`
 * endpoint conforming to the cross-agent contract §1 shape:
 *   { status, version, uptime_s, checks: [{ name, status }] }.
 *
 * Bindings (see wrangler.toml): RATE_LIMIT_KV, RESPONSE_CACHE_KV,
 * GATEWAY_DB, AUDIT_LOG_BUCKET. Secrets are injected as env vars.
 *
 * Designed to typecheck with no extra deps — uses local minimal binding
 * interfaces instead of importing @cloudflare/workers-types.
 */

import { AiGateway } from "./gateway.js";
import { NonRetryableProviderError } from "./errors.js";
import { createEdgeHandler } from "./edge/handler.js";
import type { KvStore } from "./edge/types.js";
import type { ProviderAdapter } from "./types.js";

const BOOT_EPOCH_MS = Date.now();
const HEALTH_PATH = "/health";

/** Minimal KV binding surface — matches Cloudflare KVNamespace where we use it. */
interface KVBinding {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

/** Minimal D1 surface — `SELECT 1` only. */
interface D1Binding {
  prepare(query: string): { first<T = unknown>(): Promise<T | null> };
}

/** Minimal R2 surface — presence check only. */
interface R2Binding {
  head(key: string): Promise<unknown | null>;
}

export interface Env {
  readonly RATE_LIMIT_KV: KVBinding;
  readonly RESPONSE_CACHE_KV: KVBinding;
  readonly GATEWAY_DB: D1Binding;
  readonly AUDIT_LOG_BUCKET: R2Binding;
  readonly FINSAVVY_AUDIT_SINK?: string;
  readonly LOG_LEVEL?: string;
  readonly VERSION?: string;
  readonly JWT_PUBLIC_KEY?: string;
  readonly FINSAVVY_AUDIT_DD_API_KEY?: string;
}

type CheckStatus = "ok" | "degraded" | "down";
interface HealthCheck { readonly name: string; readonly status: CheckStatus }

function kvAdapter(b: KVBinding): KvStore {
  return {
    get: (k) => b.get(k),
    put: (k, v, opts) => b.put(k, v, { expirationTtl: opts.expirationTtl }),
  };
}

async function probeKv(b: KVBinding | undefined, name: string): Promise<HealthCheck> {
  if (!b) return { name, status: "down" };
  try {
    await b.get(`__healthcheck__:${name}`);
    return { name, status: "ok" };
  } catch {
    return { name, status: "down" };
  }
}

async function probeD1(b: D1Binding | undefined): Promise<HealthCheck> {
  if (!b) return { name: "d1", status: "down" };
  try {
    await b.prepare("SELECT 1").first();
    return { name: "d1", status: "ok" };
  } catch {
    return { name: "d1", status: "down" };
  }
}

function probeAuditSink(env: Env): HealthCheck {
  const sink = env.FINSAVVY_AUDIT_SINK;
  if (!sink) return { name: "audit_sink", status: "degraded" };
  if (sink === "datadog" && !env.FINSAVVY_AUDIT_DD_API_KEY) {
    return { name: "audit_sink", status: "degraded" };
  }
  return { name: "audit_sink", status: "ok" };
}

function rollupStatus(checks: readonly HealthCheck[]): CheckStatus {
  if (checks.some((c) => c.status === "down")) return "down";
  if (checks.some((c) => c.status === "degraded")) return "degraded";
  return "ok";
}

async function healthResponse(env: Env): Promise<Response> {
  const checks: HealthCheck[] = [
    await probeKv(env.RATE_LIMIT_KV, "kv_rate_limit"),
    await probeKv(env.RESPONSE_CACHE_KV, "kv_response_cache"),
    probeAuditSink(env),
    await probeD1(env.GATEWAY_DB),
  ];
  const status = rollupStatus(checks);
  const body = {
    status,
    version: env.VERSION ?? "unknown",
    uptime_s: Math.floor((Date.now() - BOOT_EPOCH_MS) / 1000),
    checks,
  };
  return new Response(JSON.stringify(body), {
    status: status === "down" ? 503 : 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * Shell adapter. The deployable shell ships with no real providers — products
 * wire their own AiGateway upstream of this worker. Until then, any call to
 * /v1/complete fails fast with a stable provider error (mapped to 502).
 */
const SHELL_ADAPTER: ProviderAdapter = {
  ref: { provider: "local", model: "shell-placeholder", tier: "balanced" },
  async complete() {
    throw new NonRetryableProviderError(
      501,
      "ai-gateway worker shell has no providers configured; wire a product-level adapter.",
    );
  },
};

function buildGatewayHandler(env: Env): (req: Request) => Promise<Response> {
  const gateway = new AiGateway({ adapters: [SHELL_ADAPTER] });
  return createEdgeHandler({
    gateway,
    jwtSecret: env.JWT_PUBLIC_KEY ?? "",
    kv: kvAdapter(env.RATE_LIMIT_KV),
    rateLimit: { windowMs: 60_000, maxRequests: 60 },
    enableHsts: true,
    gatewayVersion: env.VERSION ?? "unknown",
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === HEALTH_PATH && request.method === "GET") {
      return healthResponse(env);
    }
    const handler = buildGatewayHandler(env);
    return handler(request);
  },
};
