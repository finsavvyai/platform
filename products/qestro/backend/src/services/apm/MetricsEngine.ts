/**
 * MetricsEngine: Collects and aggregates system metrics
 * Time-series metrics with configurable retention and aggregation
 */

import {
  MetricPoint,
  AggregatedMetric,
  TimeRange,
  MetricsEngineConfig,
} from './types.js';

export class MetricsEngine {
  private metrics: Map<string, MetricPoint[]> = new Map();
  private aggregated: Map<string, AggregatedMetric[]> = new Map();
  private config: MetricsEngineConfig;

  constructor(config: Partial<MetricsEngineConfig> = {}) {
    this.config = {
      retentionMs: config.retentionMs ?? 86400000, // 24 hours
      aggregationIntervals: config.aggregationIntervals ?? ['minute'],
    };
  }

  /**
   * Record a metric point
   */
  recordMetric(
    name: string,
    value: number,
    tags: Record<string, string> = {}
  ): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const point: MetricPoint = {
      timestamp: Date.now(),
      value,
      tags,
    };

    const points = this.metrics.get(name)!;
    points.push(point);

    // Prune old points
    this.pruneMetric(name);
  }

  /**
   * Get raw metric points within time range
   */
  getMetrics(
    name: string,
    timeRange: TimeRange
  ): MetricPoint[] {
    const points = this.metrics.get(name) ?? [];

    return points.filter(
      (p) => p.timestamp >= timeRange.start && p.timestamp <= timeRange.end
    );
  }

  /**
   * Get aggregated metrics for a specific interval
   */
  getAggregated(
    name: string,
    interval: 'minute' | 'hour' | 'day'
  ): AggregatedMetric[] {
    const key = `${name}:${interval}`;

    if (!this.aggregated.has(key)) {
      this.aggregated.set(key, []);
    }

    return this.aggregated.get(key)!;
  }

  /**
   * Aggregate metrics for last N hours
   */
  aggregateMetrics(
    name: string,
    interval: 'minute' | 'hour' | 'day'
  ): void {
    const points = this.metrics.get(name) ?? [];

    if (points.length === 0) {
      return;
    }

    const intervalMs = this.getIntervalMs(interval);
    const buckets: Map<number, number[]> = new Map();

    // Bucket points by interval
    for (const point of points) {
      const bucket = Math.floor(point.timestamp / intervalMs) * intervalMs;

      if (!buckets.has(bucket)) {
        buckets.set(bucket, []);
      }

      buckets.get(bucket)!.push(point.value);
    }

    // Compute statistics per bucket
    const aggregated: AggregatedMetric[] = Array.from(buckets.entries())
      .map(([timestamp, values]) => ({
        timestamp,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        p95: this.percentile(values, 95),
        p99: this.percentile(values, 99),
        count: values.length,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    const key = `${name}:${interval}`;
    this.aggregated.set(key, aggregated);
  }

  /**
   * Get latest metric value
   */
  getLatestValue(name: string): number | null {
    const points = this.metrics.get(name) ?? [];

    if (points.length === 0) {
      return null;
    }

    return points[points.length - 1].value;
  }

  /**
   * Get average metric over time range
   */
  getAverage(name: string, timeRange: TimeRange): number {
    const points = this.getMetrics(name, timeRange);

    if (points.length === 0) {
      return 0;
    }

    const sum = points.reduce((acc, p) => acc + p.value, 0);

    return sum / points.length;
  }

  /**
   * Get percentile value
   */
  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;

    return sorted[Math.max(0, index)];
  }

  /**
   * Get interval in milliseconds
   */
  private getIntervalMs(
    interval: 'minute' | 'hour' | 'day'
  ): number {
    switch (interval) {
      case 'minute':
        return 60000;
      case 'hour':
        return 3600000;
      case 'day':
        return 86400000;
    }
  }

  /**
   * Remove old metric points
   */
  private pruneMetric(name: string): void {
    const now = Date.now();
    const points = this.metrics.get(name) ?? [];

    const filtered = points.filter(
      (p) => now - p.timestamp < this.config.retentionMs
    );

    if (filtered.length < points.length) {
      this.metrics.set(name, filtered);
    }
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.aggregated.clear();
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Get statistics for a metric
   */
  getStats(name: string): {
    count: number;
    latest: number | null;
    min: number;
    max: number;
    avg: number;
  } {
    const points = this.metrics.get(name) ?? [];

    if (points.length === 0) {
      return { count: 0, latest: null, min: 0, max: 0, avg: 0 };
    }

    const values = points.map((p) => p.value);

    return {
      count: points.length,
      latest: points[points.length - 1].value,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    };
  }
}
