import type { MetricRecord } from './metrics-store';
import { metricsStore } from './metrics-store';

export function exportMetrics(
  tenantId: string,
  options?: {
    format?: 'csv' | 'json';
    metrics?: string[];
    from?: Date;
    to?: Date;
  }
): string {
  const records = metricsStore.get(tenantId) || [];
  const format = options?.format || 'json';
  let filtered = records;

  if (options?.from || options?.to) {
    const from = options.from?.getTime() || 0;
    const to = options.to?.getTime() || Date.now();
    filtered = filtered.filter(
      r => r.timestamp.getTime() >= from && r.timestamp.getTime() <= to
    );
  }

  if (format === 'csv') {
    const headers = ['timestamp', 'cpu', 'memory', 'disk', 'latency', 'uptime'];
    const rows = filtered.map(m =>
      [
        m.timestamp.toISOString(),
        m.cpu,
        m.memory,
        m.disk,
        m.latency,
        m.uptime
      ].join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  }

  return JSON.stringify(filtered, null, 2);
}
