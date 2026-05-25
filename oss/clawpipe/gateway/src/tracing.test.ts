/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  newTraceId, newSpanId, parseTraceparent, newRootContext, formatTraceparent,
  withSpan, type SpanLog,
} from './tracing';

describe('newTraceId / newSpanId', () => {
  it('produces 32-char hex trace id', () => {
    const id = newTraceId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });
  it('produces 16-char hex span id', () => {
    expect(newSpanId()).toMatch(/^[0-9a-f]{16}$/);
  });
  it('ids are unique across calls', () => {
    const a = newTraceId(); const b = newTraceId();
    expect(a).not.toBe(b);
  });
});

describe('parseTraceparent', () => {
  it('returns null on null/empty', () => {
    expect(parseTraceparent(null)).toBeNull();
    expect(parseTraceparent('')).toBeNull();
  });
  it('returns null on malformed input', () => {
    expect(parseTraceparent('garbage')).toBeNull();
    expect(parseTraceparent('00-too-short-flags')).toBeNull();
  });
  it('returns null on non-00 version', () => {
    const tp = '01-' + 'a'.repeat(32) + '-' + 'b'.repeat(16) + '-01';
    expect(parseTraceparent(tp)).toBeNull();
  });
  it('returns null on all-zero ids', () => {
    const tpz = '00-' + '0'.repeat(32) + '-' + 'b'.repeat(16) + '-01';
    const tps = '00-' + 'a'.repeat(32) + '-' + '0'.repeat(16) + '-01';
    expect(parseTraceparent(tpz)).toBeNull();
    expect(parseTraceparent(tps)).toBeNull();
  });
  it('parses a well-formed traceparent', () => {
    const tp = '00-' + 'a'.repeat(32) + '-' + 'b'.repeat(16) + '-01';
    const ctx = parseTraceparent(tp);
    expect(ctx).not.toBeNull();
    expect(ctx!.traceId).toBe('a'.repeat(32));
    expect(ctx!.parentSpanId).toBe('b'.repeat(16));
    expect(ctx!.sampled).toBe(true);
    expect(ctx!.spanId).toMatch(/^[0-9a-f]{16}$/);
  });
  it('reads sampled=false when flag bit 0 is unset', () => {
    const tp = '00-' + 'a'.repeat(32) + '-' + 'b'.repeat(16) + '-00';
    expect(parseTraceparent(tp)!.sampled).toBe(false);
  });
});

describe('newRootContext + formatTraceparent', () => {
  it('round-trips through formatTraceparent', () => {
    const ctx = newRootContext();
    const out = parseTraceparent(formatTraceparent(ctx));
    expect(out!.traceId).toBe(ctx.traceId);
    // out.spanId is regenerated as the child span id; parentSpanId carries the source spanId.
    expect(out!.parentSpanId).toBe(ctx.spanId);
  });
  it('sets flags=00 when sampled=false', () => {
    const ctx = newRootContext(false);
    expect(formatTraceparent(ctx).endsWith('-00')).toBe(true);
  });
});

describe('withSpan', () => {
  it('emits a span log on success', async () => {
    const lines: string[] = [];
    const parent = newRootContext(true);
    const result = await withSpan(parent, 'test.span', async () => 42,
      { foo: 'bar' }, (l) => lines.push(l));
    expect(result).toBe(42);
    expect(lines).toHaveLength(1);
    const log = JSON.parse(lines[0]) as SpanLog;
    expect(log.name).toBe('test.span');
    expect(log.status).toBe('ok');
    expect(log.trace_id).toBe(parent.traceId);
    expect(log.parent_span_id).toBe(parent.spanId);
    expect(log.attrs).toEqual({ foo: 'bar' });
    expect(log.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('emits status=error and rethrows on failure', async () => {
    const lines: string[] = [];
    const parent = newRootContext(true);
    await expect(withSpan(parent, 'fail.span', async () => {
      throw new Error('boom');
    }, undefined, (l) => lines.push(l))).rejects.toThrow('boom');
    expect(lines).toHaveLength(1);
    const log = JSON.parse(lines[0]) as SpanLog;
    expect(log.status).toBe('error');
    expect(log.attrs).toMatchObject({ error: 'boom' });
  });

  it('skips emission when parent.sampled is false', async () => {
    const lines: string[] = [];
    const parent = newRootContext(false);
    await withSpan(parent, 'silent', async () => 1, undefined, (l) => lines.push(l));
    expect(lines).toHaveLength(0);
  });

  it('captures sync return values too', async () => {
    const lines: string[] = [];
    const parent = newRootContext(true);
    const out = await withSpan(parent, 'sync', () => 'hello', undefined, (l) => lines.push(l));
    expect(out).toBe('hello');
    expect(lines).toHaveLength(1);
  });
});
