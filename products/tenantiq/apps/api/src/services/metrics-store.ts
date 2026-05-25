export interface MetricRecord {
  tenantId: string;
  timestamp: Date;
  uptime?: number;
  cpu?: number;
  memory?: number;
  disk?: number;
  latency?: number;
  throughput?: number;
  errorRate?: number;
  requestCount?: number;
}

export const metricsStore = new Map<string, MetricRecord[]>();

export async function collectMetrics(
  tenantId: string,
  options?: { include?: string[] }
): Promise<MetricRecord> {
  const metric: MetricRecord = {
    tenantId,
    timestamp: new Date(),
    uptime: 99 + Math.random() * 1,
    cpu: Math.floor(Math.random() * 80),
    memory: Math.floor(Math.random() * 80),
    disk: Math.floor(Math.random() * 80),
    latency: Math.floor(Math.random() * 300),
    throughput: Math.floor(Math.random() * 10000),
    errorRate: Math.random() * 0.02,
    requestCount: Math.floor(Math.random() * 50000)
  };

  if (options?.include) {
    const filtered: MetricRecord = { tenantId, timestamp: metric.timestamp };
    options.include.forEach(field => {
      if (field in metric) {
        (filtered as any)[field] = (metric as any)[field];
      }
    });
    return filtered;
  }

  return metric;
}

export async function storeMetrics(
  metric: MetricRecord | MetricRecord[]
): Promise<boolean> {
  const metrics = Array.isArray(metric) ? metric : [metric];

  for (const m of metrics) {
    if (!metricsStore.has(m.tenantId)) {
      metricsStore.set(m.tenantId, []);
    }
    const existing = metricsStore.get(m.tenantId)!;
    const sameSec = existing.find(
      x => Math.floor(x.timestamp.getTime() / 1000) ===
             Math.floor(m.timestamp.getTime() / 1000)
    );
    if (!sameSec) {
      existing.push(m);
      existing.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      if (existing.length > 10000) {
        existing.splice(0, 1000);
      }
    } else {
      return false;
    }
  }

  return true;
}

export async function getMetrics(
  tenantId: string,
  options?: { from?: Date; to?: Date; types?: string[]; aggregate?: string }
): Promise<MetricRecord | MetricRecord[] | null> {
  const { aggregateMetrics } = await import('./metrics-analysis');
  const records = metricsStore.get(tenantId);
  if (!records) return null;

  let filtered = [...records];

  if (options?.from || options?.to) {
    const from = options.from?.getTime() || 0;
    const to = options.to?.getTime() || Date.now();
    filtered = filtered.filter(
      r => r.timestamp.getTime() >= from && r.timestamp.getTime() <= to
    );
  }

  if (options?.aggregate) {
    return aggregateMetrics(filtered, options.aggregate as 'hourly' | 'daily');
  }

  return filtered.length > 0 ? filtered[filtered.length - 1] : null;
}

export async function deleteOldMetrics(options?: {
  daysOld?: number;
  tenants?: string[];
}): Promise<{ deleted: number; timestamp: Date }> {
  const daysOld = options?.daysOld || 90;
  const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
  let deleted = 0;

  const tenants = options?.tenants
    ? options.tenants
    : Array.from(metricsStore.keys());

  for (const tenantId of tenants) {
    const records = metricsStore.get(tenantId);
    if (records) {
      const before = records.length;
      metricsStore.set(
        tenantId,
        records.filter(r => r.timestamp.getTime() >= cutoff)
      );
      const after = metricsStore.get(tenantId)!.length;
      deleted += before - after;
    }
  }

  return { deleted, timestamp: new Date() };
}
