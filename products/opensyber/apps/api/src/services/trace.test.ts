/**
 * TraceCollector Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TraceCollector, createTrace } from './trace.js';

describe('TraceCollector', () => {
  let collector: TraceCollector;

  beforeEach(() => {
    collector = new TraceCollector();
  });

  describe('startSpan', () => {
    it('returns a span object with name, category, and end method', () => {
      const span = collector.startSpan('test-span');
      expect(span.name).toBe('test-span');
      expect(span.category).toBe('api');
      expect(typeof span.end).toBe('function');
    });

    it('uses provided category', () => {
      const span = collector.startSpan('llm-call', {}, 'llm');
      expect(span.category).toBe('llm');
    });

    it('stores args on the span', () => {
      const args = { model: 'claude-haiku', tokens: 100 };
      const span = collector.startSpan('llm-call', args);
      expect(span.args).toEqual(args);
    });

    it('does not add an event until end() is called', () => {
      collector.startSpan('pending-span');
      expect(collector.flush()).toHaveLength(0);
    });
  });

  describe('span.end()', () => {
    it('records a complete event with ph "X" after end()', () => {
      const span = collector.startSpan('my-span');
      span.end();

      const events = collector.flush();
      expect(events).toHaveLength(1);
      expect(events[0]!.ph).toBe('X');
      expect(events[0]!.name).toBe('my-span');
    });

    it('records non-negative duration in microseconds', () => {
      const span = collector.startSpan('timed-span');
      span.end();

      const events = collector.flush();
      expect(events[0]!.dur).toBeGreaterThanOrEqual(0);
    });

    it('records pid as 1', () => {
      const span = collector.startSpan('pid-span');
      span.end();

      const events = collector.flush();
      expect(events[0]!.pid).toBe(1);
    });

    it('records span args on the event', () => {
      const args = { model: 'gpt-4o', latency: 320 };
      const span = collector.startSpan('arg-span', args);
      span.end();

      const events = collector.flush();
      expect(events[0]!.args).toEqual(args);
    });

    it('records the span category as cat', () => {
      const span = collector.startSpan('cat-span', {}, 'skill');
      span.end();

      const events = collector.flush();
      expect(events[0]!.cat).toBe('skill');
    });

    it('multiple spans accumulate before flush', () => {
      const s1 = collector.startSpan('span-1');
      const s2 = collector.startSpan('span-2');
      s1.end();
      s2.end();

      expect(collector.flush()).toHaveLength(2);
    });
  });

  describe('addInstantEvent', () => {
    it('records an event with dur = 0', () => {
      collector.addInstantEvent('checkpoint');
      const events = collector.flush();
      expect(events).toHaveLength(1);
      expect(events[0]!.dur).toBe(0);
    });

    it('records event name correctly', () => {
      collector.addInstantEvent('auth-complete');
      const events = collector.flush();
      expect(events[0]!.name).toBe('auth-complete');
    });

    it('records cat as "marker"', () => {
      collector.addInstantEvent('mark');
      const events = collector.flush();
      expect(events[0]!.cat).toBe('marker');
    });

    it('records provided args on the instant event', () => {
      const args = { userId: 'u-1', status: 'ok' };
      collector.addInstantEvent('login', args);
      const events = collector.flush();
      expect(events[0]!.args).toEqual(args);
    });

    it('records ph as "X"', () => {
      collector.addInstantEvent('mark');
      const events = collector.flush();
      expect(events[0]!.ph).toBe('X');
    });
  });

  describe('flush()', () => {
    it('returns all accumulated events', () => {
      collector.addInstantEvent('e1');
      collector.addInstantEvent('e2');
      const events = collector.flush();
      expect(events).toHaveLength(2);
    });

    it('clears the event buffer after flush', () => {
      collector.addInstantEvent('event');
      collector.flush();
      expect(collector.flush()).toHaveLength(0);
    });

    it('returns a snapshot — subsequent events do not modify the returned array', () => {
      collector.addInstantEvent('before');
      const snapshot = collector.flush();

      collector.addInstantEvent('after');
      expect(snapshot).toHaveLength(1);
    });

    it('returns empty array when no events recorded', () => {
      expect(collector.flush()).toEqual([]);
    });
  });

  describe('toJSON()', () => {
    it('returns valid JSON string', () => {
      collector.addInstantEvent('e');
      const json = collector.toJSON();
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('JSON contains traceEvents array', () => {
      collector.addInstantEvent('e');
      const parsed = JSON.parse(collector.toJSON()) as { traceEvents: unknown[] };
      expect(Array.isArray(parsed.traceEvents)).toBe(true);
    });

    it('traceEvents contains the recorded events', () => {
      collector.addInstantEvent('json-event', { key: 'value' });
      const parsed = JSON.parse(collector.toJSON()) as { traceEvents: Array<{ name: string }> };
      expect(parsed.traceEvents[0]!.name).toBe('json-event');
    });

    it('clears events after toJSON (flush is called internally)', () => {
      collector.addInstantEvent('one-time');
      collector.toJSON();
      expect(collector.flush()).toHaveLength(0);
    });

    it('returns empty traceEvents array when no events recorded', () => {
      const parsed = JSON.parse(collector.toJSON()) as { traceEvents: unknown[] };
      expect(parsed.traceEvents).toEqual([]);
    });
  });
});

describe('createTrace', () => {
  it('returns a TraceCollector instance', () => {
    const trace = createTrace();
    expect(trace).toBeInstanceOf(TraceCollector);
  });

  it('creates independent collectors per call', () => {
    const t1 = createTrace();
    const t2 = createTrace();
    t1.addInstantEvent('only-in-t1');
    expect(t2.flush()).toHaveLength(0);
  });
});
