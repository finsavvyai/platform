/**
 * Covers worker.ts SHELL_ADAPTER + buildGatewayHandler wiring: a fully
 * authenticated /v1/complete call must reach the shell adapter, throw
 * NonRetryableProviderError, and surface as 502 via the edge handler's
 * error mapping. Also covers env-var presence branches (JWT_PUBLIC_KEY).
 */
import { describe, expect, it } from "vitest";
import worker, { type Env } from "./worker.js";
import { signHs256 } from "./edge/jwt.js";

interface KvBindingLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

function makeKv(): KvBindingLike {
  const map = new Map<string, string>();
  return {
    async get(key) { return map.get(key) ?? null; },
    async put(key, value) { map.set(key, value); },
  };
}

interface D1BindingLike {
  prepare(query: string): { first<T = unknown>(): Promise<T | null> };
}

function makeD1(): D1BindingLike {
  return {
    prepare(_q: string) {
      return { async first<T = unknown>(): Promise<T | null> { return null; } };
    },
  };
}

interface R2BindingLike {
  head(key: string): Promise<unknown | null>;
}

function makeR2(): R2BindingLike {
  return { async head() { return null; } };
}

const SECRET = "worker-shell-test-secret";

function envWith(extras: Partial<Env> = {}): Env {
  const base = {
    RATE_LIMIT_KV: makeKv() as Env["RATE_LIMIT_KV"],
    RESPONSE_CACHE_KV: makeKv() as Env["RESPONSE_CACHE_KV"],
    GATEWAY_DB: makeD1() as Env["GATEWAY_DB"],
    AUDIT_LOG_BUCKET: makeR2() as Env["AUDIT_LOG_BUCKET"],
    JWT_PUBLIC_KEY: SECRET,
    VERSION: "shell/0.0.1",
  } satisfies Partial<Env>;
  return { ...base, ...extras } as Env;
}

async function freshToken(): Promise<string> {
  // Deterministic token: fixed iat/exp avoids Date.now() drift in expectations.
  const iat = 1_700_000_000;
  return signHs256(
    {
      sub: "user-shell",
      tenantId: "t-shell",
      role: "user",
      iat,
      exp: iat + 60 * 60 * 24 * 365 * 10, // 10y in the future
    },
    SECRET,
  );
}

describe("worker /v1/complete — shell adapter surfaces 502", () => {
  it("authenticated POST reaches shell adapter; NonRetryableProviderError -> 502", async () => {
    const env = envWith();
    const tok = await freshToken();
    const res = await worker.fetch(
      new Request("https://x.io/v1/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tok}`,
        },
        // Tier must match the shell adapter ("balanced") so routing succeeds
        // and the adapter's NonRetryableProviderError is what surfaces.
        body: JSON.stringify({ prompt: "hi", tier: "balanced", maxTokens: 10 }),
      }),
      env,
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body.error).toBeTruthy();
    expect(body.reason).toMatch(/no providers configured/i);
  });

  it("falls back to empty JWT secret when JWT_PUBLIC_KEY absent (request still 401)", async () => {
    const env = envWith();
    const { JWT_PUBLIC_KEY: _drop, ...rest } = env;
    void _drop;
    const noJwtEnv = rest as Env;
    const res = await worker.fetch(
      new Request("https://x.io/v1/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer something.invalid",
        },
        body: JSON.stringify({ prompt: "hi" }),
      }),
      noJwtEnv,
    );
    // No valid JWT secret -> any token fails verification -> 401.
    expect(res.status).toBe(401);
  });
});
