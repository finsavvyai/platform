/**
 * @finsavvyai/monitor — Prometheus-compatible metrics collector
 */

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricEntry {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

const metrics: Map<string, MetricEntry> = new Map();
const histogramBuckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

function metricKey(name: string, labels: Record<string, string>): string {
  const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  return `${name}{${sorted.map(([k, v]) => `${k}="${v}"`).join(',')}}`;
}

export function incrementCounter(
  name: string,
  labels: Record<string, string> = {},
  value = 1,
): void {
  const key = metricKey(name, labels);
  const existing = metrics.get(key);
  metrics.set(key, {
    name, type: 'counter',
    value: (existing?.value || 0) + value,
    labels, timestamp: Date.now(),
  });
}

export function setGauge(
  name: string,
  value: number,
  labels: Record<string, string> = {},
): void {
  const key = metricKey(name, labels);
  metrics.set(key, {
    name, type: 'gauge', value, labels, timestamp: Date.now(),
  });
}

export function observeHistogram(
  name: string,
  value: number,
  labels: Record<string, string> = {},
): void {
  for (const bucket of histogramBuckets) {
    const bucketKey = metricKey(`${name}_bucket`, { ...labels, le: String(bucket) });
    const existing = metrics.get(bucketKey);
    if (value <= bucket) {
      metrics.set(bucketKey, {
        name: `${name}_bucket`, type: 'histogram',
        value: (existing?.value || 0) + 1,
        labels: { ...labels, le: String(bucket) }, timestamp: Date.now(),
      });
    }
  }
  incrementCounter(`${name}_count`, labels);
  incrementCounter(`${name}_sum`, labels, value);
}

export function getMetrics(): MetricEntry[] {
  return Array.from(metrics.values());
}

export function getPrometheusOutput(): string {
  const lines: string[] = [];
  for (const entry of metrics.values()) {
    const labelStr = Object.entries(entry.labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    const suffix = labelStr ? `{${labelStr}}` : '';
    lines.push(`${entry.name}${suffix} ${entry.value}`);
  }
  return lines.join('\n');
}

export function resetMetrics(): void {
  metrics.clear();
}
