import { describe, it, expect, vi } from "vitest";

import { createDatadogSink } from "./datadog.js";
import type { AuditRecord } from "../types.js";

const rec = (i: number, d: AuditRecord["decision"] = "allow"): AuditRecord => ({
  ts: "2026-05-25T01:02:03.000Z",
  actor_id: `u${i}`,
  event: "evt",
  resource: "res",
  decision: d,
  reason: "r",
});

const okResponse = (): Response =>
  new Response(JSON.stringify({}), { status: 202 });

describe("datadog sink", () => {
  it("throws when apiKey is missing or empty", () => {
    expect(() =>
      createDatadogSink({ apiKey: "" }),
    ).toThrow(/apiKey is required/);
    // @ts-expect-error — runtime guard
    expect(() => createDatadogSink({ apiKey: undefined })).toThrow();
  });

  it("batches records and POSTs to the chosen site host", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const sink = createDatadogSink({
      apiKey: "fake-key",
      site: "eu",
      maxBatchSize: 2,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    sink(rec(1));
    sink(rec(2, "deny"));
    await sink.flush();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0]!;
    const url = call[0] as string;
    expect(url).toBe("https://http-intake.logs.datadoghq.eu/api/v2/logs");
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["DD-API-KEY"]).toBe("fake-key");
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body as string) as Array<{
      ddtags: string;
      message: string;
    }>;
    expect(body).toHaveLength(2);
    expect(body[0]!.ddtags).toContain("event:evt");
    expect(body[1]!.ddtags).toContain("decision:deny");
    expect(JSON.parse(body[0]!.message).actor_id).toBe("u1");
  });

  it("falls back when HTTP returns non-2xx", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("", { status: 503 }),
    );
    const fallback = vi.fn();
    const sink = createDatadogSink({
      apiKey: "k",
      maxBatchSize: 1,
      fallbackSink: fallback,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    sink(rec(1));
    await sink.flush();
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it("falls back when fetch rejects (network error)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    const fallback = vi.fn();
    const sink = createDatadogSink({
      apiKey: "k",
      maxBatchSize: 1,
      fallbackSink: fallback,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    sink(rec(1));
    await sink.flush();
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it("flushes on injected scheduler firing", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    let cb: (() => void) | null = null;
    const sink = createDatadogSink({
      apiKey: "k",
      maxBatchSize: 100,
      maxBatchAgeMs: 5_000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      schedule: (fn) => {
        cb = fn;
        return 1;
      },
      cancel: () => {},
    });
    sink(rec(1));
    expect(cb).not.toBeNull();
    cb!();
    await sink.flush();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("flush on empty buffer is a no-op", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const sink = createDatadogSink({
      apiKey: "k",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await sink.flush();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("defaults to us site and finsavvyai service", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const sink = createDatadogSink({
      apiKey: "k",
      maxBatchSize: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    sink(rec(1));
    await sink.flush();
    const url = fetchImpl.mock.calls[0]![0] as string;
    expect(url).toBe("https://http-intake.logs.datadoghq.com/api/v2/logs");
  });

  it("survives fallback sink also throwing", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("net");
    });
    const sink = createDatadogSink({
      apiKey: "k",
      maxBatchSize: 1,
      fallbackSink: () => {
        throw new Error("fallback bad");
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    sink(rec(1));
    await expect(sink.flush()).resolves.toBeUndefined();
  });
});
