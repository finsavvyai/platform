/**
 * Search Analytics — Task 2.3 (search analytics requirement)
 * Tracks query performance, latency, result quality, and usage patterns.
 */

export interface QueryRecord {
  query: string;
  durationMs: number;
  resultCount: number;
  cacheHit: boolean;
  timestamp: number;
  indexName: string;
  searchType: 'semantic' | 'keyword' | 'hybrid';
  topScore?: number;
}

export interface AnalyticsSummary {
  totalQueries: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  cacheHitRate: number;
  averageResultCount: number;
  slowQueryCount: number;    // > 200ms
  topQueries: Array<{ query: string; count: number }>;
  latencyBuckets: Record<string, number>;
}

const SLOW_QUERY_THRESHOLD_MS = 200;
const MAX_RECORDS = 10_000;

/**
 * In-memory search analytics store.
 * For production, flush to Cloudflare Analytics Engine or a D1 table.
 */
export class SearchAnalytics {
  private records: QueryRecord[] = [];

  /** Record a completed search query. */
  record(entry: QueryRecord): void {
    this.records.push(entry);
    // Evict oldest if over limit
    if (this.records.length > MAX_RECORDS) {
      this.records.shift();
    }
  }

  /**
   * Time a search operation and record it automatically.
   * @returns The result of the wrapped function.
   */
  async timed<T>(
    meta: Omit<QueryRecord, 'durationMs' | 'timestamp'>,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.record({ ...meta, durationMs: Date.now() - start, timestamp: Date.now() });
      return result;
    } catch (err) {
      this.record({
        ...meta,
        durationMs: Date.now() - start,
        timestamp: Date.now(),
        resultCount: 0,
      });
      throw err;
    }
  }

  /** Compute a summary over the last N records (default: all). */
  getSummary(lastN?: number): AnalyticsSummary {
    const window = lastN
      ? this.records.slice(-lastN)
      : [...this.records];

    if (window.length === 0) {
      return this.emptysummary();
    }

    const latencies = window.map((r) => r.durationMs).sort((a, b) => a - b);
    const cacheHits = window.filter((r) => r.cacheHit).length;
    const slowQueries = window.filter((r) => r.durationMs > SLOW_QUERY_THRESHOLD_MS).length;

    // Query frequency
    const freq = new Map<string, number>();
    for (const r of window) {
      freq.set(r.query, (freq.get(r.query) ?? 0) + 1);
    }
    const topQueries = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    // Latency buckets
    const latencyBuckets: Record<string, number> = {
      '<50ms': 0,
      '50–100ms': 0,
      '100–200ms': 0,
      '200–500ms': 0,
      '>500ms': 0,
    };
    for (const l of latencies) {
      if (l < 50) latencyBuckets['<50ms']++;
      else if (l < 100) latencyBuckets['50–100ms']++;
      else if (l < 200) latencyBuckets['100–200ms']++;
      else if (l < 500) latencyBuckets['200–500ms']++;
      else latencyBuckets['>500ms']++;
    }

    const totalLatency = latencies.reduce((s, l) => s + l, 0);
    const p95Idx = Math.floor(latencies.length * 0.95);

    return {
      totalQueries: window.length,
      averageLatencyMs: totalLatency / window.length,
      p95LatencyMs: latencies[p95Idx] ?? latencies[latencies.length - 1] ?? 0,
      cacheHitRate: cacheHits / window.length,
      averageResultCount:
        window.reduce((s, r) => s + r.resultCount, 0) / window.length,
      slowQueryCount: slowQueries,
      topQueries,
      latencyBuckets,
    };
  }

  /** Return only queries that exceeded 200ms. */
  getSlowQueries(threshold = SLOW_QUERY_THRESHOLD_MS): QueryRecord[] {
    return this.records.filter((r) => r.durationMs > threshold);
  }

  /** Clear all records. */
  clear(): void {
    this.records = [];
  }

  get size(): number {
    return this.records.length;
  }

  private emptysummary(): AnalyticsSummary {
    return {
      totalQueries: 0,
      averageLatencyMs: 0,
      p95LatencyMs: 0,
      cacheHitRate: 0,
      averageResultCount: 0,
      slowQueryCount: 0,
      topQueries: [],
      latencyBuckets: {},
    };
  }
}
