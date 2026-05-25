/**
 * APM (Application Performance Monitoring) Types
 * Defines structures for distributed tracing, metrics, and alerting
 */

export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'ok' | 'error';
  metadata: Record<string, unknown>;
  error?: Error;
}

export interface Trace {
  traceId: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  spans: Span[];
  rootSpanId: string;
  status: 'pending' | 'ok' | 'error';
  metadata: Record<string, string>;
}

export interface MetricPoint {
  timestamp: number;
  value: number;
  tags: Record<string, string>;
}

export interface AggregatedMetric {
  timestamp: number;
  min: number;
  max: number;
  avg: number;
  p95: number;
  p99: number;
  count: number;
}

export interface AlertRule {
  ruleId: string;
  name: string;
  metricName: string;
  condition: 'gt' | 'lt' | 'eq';
  threshold: number;
  duration: number; // milliseconds
  enabled: boolean;
  channels: ('webhook' | 'email')[];
  webhookUrl?: string;
  email?: string;
}

export interface Alert {
  alertId: string;
  ruleId: string;
  ruleName: string;
  timestamp: number;
  metricName: string;
  value: number;
  threshold: number;
  message: string;
}

export interface PerformanceReport {
  timestamp: number;
  traces: Trace[];
  metrics: Record<string, MetricPoint[]>;
  alerts: Alert[];
  systemHealth: {
    memoryUsageMb: number;
    cpuUsagePercent: number;
    uptime: number;
  };
}

export interface ResourceUsage {
  memoryUsageMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  cpuUsagePercent: number;
  timestamp: number;
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface TraceCollectorConfig {
  maxTracesInBuffer: number;
  enableAutoFlush: boolean;
  flushIntervalMs: number;
}

export interface MetricsEngineConfig {
  retentionMs: number;
  aggregationIntervals: ('minute' | 'hour' | 'day')[];
}
