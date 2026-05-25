/**
 * Datadog sink — HTTPS POST to the Datadog Logs intake.
 *
 * Contract:
 *  - Batches records; flushes on size or age.
 *  - Never throws; fallback writes on HTTP / network failure.
 *  - Uses global fetch (Node 20+, Cloudflare Workers).
 *  - Site selectable: us, us3, us5, eu, ap1.
 */

import type { AuditRecord, AuditSink } from "../types.js";
import { createStdoutSink } from "./stdout.js";

export type DatadogSite = "us" | "us3" | "us5" | "eu" | "ap1";

export type DatadogSinkOptions = {
  readonly apiKey: string;
  readonly site?: DatadogSite;
  readonly service?: string;
  readonly source?: string;
  readonly maxBatchSize?: number;
  readonly maxBatchAgeMs?: number;
  readonly fallbackSink?: AuditSink;
  readonly fetchImpl?: typeof fetch;
  readonly schedule?: (cb: () => void, ms: number) => unknown;
  readonly cancel?: (handle: unknown) => void;
};

export interface DatadogSinkHandle {
  (record: AuditRecord): void;
  flush(): Promise<void>;
}

const SITE_HOSTS: Record<DatadogSite, string> = {
  us: "http-intake.logs.datadoghq.com",
  us3: "http-intake.logs.us3.datadoghq.com",
  us5: "http-intake.logs.us5.datadoghq.com",
  eu: "http-intake.logs.datadoghq.eu",
  ap1: "http-intake.logs.ap1.datadoghq.com",
};

const buildUrl = (site: DatadogSite): string =>
  `https://${SITE_HOSTS[site]}/api/v2/logs`;

const toPayload = (
  records: ReadonlyArray<AuditRecord>,
  service: string,
  source: string,
): string =>
  JSON.stringify(
    records.map((r) => ({
      ddsource: source,
      service,
      hostname: "finsavvyai",
      ddtags: `event:${r.event},decision:${r.decision}`,
      timestamp: r.ts,
      message: JSON.stringify(r),
    })),
  );

export const createDatadogSink = (
  options: DatadogSinkOptions,
): DatadogSinkHandle => {
  if (typeof options.apiKey !== "string" || options.apiKey.length === 0) {
    throw new Error("datadog sink: apiKey is required");
  }
  const site = options.site ?? "us";
  const service = options.service ?? "finsavvyai";
  const source = options.source ?? "finsavvyai-audit";
  const maxBatchSize = options.maxBatchSize ?? 50;
  const maxBatchAgeMs = options.maxBatchAgeMs ?? 30_000;
  const fallback = options.fallbackSink ?? createStdoutSink();
  const doFetch = options.fetchImpl ?? fetch;
  const schedule = options.schedule ?? ((cb, ms) => setTimeout(cb, ms));
  const cancel = options.cancel ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const url = buildUrl(site);

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
      const res = await doFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "DD-API-KEY": options.apiKey,
        },
        body: toPayload(batch, service, source),
      });
      if (!res.ok) throw new Error(`datadog: HTTP ${res.status}`);
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
  }) as DatadogSinkHandle;

  sink.flush = async (): Promise<void> => {
    inflight = inflight.then(() => flushNow());
    await inflight;
  };

  return sink;
};
