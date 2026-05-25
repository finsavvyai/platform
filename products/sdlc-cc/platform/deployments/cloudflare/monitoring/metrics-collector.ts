// Metrics collection for worker observability

import type { ObservabilityConfig, MetricData, WorkerMetrics } from './observability-types';

export class MetricsCollector {
  private config: ObservabilityConfig;
  private metrics: WorkerMetrics;
  private startTime: number;

  constructor(config: ObservabilityConfig) {
    this.config = config;
    this.startTime = Date.now();
    this.metrics = {
      requestsTotal: 0,
      requestDuration: [],
      activeRequests: 0,
      errorsTotal: 0,
      errorRate: 0,
      cpuTime: 0,
      memoryUsage: 0,
      documentsProcessed: 0,
      vectorSearches: 0,
      authentications: 0,
      customMetrics: new Map()
    };
  }

  startRequest(): void {
    this.metrics.requestsTotal++;
    this.metrics.activeRequests++;
  }

  endRequest(duration: number): void {
    this.metrics.activeRequests--;
    this.metrics.requestDuration.push(duration);

    if (this.metrics.requestDuration.length > 1000) {
      this.metrics.requestDuration = this.metrics.requestDuration.slice(-1000);
    }
  }

  recordError(): void {
    this.metrics.errorsTotal++;
    this.calculateErrorRate();
  }

  private calculateErrorRate(): void {
    if (this.metrics.requestsTotal > 0) {
      this.metrics.errorRate = this.metrics.errorsTotal / this.metrics.requestsTotal;
    }
  }

  recordCpuTime(ms: number): void {
    this.metrics.cpuTime += ms;
  }

  recordMemoryUsage(bytes: number): void {
    this.metrics.memoryUsage = bytes;
  }

  incrementDocumentsProcessed(): void {
    this.metrics.documentsProcessed++;
  }

  incrementVectorSearches(): void {
    this.metrics.vectorSearches++;
  }

  incrementAuthentications(): void {
    this.metrics.authentications++;
  }

  recordCustomMetric(
    name: string,
    value: number,
    tags: Record<string, string> = {},
    type: 'counter' | 'gauge' | 'histogram' = 'counter'
  ): void {
    const metric: MetricData = {
      name,
      value,
      timestamp: Date.now(),
      tags: {
        service: this.config.service,
        environment: this.config.environment,
        ...tags
      },
      type
    };

    this.metrics.customMetrics.set(name, metric);
  }

  getMetricsSummary(): Record<string, unknown> {
    const durations = this.metrics.requestDuration;
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
    const p95Duration = this.calculatePercentile(durations, 95);
    const p99Duration = this.calculatePercentile(durations, 99);

    return {
      service: this.config.service,
      environment: this.config.environment,
      version: this.config.version,
      uptime: Date.now() - this.startTime,
      requests: {
        total: this.metrics.requestsTotal,
        active: this.metrics.activeRequests,
        durationAvg: Math.round(avgDuration),
        durationP95: Math.round(p95Duration),
        durationP99: Math.round(p99Duration)
      },
      errors: {
        total: this.metrics.errorsTotal,
        rate: Math.round(this.metrics.errorRate * 10000) / 10000
      },
      performance: {
        cpuTime: this.metrics.cpuTime,
        memoryUsage: this.metrics.memoryUsage
      },
      business: {
        documentsProcessed: this.metrics.documentsProcessed,
        vectorSearches: this.metrics.vectorSearches,
        authentications: this.metrics.authentications
      },
      customMetrics: Array.from(this.metrics.customMetrics.entries()).map(
        ([name, data]) => ({ name, ...data })
      )
    };
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  async exportMetrics(env: Record<string, unknown>): Promise<void> {
    if (!this.config.enableMetrics) return;

    const metrics = this.getMetricsSummary();

    if (env && env.ANALYTICS) {
      try {
        await env.ANALYTICS.writeDataPoint({
          blobs: [JSON.stringify(metrics)],
          doubles: [
            metrics.requests.total,
            metrics.errors.rate,
            metrics.performance.cpuTime,
            metrics.performance.memoryUsage
          ],
          indexes: [this.config.service, this.config.environment]
        });
      } catch (error) {
        console.error('Failed to write metrics to Analytics Engine:', error);
      }
    }

    if (this.config.metricsEndpoint) {
      try {
        await fetch(this.config.metricsEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.datadogApiKey || ''}`
          },
          body: JSON.stringify(metrics)
        });
      } catch (error) {
        console.error('Failed to send metrics to external endpoint:', error);
      }
    }
  }
}
