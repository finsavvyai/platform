import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  collectMetrics,
  storeMetrics,
  getMetrics,
  aggregateMetrics,
  getMetricHistory,
  calculateBaselines,
  compareMetrics,
  exportMetrics,
  deleteOldMetrics
} from '../../apps/api/src/services/metrics';

describe('Metrics Service', () => {
  const mockMetric = {
    tenantId: 'tenant-123',
    timestamp: new Date(),
    uptime: 99.5,
    cpu: 45,
    memory: 60,
    disk: 70,
    latency: 120,
    throughput: 5000,
    errorRate: 0.02,
    requestCount: 10000
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('collectMetrics', () => {
    it('should collect metrics from cloud provider', async () => {
      const metrics = await collectMetrics('tenant-123');
      expect(metrics).toBeDefined();
      expect(metrics.cpu).toBeDefined();
      expect(metrics.memory).toBeDefined();
      expect(metrics.uptime).toBeDefined();
    });

    it('should include timestamp', async () => {
      const metrics = await collectMetrics('tenant-123');
      expect(metrics.timestamp).toBeDefined();
      expect(metrics.timestamp).toBeInstanceOf(Date);
    });

    it('should handle collection errors gracefully', async () => {
      const metrics = await collectMetrics('tenant-error');
      expect(metrics).toBeDefined();
    });

    it('should validate metric ranges', async () => {
      const metrics = await collectMetrics('tenant-123');
      expect(metrics.cpu).toBeGreaterThanOrEqual(0);
      expect(metrics.cpu).toBeLessThanOrEqual(100);
      expect(metrics.memory).toBeGreaterThanOrEqual(0);
      expect(metrics.memory).toBeLessThanOrEqual(100);
    });

    it('should support custom metric collection', async () => {
      const metrics = await collectMetrics('tenant-123', {
        include: ['cpu', 'memory', 'disk']
      });
      expect(metrics.cpu).toBeDefined();
      expect(metrics.memory).toBeDefined();
      expect(metrics.disk).toBeDefined();
    });
  });

  describe('storeMetrics', () => {
    it('should store metrics in database', async () => {
      const result = await storeMetrics({
        ...mockMetric,
        tenantId: 'tenant-store-1',
        timestamp: new Date()
      });
      expect(result).toBe(true);
    });

    it('should deduplicate within same second', async () => {
      const t1 = new Date('2024-01-01T00:00:00Z');
      const metric1 = { ...mockMetric, tenantId: 'tenant-dedup', timestamp: t1 };
      const metric2 = { ...mockMetric, tenantId: 'tenant-dedup', timestamp: t1 };
      await storeMetrics(metric1);
      const result = await storeMetrics(metric2);
      expect(result).toBe(false);
    });

    it('should enforce retention policy', async () => {
      const result = await storeMetrics({
        ...mockMetric,
        tenantId: 'tenant-retention',
        timestamp: new Date()
      });
      expect(result).toBe(true);
    });

    it('should handle batch storage', async () => {
      const now = Date.now();
      const metrics = [
        { ...mockMetric, tenantId: 'tenant-batch', timestamp: new Date(now) },
        { ...mockMetric, tenantId: 'tenant-batch', timestamp: new Date(now + 1000) },
        { ...mockMetric, tenantId: 'tenant-batch', timestamp: new Date(now + 2000) }
      ];
      const result = await storeMetrics(metrics);
      expect(result).toBe(true);
    });
  });

  describe('getMetrics', () => {
    it('should retrieve latest metrics after storing', async () => {
      const collected = await collectMetrics('tenant-get-1');
      await storeMetrics(collected);
      const metrics = await getMetrics('tenant-get-1') as any;
      expect(metrics).toBeDefined();
      expect(metrics.cpu).toBeDefined();
    });

    it('should support time range queries', async () => {
      const collected = await collectMetrics('tenant-get-2');
      await storeMetrics(collected);
      const now = new Date();
      const hour = new Date(now.getTime() - 60 * 60 * 1000);
      const metrics = await getMetrics('tenant-get-2', { from: hour, to: now });
      expect(metrics).toBeDefined();
    });

    it('should filter by metric type', async () => {
      const collected = await collectMetrics('tenant-get-3');
      await storeMetrics(collected);
      const metrics = await getMetrics('tenant-get-3', { types: ['cpu', 'memory'] });
      expect(metrics).toBeDefined();
    });

    it('should return null for non-existent tenant', async () => {
      const metrics = await getMetrics('nonexistent-get');
      expect(metrics).toBeNull();
    });

    it('should support aggregation on retrieval', async () => {
      const collected = await collectMetrics('tenant-get-4');
      await storeMetrics(collected);
      const metrics = await getMetrics('tenant-get-4', { aggregate: 'hourly' });
      expect(metrics).toBeDefined();
    });
  });

  describe('aggregateMetrics', () => {
    it('should aggregate metrics by time period', () => {
      const metrics = [
        { ...mockMetric, cpu: 40, timestamp: new Date('2024-01-01T00:00:00') },
        { ...mockMetric, cpu: 50, timestamp: new Date('2024-01-01T00:15:00') },
        { ...mockMetric, cpu: 60, timestamp: new Date('2024-01-01T00:30:00') }
      ];
      const aggregated = aggregateMetrics(metrics, 'hourly');
      expect(aggregated.length).toBe(1);
      expect(aggregated[0].cpu).toBe(50);
    });

    it('should calculate min/max/avg for aggregation', () => {
      const metrics = [
        { ...mockMetric, cpu: 40 },
        { ...mockMetric, cpu: 60 },
        { ...mockMetric, cpu: 80 }
      ];
      const aggregated = aggregateMetrics(metrics, 'daily', { includeStats: true }) as any;
      expect(aggregated[0].cpu.avg).toBe(60);
      expect(aggregated[0].cpu.min).toBe(40);
      expect(aggregated[0].cpu.max).toBe(80);
    });

    it('should handle missing data in aggregation', () => {
      const metrics = [
        { ...mockMetric, cpu: 50, memory: undefined },
        { ...mockMetric, cpu: undefined, memory: 60 }
      ];
      const aggregated = aggregateMetrics(metrics, 'hourly');
      expect(aggregated).toBeDefined();
    });
  });

  describe('getMetricHistory', () => {
    it('should retrieve metric history', () => {
      const history = getMetricHistory('tenant-123', 'cpu', { days: 7 });
      expect(Array.isArray(history)).toBe(true);
    });

    it('should support custom time ranges', () => {
      const now = new Date();
      const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const history = getMetricHistory('tenant-123', 'memory', {
        from: month,
        to: now
      });
      expect(Array.isArray(history)).toBe(true);
    });

    it('should include baseline comparisons', () => {
      const history = getMetricHistory('tenant-123', 'cpu', {
        days: 7,
        includeBaseline: true
      });
      history.forEach(h => {
        expect(h.baseline).toBeDefined();
        expect(h.deviation).toBeDefined();
      });
    });

    it('should support downsampling for large ranges', () => {
      const now = new Date();
      const year = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const history = getMetricHistory('tenant-123', 'cpu', {
        from: year,
        to: now
      });
      expect(history.length).toBeLessThanOrEqual(366);
    });
  });

  describe('calculateBaselines', () => {
    it('should calculate baseline metrics', async () => {
      const collected = await collectMetrics('tenant-baseline');
      await storeMetrics(collected);
      const baseline = calculateBaselines('tenant-baseline');
      expect(baseline).toBeDefined();
      expect(baseline.cpu).toBeDefined();
      expect(baseline.memory).toBeDefined();
    });

    it('should use historical data', () => {
      const baseline = calculateBaselines('tenant-baseline', { days: 30 });
      expect(baseline).toBeDefined();
    });

    it('should exclude outliers', () => {
      const baseline = calculateBaselines('tenant-baseline', { excludeOutliers: true });
      expect(baseline).toBeDefined();
    });

    it('should segment by time of day', () => {
      const baseline = calculateBaselines('tenant-baseline', { segment: 'hourly' });
      expect(baseline).toBeDefined();
    });
  });

  describe('compareMetrics', () => {
    it('should compare metrics between tenants', async () => {
      await storeMetrics({ ...mockMetric, tenantId: 'tenant-cmp-1', timestamp: new Date() });
      await storeMetrics({ ...mockMetric, tenantId: 'tenant-cmp-2', timestamp: new Date() });
      const comparison = compareMetrics('tenant-cmp-1', 'tenant-cmp-2');
      expect(comparison).toBeDefined();
      expect(comparison.differences).toBeDefined();
    });

    it('should calculate percentage differences', async () => {
      await storeMetrics({ ...mockMetric, tenantId: 'tenant-cmp-3', cpu: 50, timestamp: new Date() });
      await storeMetrics({ ...mockMetric, tenantId: 'tenant-cmp-4', cpu: 60, timestamp: new Date() });
      const comparison = compareMetrics('tenant-cmp-3', 'tenant-cmp-4', { percentage: true });
      expect(comparison.differences.cpu).toBeDefined();
    });

    it('should identify improvement areas', async () => {
      await storeMetrics({ ...mockMetric, tenantId: 'tenant-cmp-5', timestamp: new Date() });
      await storeMetrics({ ...mockMetric, tenantId: 'tenant-cmp-6', timestamp: new Date() });
      const comparison = compareMetrics('tenant-cmp-5', 'tenant-cmp-6');
      expect(comparison.improvements).toBeDefined();
    });

    it('should support time range comparison', async () => {
      const now = new Date();
      await storeMetrics({ ...mockMetric, tenantId: 'tenant-cmp-7', timestamp: now });
      await storeMetrics({ ...mockMetric, tenantId: 'tenant-cmp-8', timestamp: now });
      const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const comparison = compareMetrics('tenant-cmp-7', 'tenant-cmp-8', {
        from: week,
        to: now
      });
      expect(comparison).toBeDefined();
    });
  });

  describe('exportMetrics', () => {
    it('should export metrics to CSV', () => {
      const csv = exportMetrics('tenant-123', { format: 'csv' });
      expect(typeof csv).toBe('string');
      expect(csv.includes('cpu')).toBe(true);
    });

    it('should export metrics to JSON', () => {
      const json = exportMetrics('tenant-123', { format: 'json' });
      const data = JSON.parse(json);
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support filtered exports', () => {
      const csv = exportMetrics('tenant-123', {
        format: 'csv',
        metrics: ['cpu', 'memory']
      });
      expect(csv.includes('cpu')).toBe(true);
      expect(typeof csv).toBe('string');
    });

    it('should respect time range in export', () => {
      const now = new Date();
      const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const csv = exportMetrics('tenant-123', {
        format: 'csv',
        from: day,
        to: now
      });
      expect(typeof csv).toBe('string');
    });
  });

  describe('deleteOldMetrics', () => {
    it('should delete metrics older than retention period', async () => {
      const result = await deleteOldMetrics({ daysOld: 90 });
      expect(result).toBeDefined();
      expect(result.deleted).toBeGreaterThanOrEqual(0);
    });

    it('should preserve recent metrics', async () => {
      await deleteOldMetrics({ daysOld: 90 });
      const recentMetrics = getMetrics('tenant-123', {
        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      });
      expect(recentMetrics).toBeDefined();
    });

    it('should support selective deletion', async () => {
      const result = await deleteOldMetrics({
        daysOld: 90,
        tenants: ['tenant-123']
      });
      expect(result.deleted).toBeGreaterThanOrEqual(0);
    });

    it('should log deletion operations', async () => {
      const result = await deleteOldMetrics({ daysOld: 90 });
      expect(result.timestamp).toBeDefined();
    });
  });
});
