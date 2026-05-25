// Self-learning SDK outcome tracker — monitors endpoint success/failure patterns

export interface EndpointStats {
  endpoint: string;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  lastCalledAt: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
}

interface EndpointRecord {
  successCount: number;
  failureCount: number;
  latencies: number[];
  lastCalledAt: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
}

export interface TrackerOptions {
  /** Max latency samples to retain per endpoint */
  maxLatencySamples: number;
  /** Min calls before caching is considered */
  minCallsForCache: number;
  /** Min success rate (0-1) to enable caching */
  minSuccessRate: number;
  /** Base TTL in ms for adaptive TTL calculation */
  baseTTL: number;
  /** Max TTL cap in ms */
  maxTTL: number;
}

const DEFAULT_TRACKER_OPTIONS: TrackerOptions = {
  maxLatencySamples: 100,
  minCallsForCache: 5,
  minSuccessRate: 0.9,
  baseTTL: 30_000,
  maxTTL: 600_000,
};

/**
 * Tracks API call outcomes per endpoint.
 * Learns which endpoints are stable and adapts caching accordingly.
 */
export class OutcomeTracker {
  private readonly records = new Map<string, EndpointRecord>();
  private readonly options: TrackerOptions;

  constructor(options: Partial<TrackerOptions> = {}) {
    this.options = { ...DEFAULT_TRACKER_OPTIONS, ...options };
  }

  /**
   * Record the outcome of an API call.
   */
  record(endpoint: string, success: boolean, latencyMs: number): void {
    let rec = this.records.get(endpoint);
    if (!rec) {
      rec = {
        successCount: 0,
        failureCount: 0,
        latencies: [],
        lastCalledAt: 0,
        lastSuccessAt: null,
        lastFailureAt: null,
      };
      this.records.set(endpoint, rec);
    }

    if (success) {
      rec.successCount += 1;
      rec.lastSuccessAt = Date.now();
    } else {
      rec.failureCount += 1;
      rec.lastFailureAt = Date.now();
    }

    rec.lastCalledAt = Date.now();
    rec.latencies.push(latencyMs);

    if (rec.latencies.length > this.options.maxLatencySamples) {
      rec.latencies.shift();
    }
  }

  /**
   * Get aggregated stats for an endpoint.
   */
  getStats(endpoint: string): EndpointStats {
    const rec = this.records.get(endpoint);
    if (!rec) {
      return this.emptyStats(endpoint);
    }

    const total = rec.successCount + rec.failureCount;
    const successRate = total > 0 ? rec.successCount / total : 0;

    return {
      endpoint,
      totalCalls: total,
      successCount: rec.successCount,
      failureCount: rec.failureCount,
      successRate,
      avgLatencyMs: this.average(rec.latencies),
      p95LatencyMs: this.percentile(rec.latencies, 95),
      lastCalledAt: rec.lastCalledAt,
      lastSuccessAt: rec.lastSuccessAt,
      lastFailureAt: rec.lastFailureAt,
    };
  }

  /**
   * Determine if an endpoint should be cached based on learned patterns.
   * Caches when: success rate > threshold AND called enough times.
   */
  shouldCache(endpoint: string): boolean {
    const rec = this.records.get(endpoint);
    if (!rec) return false;

    const total = rec.successCount + rec.failureCount;
    if (total < this.options.minCallsForCache) return false;

    const successRate = rec.successCount / total;
    return successRate >= this.options.minSuccessRate;
  }

  /**
   * Calculate adaptive TTL based on endpoint stability.
   * Stable endpoints (high success, low variance) get longer TTLs.
   */
  getAdaptiveTTL(endpoint: string): number {
    const rec = this.records.get(endpoint);
    if (!rec) return this.options.baseTTL;

    const total = rec.successCount + rec.failureCount;
    if (total === 0) return this.options.baseTTL;

    const successRate = rec.successCount / total;
    const latencyVariance = this.variance(rec.latencies);
    const avgLatency = this.average(rec.latencies);

    // Coefficient of variation (lower = more stable)
    const cv = avgLatency > 0 ? Math.sqrt(latencyVariance) / avgLatency : 1;
    const stabilityFactor = Math.max(0.1, Math.min(1, 1 - cv));

    // Scale TTL: higher success rate + lower variance = longer TTL
    const ttl = this.options.baseTTL * successRate * (1 + stabilityFactor * 9);

    return Math.min(Math.round(ttl), this.options.maxTTL);
  }

  /**
   * Get all tracked endpoints sorted by call volume.
   */
  getAllStats(): EndpointStats[] {
    const stats: EndpointStats[] = [];
    for (const endpoint of this.records.keys()) {
      stats.push(this.getStats(endpoint));
    }
    return stats.sort((a, b) => b.totalCalls - a.totalCalls);
  }

  /** Reset tracking data for a specific endpoint or all endpoints. */
  reset(endpoint?: string): void {
    if (endpoint) {
      this.records.delete(endpoint);
    } else {
      this.records.clear();
    }
  }

  private emptyStats(endpoint: string): EndpointStats {
    return { endpoint, totalCalls: 0, successCount: 0, failureCount: 0,
      successRate: 0, avgLatencyMs: 0, p95LatencyMs: 0,
      lastCalledAt: 0, lastSuccessAt: null, lastFailureAt: null };
  }

  private average(vals: number[]): number {
    return vals.length === 0 ? 0 : vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  private variance(vals: number[]): number {
    if (vals.length < 2) return 0;
    const avg = this.average(vals);
    return vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length;
  }

  private percentile(vals: number[], pct: number): number {
    if (vals.length === 0) return 0;
    const sorted = [...vals].sort((a, b) => a - b);
    return sorted[Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1)] ?? 0;
  }
}
