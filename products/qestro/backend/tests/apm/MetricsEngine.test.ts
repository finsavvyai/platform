/**
 * MetricsEngine Tests
 */

import { MetricsEngine } from '../../src/services/apm/MetricsEngine.js';

describe('MetricsEngine', () => {
  let engine: MetricsEngine;

  beforeEach(() => {
    engine = new MetricsEngine({
      retentionMs: 86400000,
      aggregationIntervals: ['minute', 'hour'],
    });
  });

  it('should record metrics', () => {
    engine.recordMetric('request_duration', 100, {
      endpoint: '/api/test',
    });

    const stats = engine.getStats('request_duration');

    expect(stats.count).toBe(1);
    expect(stats.latest).toBe(100);
  });

  it('should get latest metric value', () => {
    engine.recordMetric('test_metric', 10);
    engine.recordMetric('test_metric', 20);
    engine.recordMetric('test_metric', 30);

    const latest = engine.getLatestValue('test_metric');

    expect(latest).toBe(30);
  });

  it('should get metrics within time range', () => {
    const now = Date.now();

    engine.recordMetric('test_metric', 10);
    engine.recordMetric('test_metric', 20);
    engine.recordMetric('test_metric', 30);

    const metrics = engine.getMetrics('test_metric', {
      start: now - 10000,
      end: now + 10000,
    });

    expect(metrics.length).toBe(3);
  });

  it('should calculate average metric', () => {
    const now = Date.now();

    engine.recordMetric('test_metric', 10);
    engine.recordMetric('test_metric', 20);
    engine.recordMetric('test_metric', 30);

    const avg = engine.getAverage('test_metric', {
      start: now - 10000,
      end: now + 10000,
    });

    expect(avg).toBe(20);
  });

  it('should aggregate metrics by minute', () => {
    for (let i = 0; i < 60; i++) {
      engine.recordMetric('test_metric', Math.random() * 100);
    }

    engine.aggregateMetrics('test_metric', 'minute');
    const aggregated = engine.getAggregated('test_metric', 'minute');

    expect(aggregated.length).toBeGreaterThan(0);
    expect(aggregated[0].min).toBeLessThanOrEqual(aggregated[0].max);
    expect(aggregated[0].avg).toBeGreaterThanOrEqual(
      aggregated[0].min
    );
    expect(aggregated[0].avg).toBeLessThanOrEqual(aggregated[0].max);
  });

  it('should calculate percentiles', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    for (const value of values) {
      engine.recordMetric('test_metric', value);
    }

    engine.aggregateMetrics('test_metric', 'minute');
    const aggregated = engine.getAggregated('test_metric', 'minute');

    expect(aggregated[0].p95).toBeGreaterThan(aggregated[0].p99);
  });

  it('should get metric statistics', () => {
    engine.recordMetric('test_metric', 10);
    engine.recordMetric('test_metric', 20);
    engine.recordMetric('test_metric', 30);

    const stats = engine.getStats('test_metric');

    expect(stats.count).toBe(3);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(30);
    expect(stats.avg).toBe(20);
    expect(stats.latest).toBe(30);
  });

  it('should get all metric names', () => {
    engine.recordMetric('metric1', 10);
    engine.recordMetric('metric2', 20);
    engine.recordMetric('metric3', 30);

    const names = engine.getMetricNames();

    expect(names).toContain('metric1');
    expect(names).toContain('metric2');
    expect(names).toContain('metric3');
  });

  it('should clear all metrics', () => {
    engine.recordMetric('metric1', 10);
    engine.recordMetric('metric2', 20);

    engine.clear();

    expect(engine.getMetricNames().length).toBe(0);
  });

  it('should prune old metrics based on retention', () => {
    engine = new MetricsEngine({ retentionMs: 100 });

    engine.recordMetric('test_metric', 10);

    // Wait for retention to pass
    return new Promise((resolve) => {
      setTimeout(() => {
        engine.recordMetric('test_metric', 20); // Forces prune

        const stats = engine.getStats('test_metric');

        expect(stats.count).toBeLessThanOrEqual(1);
        resolve(undefined);
      }, 150);
    });
  });
});
