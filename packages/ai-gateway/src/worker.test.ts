/**
 * Tests for the Cloudflare Worker entry (`worker.ts`).
 *
 * Pure vitest — no miniflare/wrangler. KV/D1/R2 bindings are simple
 * in-memory stubs that satisfy the local minimal binding interfaces
 * declared in `worker.ts`.
 */
import { describe, expect, it } from "vitest";
import worker, { type Env } from "./worker.js";

// ---------- in-memory binding stubs ----------

interface KvBindingLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

function makeKv(opts: { failOnGet?: boolean } = {}): KvBindingLike {
  const map = new Map<string, string>();
  return {
    async get(key) {
      if (opts.failOnGet) throw new Error("kv get boom");
      return map.get(key) ?? null;
    },
    async put(key, value) {
      map.set(key, value);
    },
  };
}

interface D1BindingLike {
  prepare(query: string): { first<T = unknown>(): Promise<T | null> };
}

function makeD1(opts: { failOnFirst?: boolean } = {}): D1BindingLike {
  return {
    prepare(_query: string) {
      return {
        async first<T = unknown>(): Promise<T | null> {
          if (opts.failOnFirst) throw new Error("d1 boom");
          return { ok: 1 } as T;
        },
      };
    },
  };
}

interface R2BindingLike {
  head(key: string): Promise<unknown | null>;
}

function makeR2(): R2BindingLike {
  return { async head() { return null; } };
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  const base = {
    RATE_LIMIT_KV: makeKv(),
    RESPONSE_CACHE_KV: makeKv(),
    GATEWAY_DB: makeD1(),
    AUDIT_LOG_BUCKET: makeR2(),
    VERSION: "test/1.2.3",
  } satisfies Partial<Env>;
  return { ...base, ...overrides } as Env;
}

// ---------- /health success rollups ----------

describe("worker /health — happy paths", () => {
  it("returns 200 with status=ok when all probes succeed and audit sink set", async () => {
    const env = makeEnv({ FINSAVVY_AUDIT_SINK: "stdout" });
    const res = await worker.fetch(new Request("https://x.io/health"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      version: string;
      uptime_s: number;
      checks: Array<{ name: string; status: string }>;
    };
    expect(body.status).toBe("ok");
    expect(body.version).toBe("test/1.2.3");
    expect(body.uptime_s).toBeGreaterThanOrEqual(0);
    const names = body.checks.map((c) => c.name).sort();
    expect(names).toEqual(["audit_sink", "d1", "kv_rate_limit", "kv_response_cache"]);
  });

  it("VERSION falls back to 'unknown' when env var missing", async () => {
    const env = makeEnv({ FINSAVVY_AUDIT_SINK: "stdout" });
    // Remove VERSION cleanly without using `any`.
    const { VERSION: _ignore, ...rest } = env;
    void _ignore;
    const noVersionEnv = rest as Env;
    const res = await worker.fetch(new Request("https://x.io/health"), noVersionEnv);
    const body = (await res.json()) as { version: string };
    expect(body.version).toBe("unknown");
  });
});

// ---------- /health degraded + down branches ----------

describe("worker /health — degraded / down rollups", () => {
  it("status=degraded when audit sink is missing (no down probes)", async () => {
    const env = makeEnv(); // no FINSAVVY_AUDIT_SINK
    const res = await worker.fetch(new Request("https://x.io/health"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      checks: Array<{ name: string; status: string }>;
    };
    expect(body.status).toBe("degraded");
    const sink = body.checks.find((c) => c.name === "audit_sink");
    expect(sink?.status).toBe("degraded");
  });

  it("status=degraded when sink=datadog but DD API key missing", async () => {
    const env = makeEnv({ FINSAVVY_AUDIT_SINK: "datadog" });
    const res = await worker.fetch(new Request("https://x.io/health"), env);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("degraded");
  });

  it("status=ok when sink=datadog AND DD API key present", async () => {
    const env = makeEnv({
      FINSAVVY_AUDIT_SINK: "datadog",
      FINSAVVY_AUDIT_DD_API_KEY: "secret-key",
    });
    const res = await worker.fetch(new Request("https://x.io/health"), env);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  it("status=down + HTTP 503 when KV probe throws", async () => {
    const env = makeEnv({
      RATE_LIMIT_KV: makeKv({ failOnGet: true }) as Env["RATE_LIMIT_KV"],
      FINSAVVY_AUDIT_SINK: "stdout",
    });
    const res = await worker.fetch(new Request("https://x.io/health"), env);
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      status: string;
      checks: Array<{ name: string; status: string }>;
    };
    expect(body.status).toBe("down");
    expect(body.checks.find((c) => c.name === "kv_rate_limit")?.status).toBe("down");
  });

  it("status=down when D1 probe throws", async () => {
    const env = makeEnv({
      GATEWAY_DB: makeD1({ failOnFirst: true }) as Env["GATEWAY_DB"],
      FINSAVVY_AUDIT_SINK: "stdout",
    });
    const res = await worker.fetch(new Request("https://x.io/health"), env);
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("down");
  });
});

// ---------- /health method branch ----------

describe("worker /health — method branch", () => {
  it("POST /health is NOT the health route; falls through to edge handler -> 404", async () => {
    const env = makeEnv({ FINSAVVY_AUDIT_SINK: "stdout" });
    const res = await worker.fetch(
      new Request("https://x.io/health", { method: "POST" }),
      env,
    );
    // Edge handler responds with 404 JSON for unknown POST paths.
    expect(res.status).toBe(404);
  });
});

// ---------- /v1/complete via shell adapter ----------

describe("worker /v1/complete — shell adapter wiring", () => {
  it("missing Authorization on /v1/complete -> 401 (handler enforced)", async () => {
    const env = makeEnv({ FINSAVVY_AUDIT_SINK: "stdout" });
    const res = await worker.fetch(
      new Request("https://x.io/v1/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "hi" }),
      }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("unknown path -> 404 from edge handler", async () => {
    const env = makeEnv({ FINSAVVY_AUDIT_SINK: "stdout" });
    const res = await worker.fetch(new Request("https://x.io/nope"), env);
    expect(res.status).toBe(404);
  });
});
