/**
 * Analytics event ingest.
 *
 * Pattern mirrors audit-log:
 *  - Accepts a sink; never throws.
 *  - Sink errors are routed to the fallback sink.
 *  - Every event passes through `redact()` before persistence.
 *  - Rejects NaN / Infinity values (returns null + reports via fallback).
 */

import { DEFAULT_REDACT_KEYS, redact } from "../redact.js";
import type {
  AnalyticsAttributes,
  AnalyticsEvent,
  AnalyticsEventInput,
  AnalyticsScalar,
} from "./types.js";

export type EventSink = (event: AnalyticsEvent) => void;

export type IngestorOptions = {
  readonly sink?: EventSink;
  readonly fallbackSink?: EventSink;
  readonly redactKeys?: readonly string[];
  readonly clock?: () => Date;
  readonly idFactory?: () => string;
};

const defaultSink: EventSink = (event) => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ analytics: true, ...event }));
};

const defaultFallbackSink: EventSink = (event) => {
  try {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ analytics_fallback: true, event }));
  } catch {
    // last resort.
  }
};

const isFiniteNumber = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);

const coerceScalar = (v: unknown): AnalyticsScalar => {
  if (v === null) return null;
  if (typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return String(v);
};

const sanitizeAttributes = (
  raw: Readonly<Record<string, unknown>> | undefined,
  redactKeys: readonly string[],
): AnalyticsAttributes => {
  if (!raw) return Object.freeze({});
  const safe = redact(raw, { keys: redactKeys }) as Record<string, unknown>;
  const out: Record<string, AnalyticsScalar> = {};
  for (const [k, v] of Object.entries(safe)) {
    out[k] = coerceScalar(v);
  }
  return Object.freeze(out);
};

const toIso = (input: Date | string | undefined, clock: () => Date): string => {
  if (input === undefined) return clock().toISOString();
  if (typeof input === "string") {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? clock().toISOString() : d.toISOString();
  }
  return Number.isNaN(input.getTime())
    ? clock().toISOString()
    : input.toISOString();
};

let monotonicCounter = 0;
const defaultIdFactory = (): string => {
  monotonicCounter += 1;
  return `evt_${Date.now().toString(36)}_${monotonicCounter.toString(36)}`;
};

export class AnalyticsIngestor {
  private readonly sink: EventSink;
  private readonly fallbackSink: EventSink;
  private readonly redactKeys: readonly string[];
  private readonly clock: () => Date;
  private readonly idFactory: () => string;

  constructor(options: IngestorOptions = {}) {
    this.sink = options.sink ?? defaultSink;
    this.fallbackSink = options.fallbackSink ?? defaultFallbackSink;
    this.redactKeys = options.redactKeys ?? DEFAULT_REDACT_KEYS;
    this.clock = options.clock ?? (() => new Date());
    this.idFactory = options.idFactory ?? defaultIdFactory;
  }

  /**
   * Ingest one event. Returns the persisted record, or `null` on rejection
   * (invalid value). Never throws.
   */
  ingest(input: AnalyticsEventInput): AnalyticsEvent | null {
    if (!isFiniteNumber(input.value)) {
      this.runFallbackInvalid(input);
      return null;
    }
    if (typeof input.name !== "string" || input.name.length === 0) {
      this.runFallbackInvalid(input);
      return null;
    }
    const event: AnalyticsEvent = Object.freeze({
      id: this.idFactory(),
      ts: toIso(input.ts, this.clock),
      name: input.name,
      value: input.value,
      attributes: sanitizeAttributes(input.attributes, this.redactKeys),
    });
    try {
      this.sink(event);
    } catch (err) {
      this.runFallback(event, err);
    }
    return event;
  }

  private runFallback(event: AnalyticsEvent, err: unknown): void {
    try {
      this.fallbackSink(event);
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          analytics_sink_error: true,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    } catch {
      // swallow.
    }
  }

  private runFallbackInvalid(input: AnalyticsEventInput): void {
    try {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          analytics_invalid: true,
          name: typeof input.name === "string" ? input.name : "[unnamed]",
        }),
      );
    } catch {
      // swallow.
    }
  }
}

export const createAnalyticsIngestor = (
  options: IngestorOptions = {},
): AnalyticsIngestor => new AnalyticsIngestor(options);
