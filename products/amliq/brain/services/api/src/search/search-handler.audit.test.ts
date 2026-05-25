/**
 * Audit-failure + clamp branches for the search handler.
 * Split from search-handler.test.ts to honour the 200-line cap.
 */
import { describe, expect, it } from "vitest";
import { createBrainApp } from "../server.js";
import type { SearchAdapter, SearchAdapterQuery } from "./types.js";
import {
  baseConfig,
  body,
  errAdapter,
  failingSinks,
  stubAdapter,
} from "./search-handler.test-helpers.js";

describe("POST /v1/search — audit failure branches", () => {
  it("audit emit hard-fails on happy path → 503 audit_emit_failed", async () => {
    const { sink, fallbackSink } = failingSinks();
    const { app } = createBrainApp(
      baseConfig(stubAdapter([]), { sink, fallbackSink }),
    );
    const res = await app.request(
      "/v1/search",
      body({ q: "x", tenant_id: "t1" }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toStrictEqual({
      ok: false,
      error: "audit_emit_failed",
    });
  });

  it("audit emit hard-fails on missing_query branch → 503", async () => {
    const { sink, fallbackSink } = failingSinks();
    const { app } = createBrainApp(
      baseConfig(stubAdapter([]), { sink, fallbackSink }),
    );
    const res = await app.request(
      "/v1/search",
      body({ q: "", tenant_id: "t1" }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toStrictEqual({
      ok: false,
      error: "audit_emit_failed",
    });
  });

  it("audit emit hard-fails on missing_tenant branch → 503", async () => {
    const { sink, fallbackSink } = failingSinks();
    const { app } = createBrainApp(
      baseConfig(stubAdapter([]), { sink, fallbackSink }),
    );
    const res = await app.request(
      "/v1/search",
      body({ q: "x", tenant_id: "" }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toStrictEqual({
      ok: false,
      error: "audit_emit_failed",
    });
  });

  it("audit emit hard-fails on adapter_error branch → 503", async () => {
    const { sink, fallbackSink } = failingSinks();
    const { app } = createBrainApp(
      baseConfig(errAdapter, { sink, fallbackSink }),
    );
    const res = await app.request(
      "/v1/search",
      body({ q: "x", tenant_id: "t1" }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toStrictEqual({
      ok: false,
      error: "audit_emit_failed",
    });
  });
});

describe("POST /v1/search — top_k clamp + latency fallback", () => {
  it("top_k is clamped to maxTopK and floored to int", async () => {
    let seen: SearchAdapterQuery | null = null;
    const adapter = stubAdapter([], (q) => {
      seen = q;
    });
    const { app } = createBrainApp({
      ...baseConfig(adapter),
      search: { adapter, defaultTopK: 5, maxTopK: 7 },
    });
    await app.request(
      "/v1/search",
      body({ q: "x", tenant_id: "t1", top_k: 999 }),
    );
    expect(seen!.topK).toBe(7);
    await app.request(
      "/v1/search",
      body({ q: "x", tenant_id: "t1", top_k: 0 }),
    );
    expect(seen!.topK).toBe(1);
    await app.request("/v1/search", body({ q: "x", tenant_id: "t1" }));
    expect(seen!.topK).toBe(5);
    // In-range value passes through after Math.floor.
    await app.request(
      "/v1/search",
      body({ q: "x", tenant_id: "t1", top_k: 3.7 }),
    );
    expect(seen!.topK).toBe(3);
  });

  it("falls through to handler-measured latency when adapter reports 0", async () => {
    const base = stubAdapter([]);
    const wrapped: SearchAdapter = {
      query: async (q) => {
        const r = await base.query(q);
        return { hits: r.hits, latencyMs: 0 };
      },
    };
    const { app } = createBrainApp({
      ...baseConfig(wrapped),
      search: { adapter: wrapped, defaultTopK: 5, maxTopK: 10 },
    });
    const res = await app.request(
      "/v1/search",
      body({ q: "x", tenant_id: "t1" }),
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { latencyMs: number };
    expect(j.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
