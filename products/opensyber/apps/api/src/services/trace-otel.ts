/**
 * OpenTelemetry OTLP/JSON conversion for TraceCollector events.
 *
 * Converts internal Chrome-Trace-Event-style spans into the OTLP
 * JSON shape described in:
 *   opentelemetry-proto/opentelemetry/proto/trace/v1/trace.proto
 *
 * Output shape:
 *   {
 *     resourceSpans: [{
 *       resource: { attributes: [...] },
 *       scopeSpans: [{
 *         scope: { name, version },
 *         spans: [{ traceId, spanId, name, startTimeUnixNano,
 *                   endTimeUnixNano, kind, attributes, status }]
 *       }]
 *     }]
 *   }
 */

export interface OtelKeyValue {
  key: string;
  value: OtelAnyValue;
}

export type OtelAnyValue =
  | { stringValue: string }
  | { intValue: string }
  | { doubleValue: number }
  | { boolValue: boolean };

export interface OtelSpan {
  traceId: string;
  spanId: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtelKeyValue[];
  status: { code: number };
}

export interface OtelScopeSpans {
  scope: { name: string; version: string };
  spans: OtelSpan[];
}

export interface OtelResourceSpans {
  resource: { attributes: OtelKeyValue[] };
  scopeSpans: OtelScopeSpans[];
}

export interface OtelTracePayload {
  resourceSpans: OtelResourceSpans[];
}

/** Internal event shape shared with TraceCollector. */
export interface InternalTraceEvent {
  name: string;
  cat: string;
  ph: 'B' | 'E' | 'X';
  ts: number; // microseconds since process start
  dur?: number; // microseconds
  pid: number;
  tid: number;
  args?: Record<string, unknown>;
}

const SCOPE_NAME = '@opensyber/api';
const SCOPE_VERSION = '1.0.0';
const SERVICE_NAME = 'opensyber-api';
const SPAN_KIND_INTERNAL = 1;
const STATUS_UNSET = 0;

/** Convert a JS value to an OTLP AnyValue. Unsupported values are stringified. */
export function toAnyValue(value: unknown): OtelAnyValue {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { boolValue: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { intValue: String(value) };
    return { doubleValue: value };
  }
  if (value === null || value === undefined) return { stringValue: '' };
  return { stringValue: JSON.stringify(value) };
}

/** Convert an args object to an array of OTLP KeyValue. */
export function argsToAttributes(args: Record<string, unknown> | undefined): OtelKeyValue[] {
  if (!args) return [];
  return Object.entries(args).map(([key, value]) => ({ key, value: toAnyValue(value) }));
}

/** Hex-encode a Uint8Array. */
export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

/** Generate a random hex string of `byteLength` bytes (2 chars per byte). */
export function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/**
 * Convert microseconds (relative to process start) into a stable
 * absolute nanosecond timestamp string. OTLP requires Unix-nano strings,
 * but we do not have a true wall clock per span — we anchor every trace
 * to `wallClockAnchorMs` (Date.now at export time) so timestamps are
 * monotonic and comparable within a single trace.
 */
export function microsToUnixNano(micros: number, anchorNs: bigint): string {
  const nanos = anchorNs + BigInt(Math.round(micros * 1000));
  return nanos.toString();
}

/**
 * Convert internal TraceCollector events to an OTLP JSON payload.
 *
 * - `traceId` (16 bytes hex, 32 chars) is shared across all spans.
 * - `spanId`  (8 bytes hex, 16 chars) is generated per span.
 * - Only complete events (`ph === 'X'`) are exported; begin/end pairs
 *   are not currently produced by TraceCollector.
 */
export function eventsToOtelJson(
  events: InternalTraceEvent[],
  options: { traceId?: string; wallClockAnchorMs?: number } = {},
): OtelTracePayload {
  const traceId = options.traceId ?? randomHex(16);
  const anchorMs = options.wallClockAnchorMs ?? Date.now();
  // Anchor = wall clock - earliest event ts, so earliest span starts "now-ish".
  const earliestMicros = events.length > 0 ? Math.min(...events.map((e) => e.ts)) : 0;
  const anchorNs = BigInt(anchorMs) * 1_000_000n - BigInt(Math.round(earliestMicros * 1000));

  const spans: OtelSpan[] = events
    .filter((event) => event.ph === 'X')
    .map((event) => {
      const startUs = event.ts;
      const endUs = event.ts + (event.dur ?? 0);
      return {
        traceId,
        spanId: randomHex(8),
        name: event.name,
        kind: SPAN_KIND_INTERNAL,
        startTimeUnixNano: microsToUnixNano(startUs, anchorNs),
        endTimeUnixNano: microsToUnixNano(endUs, anchorNs),
        attributes: [
          { key: 'category', value: { stringValue: event.cat } },
          ...argsToAttributes(event.args),
        ],
        status: { code: STATUS_UNSET },
      };
    });

  return {
    resourceSpans: [
      {
        resource: {
          attributes: [{ key: 'service.name', value: { stringValue: SERVICE_NAME } }],
        },
        scopeSpans: [
          {
            scope: { name: SCOPE_NAME, version: SCOPE_VERSION },
            spans,
          },
        ],
      },
    ],
  };
}
