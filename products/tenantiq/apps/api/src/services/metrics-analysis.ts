import type { MetricRecord } from './metrics-store';
import { metricsStore } from './metrics-store';

const METRIC_FIELDS = ['cpu', 'memory', 'disk', 'uptime', 'latency', 'errorRate'];

export function aggregateMetrics(
  metrics: MetricRecord[],
  period: 'hourly' | 'daily',
  options?: { includeStats?: boolean }
): MetricRecord[] {
  if (metrics.length === 0) return [];

  const grouped = new Map<number, MetricRecord[]>();
  const periodMs = period === 'hourly' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  for (const metric of metrics) {
    const bucket = Math.floor(metric.timestamp.getTime() / periodMs);
    if (!grouped.has(bucket)) {
      grouped.set(bucket, []);
    }
    grouped.get(bucket)!.push(metric);
  }

  const result: MetricRecord[] = [];

  for (const [bucket, group] of grouped) {
    const avg: any = {
      tenantId: metrics[0].tenantId,
      timestamp: new Date(bucket * periodMs)
    };

    for (const field of METRIC_FIELDS) {
      const values = group
        .map(m => (m as any)[field])
        .filter(v => v !== undefined) as number[];

      if (values.length > 0) {
        const sum = values.reduce((a, v) => a + v, 0);
        avg[field] = sum / values.length;

        if (options?.includeStats) {
          avg[field] = {
            avg: sum / values.length,
            min: Math.min(...values),
            max: Math.max(...values)
          };
        }
      }
    }

    result.push(avg);
  }

  return result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export function getMetricHistory(
  tenantId: string,
  metric: string,
  options?: {
    days?: number;
    from?: Date;
    to?: Date;
    includeBaseline?: boolean;
  }
): Array<{ value: number; timestamp: Date; baseline?: number; deviation?: number }> {
  const records = metricsStore.get(tenantId) || [];
  const days = options?.days || 7;
  const from = options?.from || new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const to = options?.to || new Date();

  const filtered = records
    .filter(r => r.timestamp >= from && r.timestamp <= to)
    .map(r => ({
      value: (r as any)[metric] || 0,
      timestamp: r.timestamp,
      baseline: 75,
      deviation: ((r as any)[metric] || 0) - 75
    }));

  return filtered.slice(Math.max(0, filtered.length - 366));
}

export function calculateBaselines(
  tenantId: string,
  options?: { days?: number; excludeOutliers?: boolean; segment?: string }
): Record<string, number> {
  const records = metricsStore.get(tenantId) || [];
  const days = options?.days || 30;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const relevant = records.filter(r => r.timestamp.getTime() >= cutoff);

  const baseline: Record<string, number> = {};

  for (const field of METRIC_FIELDS) {
    const values = relevant
      .map(r => (r as any)[field])
      .filter(v => v !== undefined) as number[];

    if (values.length > 0) {
      let filtered = values;

      if (options?.excludeOutliers && values.length > 2) {
        const sorted = [...values].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        filtered = values.filter(
          v => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr
        );
      }

      baseline[field] = filtered.reduce((a, v) => a + v, 0) / filtered.length;
    }
  }

  return baseline;
}

export function compareMetrics(
  tenantId1: string,
  tenantId2: string,
  options?: { percentage?: boolean; from?: Date; to?: Date }
): {
  differences: Record<string, number>;
  improvements: string[];
  [key: string]: any;
} {
  const records1 = metricsStore.get(tenantId1) || [];
  const records2 = metricsStore.get(tenantId2) || [];

  const filtered1 = records1.length > 0 ? records1[records1.length - 1] : null;
  const filtered2 = records2.length > 0 ? records2[records2.length - 1] : null;

  const differences: Record<string, number> = {};
  const improvements: string[] = [];

  if (filtered1 && filtered2) {
    const fields = ['cpu', 'memory', 'disk', 'latency', 'errorRate'];
    for (const field of fields) {
      const val1 = (filtered1 as any)[field] || 0;
      const val2 = (filtered2 as any)[field] || 0;
      if (options?.percentage) {
        differences[field] = val1 !== 0 ? ((val2 - val1) / val1) * 100 : 0;
      } else {
        differences[field] = val2 - val1;
      }
      if (differences[field] > 10) {
        improvements.push(field);
      }
    }
  }

  return { differences, improvements, cpu: differences.cpu };
}
