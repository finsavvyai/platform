import { describe, it, expect, vi } from "vitest";
import { gunzipSync } from "node:zlib";

import { createR2Sink } from "./r2.js";
import type { AuditRecord, R2BucketLike } from "../types.js";

const rec = (i: number): AuditRecord => ({
  ts: "2026-05-25T01:02:03.000Z",
  actor_id: `user_${i}`,
  event: "test",
  resource: "r",
  decision: "allow",
  reason: "ok",
});

const makeBucket = (): {
  bucket: R2BucketLike;
  puts: { key: string; value: Uint8Array }[];
} => {
  const puts: { key: string; value: Uint8Array }[] = [];
  const bucket: R2BucketLike = {
    put: async (key, value) => {
      const bytes =
        value instanceof Uint8Array
          ? value
          : value instanceof ArrayBuffer
          ? new Uint8Array(value)
          : new TextEncoder().encode(String(value));
      puts.push({ key, value: bytes });
    },
  };
  return { bucket, puts };
};

describe("r2 sink", () => {
  it("flushes when batch reaches maxBatchSize and writes gzipped JSONL", async () => {
    const { bucket, puts } = makeBucket();
    const sink = createR2Sink({
      bucket,
      maxBatchSize: 3,
      maxBatchAgeMs: 60_000,
      clock: () => new Date("2026-05-25T01:02:03.000Z"),
      idFactory: () => "11111111-1111-4111-8111-111111111111",
    });
    sink(rec(1));
    sink(rec(2));
    sink(rec(3));
    await sink.flush();
    expect(puts).toHaveLength(1);
    const put = puts[0];
    if (!put) throw new Error("no put");
    expect(put.key).toBe(
      "audit/2026/05/25/01/11111111-1111-4111-8111-111111111111.jsonl.gz",
    );
    const decoded = gunzipSync(put.value).toString("utf8");
    const lines = decoded.trimEnd().split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]!).actor_id).toBe("user_1");
    expect(JSON.parse(lines[2]!).actor_id).toBe("user_3");
  });

  it("flushes on max age via injected scheduler", async () => {
    const { bucket, puts } = makeBucket();
    let scheduledCb: (() => void) | null = null;
    const sink = createR2Sink({
      bucket,
      maxBatchSize: 100,
      maxBatchAgeMs: 1_000,
      clock: () => new Date("2026-05-25T01:02:03.000Z"),
      idFactory: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      schedule: (cb) => {
        scheduledCb = cb;
        return 1;
      },
      cancel: () => {},
    });
    sink(rec(1));
    sink(rec(2));
    expect(scheduledCb).not.toBeNull();
    scheduledCb!();
    await sink.flush();
    expect(puts).toHaveLength(1);
    const decoded = gunzipSync(puts[0]!.value).toString("utf8");
    expect(decoded.trimEnd().split("\n")).toHaveLength(2);
  });

  it("falls back to fallback sink when R2 throws — never throws itself", async () => {
    const bucket: R2BucketLike = {
      put: async () => {
        throw new Error("502 bad gateway");
      },
    };
    const fallback = vi.fn();
    const sink = createR2Sink({
      bucket,
      maxBatchSize: 2,
      maxBatchAgeMs: 60_000,
      fallbackSink: fallback,
      clock: () => new Date("2026-05-25T01:02:03.000Z"),
      idFactory: () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    sink(rec(1));
    sink(rec(2));
    await expect(sink.flush()).resolves.toBeUndefined();
    expect(fallback).toHaveBeenCalledTimes(2);
  });

  it("flush on empty buffer is a no-op", async () => {
    const { bucket, puts } = makeBucket();
    const sink = createR2Sink({ bucket });
    await sink.flush();
    expect(puts).toHaveLength(0);
  });

  it("default idFactory falls back when crypto.randomUUID is missing", async () => {
    const realCrypto = (globalThis as { crypto?: unknown }).crypto;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      get: () => undefined,
    });
    const { bucket, puts } = makeBucket();
    try {
      const sink = createR2Sink({
        bucket,
        maxBatchSize: 1,
        clock: () => new Date("2026-05-25T01:02:03.000Z"),
      });
      sink(rec(1));
      await sink.flush();
      expect(puts).toHaveLength(1);
      // Format: audit/2026/05/25/01/<id>.jsonl.gz — id is the fallback shape.
      expect(puts[0]!.key).toMatch(
        /^audit\/2026\/05\/25\/01\/00000000-0000-4000-8000-[0-9a-f]{12}\.jsonl\.gz$/,
      );
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: realCrypto,
      });
    }
  });

  it("default idFactory uses crypto.randomUUID when present", async () => {
    const { bucket, puts } = makeBucket();
    const sink = createR2Sink({
      bucket,
      maxBatchSize: 1,
      clock: () => new Date("2026-05-25T01:02:03.000Z"),
    });
    sink(rec(1));
    await sink.flush();
    // RFC4122 v4 UUID pattern.
    expect(puts[0]!.key).toMatch(
      /^audit\/2026\/05\/25\/01\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jsonl\.gz$/,
    );
  });

  it("survives fallback sink throwing", async () => {
    const bucket: R2BucketLike = {
      put: async () => {
        throw new Error("nope");
      },
    };
    const sink = createR2Sink({
      bucket,
      maxBatchSize: 1,
      fallbackSink: () => {
        throw new Error("fallback dead too");
      },
    });
    sink(rec(1));
    await expect(sink.flush()).resolves.toBeUndefined();
  });
});
