/**
 * Hono integration tests for `createRateLimitMiddleware`.
 *
 * Verifies:
 *   - 429 response shape + Retry-After header
 *   - /health bypass
 *   - keyFn null bypass
 *   - audit callback fires exactly once per reject
 *   - store-failure fail-open default
 *   - store-failure fail-closed when configured
 *   - record-failure surfaces via onReject without blocking request
 *   - onReject swallowed errors don't break the middleware
 */

import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createRateLimitMiddleware } from "./middleware.js";
import type {
  RateLimitMiddlewareOptions,
  RateLimitRejection,
  RateLimitStore,
} from "./types.js";

const inMemoryStore = (init: Record<string, number[]> = {}): RateLimitStore => {
  const state = new Map<string, number[]>(Object.entries(init));
  return {
    async read(key) {
      return state.get(key) ?? [];
    },
    async record(key, ts) {
      const arr = state.get(key) ?? [];
      arr.push(ts);
      state.set(key, arr);
      return true;
    },
  };
};

const buildApp = (over: Partial<RateLimitMiddlewareOptions> = {}) => {
  const rejects: RateLimitRejection[] = [];
  const opts: RateLimitMiddlewareOptions = {
    config: { windowMs: 60_000, maxRequests: 2 },
    store: over.store ?? inMemoryStore(),
    keyFn: over.keyFn ?? (() => "fixed"),
    onReject: (info) => rejects.push(info),
    clock: over.clock ?? (() => 1_000_000),
    ...(over.failClosed !== undefined ? { failClosed: over.failClosed } : {}),
    ...(over.bypassPaths !== undefined ? { bypassPaths: over.bypassPaths } : {}),
  };
  const app = new Hono();
  app.use("*", createRateLimitMiddleware(opts));
  app.get("/health", (c) => c.json({ ok: true, h: true }));
  app.get("/v1/ping", (c) => c.json({ ok: true }));
  return { app, rejects };
};

describe("createRateLimitMiddleware", () => {
  it("allows requests under capacity", async () => {
    const { app, rejects } = buildApp();
    const r1 = await app.request("/v1/ping");
    const r2 = await app.request("/v1/ping");
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(rejects).toHaveLength(0);
  });

  it("returns 429 with stable code and Retry-After when over capacity", async () => {
    const { app, rejects } = buildApp();
    await app.request("/v1/ping");
    await app.request("/v1/ping");
    const r3 = await app.request("/v1/ping");
    expect(r3.status).toBe(429);
    const body = (await r3.json()) as { ok: boolean; error: string };
    expect(body).toEqual({ ok: false, error: "rate_limit.window_exceeded" });
    expect(r3.headers.get("Retry-After")).not.toBeNull();
    expect(Number(r3.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    expect(rejects).toHaveLength(1);
    expect(rejects[0]?.decision.reason).toBe("rate_limit.window_exceeded");
  });

  it("never rate-limits /health", async () => {
    const { app, rejects } = buildApp();
    for (let i = 0; i < 10; i++) {
      const r = await app.request("/health");
      expect(r.status).toBe(200);
    }
    expect(rejects).toHaveLength(0);
  });

  it("respects custom bypassPaths overriding the default", async () => {
    const { app } = buildApp({ bypassPaths: ["/v1/ping"] });
    for (let i = 0; i < 5; i++) {
      const r = await app.request("/v1/ping");
      expect(r.status).toBe(200);
    }
  });

  it("bypasses when keyFn returns null", async () => {
    const { app, rejects } = buildApp({ keyFn: () => null });
    for (let i = 0; i < 5; i++) {
      await app.request("/v1/ping");
    }
    expect(rejects).toHaveLength(0);
  });

  it("fail-open by default when store.read returns null", async () => {
    const store: RateLimitStore = {
      read: async () => null,
      record: async () => true,
    };
    const { app, rejects } = buildApp({ store });
    const r = await app.request("/v1/ping");
    expect(r.status).toBe(200);
    expect(rejects).toHaveLength(1);
    expect(rejects[0]?.decision.reason).toBe("rate_limit.store_unavailable");
  });

  it("fail-closed denies request when store.read returns null", async () => {
    const store: RateLimitStore = {
      read: async () => null,
      record: async () => true,
    };
    const { app, rejects } = buildApp({ store, failClosed: true });
    const r = await app.request("/v1/ping");
    expect(r.status).toBe(429);
    const body = (await r.json()) as { error: string };
    expect(body.error).toBe("rate_limit.store_unavailable");
    expect(rejects).toHaveLength(1);
  });

  it("surfaces store.record failure via onReject without blocking the request", async () => {
    const store: RateLimitStore = {
      read: async () => [],
      record: async () => false,
    };
    const { app, rejects } = buildApp({ store });
    const r = await app.request("/v1/ping");
    expect(r.status).toBe(200);
    expect(rejects).toHaveLength(1);
    expect(rejects[0]?.decision.reason).toBe("rate_limit.store_unavailable");
  });

  it("swallows onReject callback exceptions (never throws from middleware)", async () => {
    // Fresh in-window timestamps so decideSlidingWindow denies (cap=2, history=6).
    const t = 1_000_000;
    const store: RateLimitStore = {
      read: async () => [t - 100, t - 200, t - 300, t - 400, t - 500, t - 600],
      record: async () => true,
    };
    const app = new Hono();
    app.use(
      "*",
      createRateLimitMiddleware({
        config: { windowMs: 60_000, maxRequests: 2 },
        store,
        keyFn: () => "k",
        onReject: () => {
          throw new Error("audit broke");
        },
        clock: () => 1_000_000,
      }),
    );
    app.get("/v1/ping", (c) => c.json({ ok: true }));
    const r = await app.request("/v1/ping");
    expect(r.status).toBe(429);
  });

  it("works with no onReject configured (silent reject)", async () => {
    const app = new Hono();
    app.use(
      "*",
      createRateLimitMiddleware({
        config: { windowMs: 60_000, maxRequests: 0 } as never, // forces config_invalid path
        store: inMemoryStore(),
        keyFn: () => "k",
        clock: () => 1_000_000,
      }),
    );
    app.get("/v1/ping", (c) => c.json({ ok: true }));
    const r = await app.request("/v1/ping");
    expect(r.status).toBe(429);
    const body = (await r.json()) as { error: string };
    expect(body.error).toBe("rate_limit.config_invalid");
  });

  it("uses Date.now() when no clock override is provided", async () => {
    const spy = vi.spyOn(Date, "now").mockReturnValue(2_000_000);
    const app = new Hono();
    app.use(
      "*",
      createRateLimitMiddleware({
        config: { windowMs: 60_000, maxRequests: 1 },
        store: inMemoryStore(),
        keyFn: () => "k",
      }),
    );
    app.get("/v1/ping", (c) => c.json({ ok: true }));
    const r = await app.request("/v1/ping");
    expect(r.status).toBe(200);
    spy.mockRestore();
  });
});
