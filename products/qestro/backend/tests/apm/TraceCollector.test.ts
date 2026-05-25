/**
 * TraceCollector Tests
 */

import { TraceCollector } from '../../src/services/apm/TraceCollector.js';

describe('TraceCollector', () => {
  let collector: TraceCollector;

  beforeEach(() => {
    collector = new TraceCollector({
      maxTracesInBuffer: 100,
      enableAutoFlush: false,
    });
  });

  it('should start a trace', () => {
    const trace = collector.startTrace('test-trace', { app: 'qestro' });

    expect(trace.name).toBe('test-trace');
    expect(trace.status).toBe('pending');
    expect(trace.metadata.app).toBe('qestro');
    expect(trace.spans.length).toBeGreaterThan(0);
  });

  it('should start and end spans', () => {
    const trace = collector.startTrace('test-trace');

    const span = collector.startSpan(
      trace.traceId,
      'operation-1',
      trace.rootSpanId
    );

    expect(span.name).toBe('operation-1');
    expect(span.status).toBe('pending');

    collector.endSpan(span.spanId, 'ok', { result: 'success' });

    expect(span.status).toBe('ok');
    expect(span.duration).toBeGreaterThanOrEqual(0);
  });

  it('should end trace and calculate duration', async () => {
    const trace = collector.startTrace('test-trace');

    const span1 = collector.startSpan(
      trace.traceId,
      'step-1',
      trace.rootSpanId
    );

    await new Promise((resolve) => setTimeout(resolve, 10));

    collector.endSpan(span1.spanId, 'ok');

    const endedTrace = collector.endTrace(trace.traceId);

    expect(endedTrace.duration).toBeGreaterThanOrEqual(10);
    expect(endedTrace.status).toBe('ok');
  });

  it('should mark trace as error if any span fails', () => {
    const trace = collector.startTrace('test-trace');

    const span = collector.startSpan(
      trace.traceId,
      'failing-operation',
      trace.rootSpanId
    );

    collector.endSpan(span.spanId, 'error');

    const endedTrace = collector.endTrace(trace.traceId);

    expect(endedTrace.status).toBe('error');
  });

  it('should retrieve trace by ID', () => {
    const trace = collector.startTrace('test-trace');

    const retrieved = collector.getTrace(trace.traceId);

    expect(retrieved).toBeDefined();
    expect(retrieved?.traceId).toBe(trace.traceId);
  });

  it('should get recent traces sorted by start time', () => {
    const trace1 = collector.startTrace('trace-1');
    const trace2 = collector.startTrace('trace-2');
    const trace3 = collector.startTrace('trace-3');

    const recent = collector.getRecentTraces(2);

    expect(recent.length).toBe(2);
    expect(recent[0].traceId).toBe(trace3.traceId);
    expect(recent[1].traceId).toBe(trace2.traceId);
  });

  it('should identify bottlenecks', async () => {
    const trace = collector.startTrace('test-trace');

    const slowSpan = collector.startSpan(
      trace.traceId,
      'slow-operation',
      trace.rootSpanId
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    collector.endSpan(slowSpan.spanId, 'ok');

    const fastSpan = collector.startSpan(
      trace.traceId,
      'fast-operation',
      trace.rootSpanId
    );

    collector.endSpan(fastSpan.spanId, 'ok');

    collector.endTrace(trace.traceId);

    const bottlenecks = collector.getBottlenecks(trace.traceId);

    expect(bottlenecks.length).toBeGreaterThan(0);
    expect(bottlenecks[0].name).toContain('slow');
  });

  it('should get collector statistics', () => {
    collector.startTrace('trace-1');
    collector.startTrace('trace-2');

    const stats = collector.getStats();

    expect(stats.totalTraces).toBe(2);
    expect(stats.totalSpans).toBeGreaterThanOrEqual(2);
  });

  it('should clear all traces', () => {
    collector.startTrace('trace-1');
    collector.startTrace('trace-2');

    collector.clear();

    expect(collector.getStats().totalTraces).toBe(0);
  });
});
