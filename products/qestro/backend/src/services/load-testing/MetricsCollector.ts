import type { RequestMetric, LoadTestMetrics } from './types.js';

export class MetricsCollector {
  private metrics: RequestMetric[] = [];
  private timeSeries: LoadTestMetrics[] = [];
  private windowSize: number = 10000; // 10 second windows for time series
  private lastSnapshot: number = Date.now();

  recordRequest(metric: RequestMetric): void {
    this.metrics.push(metric);

    // Generate snapshot every 10 seconds
    if (Date.now() - this.lastSnapshot >= this.windowSize) {
      const snapshot = this.calculateSnapshot();
      this.timeSeries.push(snapshot);
      this.lastSnapshot = Date.now();
    }
  }

  getSnapshot(): LoadTestMetrics {
    return this.calculateSnapshot();
  }

  getTimeSeries(): LoadTestMetrics[] {
    return [...this.timeSeries, this.calculateSnapshot()];
  }

  private calculateSnapshot(): LoadTestMetrics {
    if (this.metrics.length === 0) {
      return {
        timestamp: Date.now(),
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        errorRate: 0,
        throughput: 0,
        avgLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        minLatency: 0,
        maxLatency: 0,
        activeVirtualUsers: 0,
      };
    }

    const now = Date.now();
    const recentMetrics = this.metrics.filter((m) => now - m.timestamp < this.windowSize);
    const responseTimes = recentMetrics.map((m) => m.responseTime).sort((a, b) => a - b);

    const totalRequests = recentMetrics.length;
    const successfulRequests = recentMetrics.filter((m) => m.success).length;
    const failedRequests = totalRequests - successfulRequests;

    const uniqueUsers = new Set(recentMetrics.map((m) => m.userId)).size;

    return {
      timestamp: now,
      totalRequests,
      successfulRequests,
      failedRequests,
      errorRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
      throughput: this.windowSize > 0 ? (totalRequests / this.windowSize) * 1000 : 0,
      avgLatency:
        responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0,
      p50Latency: this.percentile(responseTimes, 0.5),
      p95Latency: this.percentile(responseTimes, 0.95),
      p99Latency: this.percentile(responseTimes, 0.99),
      minLatency: responseTimes.length > 0 ? responseTimes[0] : 0,
      maxLatency: responseTimes.length > 0 ? responseTimes[responseTimes.length - 1] : 0,
      activeVirtualUsers: uniqueUsers,
    };
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }
}
