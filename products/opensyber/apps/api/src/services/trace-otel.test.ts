/**
 * Unit tests for OTLP JSON conversion.
 * Verifies the output shape matches the OpenTelemetry trace.proto spec.
 */
import { describe, it, expect } from 'vitest';
import {
  eventsToOtelJson,
  toAnyValue,
  argsToAttributes,
  bytesToHex,
  randomHex,
  type InternalTraceEvent,
} from './trace-otel.js';
import { TraceCollector } from './trace.js';

const HEX_32 = /^[0-9a-f]{32}$/;
const HEX_16 = /^[0-9a-f]{16}$/;
const UNIX_NANO = /^\d+$/;

function makeEvent(overrides: Partial<InternalTraceEvent> = {}): InternalTraceEvent {
  return {
    name: 'test-span',
    cat: 'api',
    ph: 'X',
    ts: 1000,
    dur: 500,
    pid: 1,
    tid: 42,
    args: {},
    ...overrides,
  };
}

describe('toAnyValue', () => {
  it('encodes strings as stringValue', () => {
    expect(toAnyValue('hello')).toEqual({ stringValue: 'hello' });
  });

  it('encodes integers as intValue (string)', () => {
    expect(toAnyValue(42)).toEqual({ intValue: '42' });
  });

  it('encodes floats as doubleValue', () => {
    expect(toAnyValue(3.14)).toEqual({ doubleValue: 3.14 });
  });

  it('encodes booleans as boolValue', () => {
    expect(toAnyValue(true)).toEqual({ boolValue: true });
    expect(toAnyValue(false)).toEqual({ boolValue: false });
  });

  it('encodes null/undefined as empty string', () => {
    expect(toAnyValue(null)).toEqual({ stringValue: '' });
    expect(toAnyValue(undefined)).toEqual({ stringValue: '' });
  });

  it('encodes objects by JSON-stringifying', () => {
    expect(toAnyValue({ a: 1 })).toEqual({ stringValue: '{"a":1}' });
  });
});

describe('argsToAttributes', () => {
  it('returns empty array for undefined', () => {
    expect(argsToAttributes(undefined)).toEqual([]);
  });

  it('converts object entries to KeyValue pairs', () => {
    const attrs = argsToAttributes({ model: 'claude', tokens: 100 });
    expect(attrs).toEqual([
      { key: 'model', value: { stringValue: 'claude' } },
      { key: 'tokens', value: { intValue: '100' } },
    ]);
  });
});

describe('bytesToHex / randomHex', () => {
  it('hex-encodes bytes with zero-padding', () => {
    expect(bytesToHex(new Uint8Array([0, 1, 15, 255]))).toBe('00010fff');
  });

  it('randomHex(16) returns 32 hex chars', () => {
    expect(randomHex(16)).toMatch(HEX_32);
  });

  it('randomHex(8) returns 16 hex chars', () => {
    expect(randomHex(8)).toMatch(HEX_16);
  });

  it('randomHex produces different values across calls', () => {
    expect(randomHex(16)).not.toBe(randomHex(16));
  });
});

describe('eventsToOtelJson — output shape', () => {
  it('returns a resourceSpans array with one entry', () => {
    const out = eventsToOtelJson([makeEvent()]);
    expect(Array.isArray(out.resourceSpans)).toBe(true);
    expect(out.resourceSpans).toHaveLength(1);
  });

  it('resource contains service.name attribute', () => {
    const out = eventsToOtelJson([makeEvent()]);
    const resource = out.resourceSpans[0]!.resource;
    expect(resource.attributes).toContainEqual({
      key: 'service.name',
      value: { stringValue: 'opensyber-api' },
    });
  });

  it('scopeSpans contains scope with name and version', () => {
    const out = eventsToOtelJson([makeEvent()]);
    const scope = out.resourceSpans[0]!.scopeSpans[0]!.scope;
    expect(scope.name).toBe('@opensyber/api');
    expect(typeof scope.version).toBe('string');
  });

  it('produces one span per complete event', () => {
    const out = eventsToOtelJson([makeEvent({ name: 'a' }), makeEvent({ name: 'b' })]);
    expect(out.resourceSpans[0]!.scopeSpans[0]!.spans).toHaveLength(2);
  });

  it('ignores non-X phase events', () => {
    const out = eventsToOtelJson([
      makeEvent({ ph: 'B' }),
      makeEvent({ ph: 'E' }),
      makeEvent({ ph: 'X' }),
    ]);
    expect(out.resourceSpans[0]!.scopeSpans[0]!.spans).toHaveLength(1);
  });

  it('returns empty spans array when no events', () => {
    const out = eventsToOtelJson([]);
    expect(out.resourceSpans[0]!.scopeSpans[0]!.spans).toEqual([]);
  });
});

describe('eventsToOtelJson — span fields', () => {
  it('traceId is a 32-char hex string shared across spans', () => {
    const out = eventsToOtelJson([makeEvent({ name: 'a' }), makeEvent({ name: 'b' })]);
    const spans = out.resourceSpans[0]!.scopeSpans[0]!.spans;
    expect(spans[0]!.traceId).toMatch(HEX_32);
    expect(spans[0]!.traceId).toBe(spans[1]!.traceId);
  });

  it('spanId is a 16-char hex string unique per span', () => {
    const out = eventsToOtelJson([makeEvent({ name: 'a' }), makeEvent({ name: 'b' })]);
    const spans = out.resourceSpans[0]!.scopeSpans[0]!.spans;
    expect(spans[0]!.spanId).toMatch(HEX_16);
    expect(spans[1]!.spanId).toMatch(HEX_16);
    expect(spans[0]!.spanId).not.toBe(spans[1]!.spanId);
  });

  it('uses provided traceId option', () => {
    const out = eventsToOtelJson([makeEvent()], { traceId: 'a'.repeat(32) });
    expect(out.resourceSpans[0]!.scopeSpans[0]!.spans[0]!.traceId).toBe('a'.repeat(32));
  });

  it('name matches event name', () => {
    const out = eventsToOtelJson([makeEvent({ name: 'llm-proxy' })]);
    expect(out.resourceSpans[0]!.scopeSpans[0]!.spans[0]!.name).toBe('llm-proxy');
  });

  it('kind is internal (1)', () => {
    const out = eventsToOtelJson([makeEvent()]);
    expect(out.resourceSpans[0]!.scopeSpans[0]!.spans[0]!.kind).toBe(1);
  });

  it('startTimeUnixNano is a numeric string', () => {
    const out = eventsToOtelJson([makeEvent()]);
    expect(out.resourceSpans[0]!.scopeSpans[0]!.spans[0]!.startTimeUnixNano).toMatch(UNIX_NANO);
  });

  it('endTimeUnixNano >= startTimeUnixNano', () => {
    const out = eventsToOtelJson([makeEvent({ ts: 1000, dur: 500 })]);
    const span = out.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;
    expect(BigInt(span.endTimeUnixNano) >= BigInt(span.startTimeUnixNano)).toBe(true);
  });

  it('endTime - startTime equals duration in nanoseconds', () => {
    const out = eventsToOtelJson([makeEvent({ ts: 1000, dur: 500 })]);
    const span = out.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;
    const delta = BigInt(span.endTimeUnixNano) - BigInt(span.startTimeUnixNano);
    expect(delta).toBe(500_000n); // 500 micros = 500_000 nanos
  });

  it('status code is 0 (unset)', () => {
    const out = eventsToOtelJson([makeEvent()]);
    expect(out.resourceSpans[0]!.scopeSpans[0]!.spans[0]!.status).toEqual({ code: 0 });
  });

  it('attributes include category and args', () => {
    const out = eventsToOtelJson([
      makeEvent({ cat: 'llm', args: { model: 'claude', tokens: 42 } }),
    ]);
    const attrs = out.resourceSpans[0]!.scopeSpans[0]!.spans[0]!.attributes;
    expect(attrs).toContainEqual({ key: 'category', value: { stringValue: 'llm' } });
    expect(attrs).toContainEqual({ key: 'model', value: { stringValue: 'claude' } });
    expect(attrs).toContainEqual({ key: 'tokens', value: { intValue: '42' } });
  });
});

describe('TraceCollector.toOtelJson integration', () => {
  it('exposes toOtelJson() method returning OTLP shape', () => {
    const c = new TraceCollector();
    const s = c.startSpan('integration', { ok: true });
    s.end();
    const out = c.toOtelJson();
    expect(out.resourceSpans[0]!.scopeSpans[0]!.spans).toHaveLength(1);
    expect(out.resourceSpans[0]!.scopeSpans[0]!.spans[0]!.name).toBe('integration');
  });

  it('toOtelJson() is non-destructive (does not flush)', () => {
    const c = new TraceCollector();
    c.addInstantEvent('mark');
    c.toOtelJson();
    // Perfetto format should still have the event
    expect(c.flush()).toHaveLength(1);
  });

  it('toOtelJson() accepts a custom traceId', () => {
    const c = new TraceCollector();
    c.addInstantEvent('mark');
    const out = c.toOtelJson({ traceId: 'f'.repeat(32) });
    expect(out.resourceSpans[0]!.scopeSpans[0]!.spans[0]!.traceId).toBe('f'.repeat(32));
  });
});
