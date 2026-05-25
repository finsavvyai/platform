/**
 * R2 sink — batches audit records, gzip-compressed JSONL, written to an
 * R2 bucket binding. Key pattern: audit/yyyy/mm/dd/hh/<uuid>.jsonl.gz
 *
 * Contract:
 *  - Flush on batch size OR max age.
 *  - Never throws; fallback writes to stdout (or supplied fallback sink).
 *  - Works in Cloudflare Workers and Node 20+ (uses CompressionStream).
 */

import type { AuditRecord, AuditSink, R2BucketLike } from "../types.js";
import { createStdoutSink } from "./stdout.js";

export type R2SinkOptions = {
  readonly bucket: R2BucketLike;
  /** Records per batch before forced flush. Default 100. */
  readonly maxBatchSize?: number;
  /** Max age in ms before a partial batch is flushed. Default 60_000. */
  readonly maxBatchAgeMs?: number;
  /** Called when R2 fails — defaults to stdout sink. */
  readonly fallbackSink?: AuditSink;
  /** Clock — injectable for tests. */
  readonly clock?: () => Date;
  /** UUID factory — injectable for tests. */
  readonly idFactory?: () => string;
  /** Schedules `cb` after `ms`. Defaults to setTimeout. */
  readonly schedule?: (cb: () => void, ms: number) => unknown;
  /** Cancels a scheduled timer. Defaults to clearTimeout. */
  readonly cancel?: (handle: unknown) => void;
};

export interface R2SinkHandle {
  (record: AuditRecord): void;
  /** Force-flush whatever is buffered. Returns a promise resolved on completion. */
  flush(): Promise<void>;
}

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

const buildKey = (now: Date, uuid: string): string => {
  const y = now.getUTCFullYear();
  const m = pad2(now.getUTCMonth() + 1);
  const d = pad2(now.getUTCDate());
  const h = pad2(now.getUTCHours());
  return `audit/${y}/${m}/${d}/${h}/${uuid}.jsonl.gz`;
};

const defaultIdFactory = (): string => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback for very old runtimes — RFC4122 v4 best-effort.
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0")}`;
};

const encodeJsonl = (records: ReadonlyArray<AuditRecord>): Uint8Array => {
  const text = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  return new TextEncoder().encode(text);
};

const gzip = async (bytes: Uint8Array): Promise<Uint8Array> => {
  const cs = new (globalThis as unknown as {
    CompressionStream: new (algo: string) => TransformStream<Uint8Array, Uint8Array>;
  }).CompressionStream("gzip");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(cs);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
};

export const createR2Sink = (options: R2SinkOptions): R2SinkHandle => {
  const maxBatchSize = options.maxBatchSize ?? 100;
  const maxBatchAgeMs = options.maxBatchAgeMs ?? 60_000;
  const fallback = options.fallbackSink ?? createStdoutSink();
  const clock = options.clock ?? (() => new Date());
  const idFactory = options.idFactory ?? defaultIdFactory;
  const schedule = options.schedule ?? ((cb, ms) => setTimeout(cb, ms));
  const cancel = options.cancel ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let buffer: AuditRecord[] = [];
  let timer: unknown = null;
  let inflight: Promise<void> = Promise.resolve();

  const flushNow = async (): Promise<void> => {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    if (timer !== null) {
      cancel(timer);
      timer = null;
    }
    try {
      const bytes = await gzip(encodeJsonl(batch));
      const key = buildKey(clock(), idFactory());
      await options.bucket.put(key, bytes, {
        httpMetadata: { contentType: "application/x-ndjson", contentEncoding: "gzip" },
      });
    } catch {
      for (const rec of batch) {
        try {
          fallback(rec);
        } catch {
          // swallow.
        }
      }
    }
  };

  const scheduleFlush = (): void => {
    if (timer !== null) return;
    timer = schedule(() => {
      timer = null;
      inflight = inflight.then(() => flushNow());
    }, maxBatchAgeMs);
  };

  const sink = ((record: AuditRecord): void => {
    buffer.push(record);
    if (buffer.length >= maxBatchSize) {
      inflight = inflight.then(() => flushNow());
    } else {
      scheduleFlush();
    }
  }) as R2SinkHandle;

  sink.flush = async (): Promise<void> => {
    inflight = inflight.then(() => flushNow());
    await inflight;
  };

  return sink;
};
