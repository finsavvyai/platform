/**
 * Questro AI-Powered Testing Automation Platform
 * Monitoring and Observability Manager
 *
 * Comprehensive monitoring and observability system providing
 * real-time insights, alerting, and performance analytics.
 */

import { EventEmitter } from 'events';

export interface MetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  labels?: string[];
}

export interface AlertDefinition {
  name: string;
  condition: string;
  threshold: number;
  comparison: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  severity: 'info' | 'warning' | 'critical';
  description: string;
  enabled: boolean;
}

export interface DashboardDefinition {
  id: string;
  name: string;
  description: string;
  panels: DashboardPanel[];
  refreshInterval: number;
  timeRange: string;
}

export interface DashboardPanel {
  id: string;
  title: string;
  type: 'graph' | 'stat' | 'table' | 'heatmap' | 'gauge';
  metrics: string[];
  visualization: {
    type: string;
    options: Record<string, any>;
  };
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface HealthCheck {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST';
  expectedStatus: number;
  timeout: number;
  interval: number;
  enabled: boolean;
}

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service: string;
  message: string;
  metadata?: Record<string, any>;
  traceId?: string;
  spanId?: string;
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime: number;
  duration: number;
  tags: Record<string, any>;
  logs: LogEntry[];
  status: 'ok' | 'error';
}

/**
 * Main Observability Manager
 */
export class ObservabilityManager extends EventEmitter {
  private metrics: Map<string, any> = new Map();
  private alerts: Map<string, AlertDefinition> = new Map();
  private dashboards: Map<string, DashboardDefinition> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private logBuffer: LogEntry[] = [];
  private traces: Map<string, TraceSpan[]> = new Map();
  private isEnabled: boolean = true;
  private metricsInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.initializeDefaultMetrics();
    this.initializeDefaultAlerts();
    this.initializeDefaultDashboards();
    this.initializeHealthChecks();
    this.startMetricsCollection();
  }

  /**
   * Initialize default metrics collection
   */
  private initializeDefaultMetrics(): void {
    const defaultMetrics: MetricDefinition[] = [
      // HTTP Metrics
      { name: 'http_requests_total', type: 'counter', help: 'Total HTTP requests', labels: ['method', 'route', 'status'] },
      { name: 'http_request_duration_ms', type: 'histogram', help: 'HTTP request duration in milliseconds', labels: ['method', 'route'] },
      { name: 'http_active_connections', type: 'gauge', help: 'Active HTTP connections' },

      // Application Metrics
      { name: 'app_users_total', type: 'gauge', help: 'Total number of users' },
      { name: 'app_test_runs_total', type: 'counter', help: 'Total test runs executed', labels: ['status', 'type'] },
      { name: 'app_ai_requests_total', type: 'counter', help: 'Total AI API requests', labels: ['provider', 'model', 'status'] },
      { name: 'app_sessions_active', type: 'gauge', help: 'Active user sessions' },

      // Database Metrics
      { name: 'db_connections_active', type: 'gauge', help: 'Active database connections' },
      { name: 'db_query_duration_ms', type: 'histogram', help: 'Database query duration in milliseconds', labels: ['table', 'operation'] },
      { name: 'db_queries_total', type: 'counter', help: 'Total database queries', labels: ['table', 'operation', 'status'] },

      // Cache Metrics
      { name: 'cache_hits_total', type: 'counter', help: 'Cache hits', labels: ['cache_type'] },
      { name: 'cache_misses_total', type: 'counter', help: 'Cache misses', labels: ['cache_type'] },
      { name: 'cache_size_bytes', type: 'gauge', help: 'Cache size in bytes', labels: ['cache_type'] },

      // WebSocket Metrics
      { name: 'websocket_connections_total', type: 'counter', help: 'Total WebSocket connections', labels: ['status'] },
      { name: 'websocket_connections_active', type: 'gauge', help: 'Active WebSocket connections' },
      { name: 'websocket_messages_total', type: 'counter', help: 'WebSocket messages sent', labels: ['type', 'direction'] },

      // AI Service Metrics
      { name: 'ai_request_duration_ms', type: 'histogram', help: 'AI request duration in milliseconds', labels: ['provider', 'model'] },
      { name: 'ai_tokens_used_total', type: 'counter', help: 'Total AI tokens used', labels: ['provider', 'model', 'type'] },
      { name: 'ai_cost_usd', type: 'counter', help: 'AI service cost in USD', labels: ['provider', 'model'] },

      // System Metrics
      { name: 'system_cpu_usage_percent', type: 'gauge', help: 'CPU usage percentage' },
      { name: 'system_memory_usage_bytes', type: 'gauge', help: 'Memory usage in bytes' },
      { name: 'system_disk_usage_bytes', type: 'gauge', help: 'Disk usage in bytes', labels: ['mount_point'] },

      // Business Metrics
      { name: 'business_test_success_rate', type: 'gauge', help: 'Test success rate percentage', labels: ['test_type'] },
      { name: 'business_user_satisfaction_score', type: 'gauge', help: 'User satisfaction score' },
      { name: 'business_revenue_usd', type: 'counter', help: 'Total revenue in USD', labels: ['plan', 'period'] },
    ];

    defaultMetrics.forEach(metric => {
      this.createMetric(metric);
    });
  }

  /**
   * Initialize default alerts
   */
  private initializeDefaultAlerts(): void {
    const defaultAlerts: AlertDefinition[] = [
      {
        name: 'high_error_rate',
        condition: 'rate(http_requests_total{status=~"5.."}[5m])',
        threshold: 0.05,
        comparison: 'gt',
        severity: 'critical',
        description: 'HTTP 5xx error rate is above 5%',
        enabled: true
      },
      {
        name: 'high_response_time',
        condition: 'histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m]))',
        threshold: 2000,
        comparison: 'gt',
        severity: 'warning',
        description: '95th percentile response time is above 2 seconds',
        enabled: true
      },
      {
        name: 'database_connection_exhaustion',
        condition: 'db_connections_active',
        threshold: 18,
        comparison: 'gt',
        severity: 'critical',
        description: 'Database connections are near exhaustion (>90%)',
        enabled: true
      },
      {
        name: 'high_memory_usage',
        condition: 'system_memory_usage_bytes / system_memory_total_bytes',
        threshold: 0.85,
        comparison: 'gt',
        severity: 'warning',
        description: 'Memory usage is above 85%',
        enabled: true
      },
      {
        name: 'ai_service_failure',
        condition: 'rate(ai_requests_total{status="error"}[5m]) / rate(ai_requests_total[5m])',
        threshold: 0.1,
        comparison: 'gt',
        severity: 'warning',
        description: 'AI service error rate is above 10%',
        enabled: true
      },
      {
        name: 'websocket_connection_failures',
        condition: 'rate(websocket_connections_total{status="error"}[5m])',
        threshold: 10,
        comparison: 'gt',
        severity: 'warning',
        description: 'WebSocket connection failure rate is high',
        enabled: true
      },
      {
        name: 'low_test_success_rate',
        condition: 'business_test_success_rate',
        threshold: 90,
        comparison: 'lt',
        severity: 'warning',
        description: 'Test success rate is below 90%',
        enabled: true
      }
    ];

    defaultAlerts.forEach(alert => {
      this.alerts.set(alert.name, alert);
    });
  }

  /**
   * Initialize default dashboards
   */
  private initializeDefaultDashboards(): void {
    const dashboards: DashboardDefinition[] = [
      {
        id: 'system-overview',
        name: 'System Overview',
        description: 'High-level system health and performance metrics',
        panels: [
          {
            id: 'active-users',
            title: 'Active Users',
            type: 'stat',
            metrics: ['app_users_active'],
            visualization: { type: 'stat', options: { unit: 'short' } },
            position: { x: 0, y: 0, width: 6, height: 8 }
          },
          {
            id: 'request-rate',
            title: 'Request Rate',
            type: 'graph',
            metrics: ['rate(http_requests_total[5m])'],
            visualization: { type: 'line', options: { legend: true } },
            position: { x: 6, y: 0, width: 12, height: 8 }
          },
          {
            id: 'error-rate',
            title: 'Error Rate',
            type: 'graph',
            metrics: ['rate(http_requests_total{status=~"5.."}[5m])'],
            visualization: { type: 'line', options: { color: 'red' } },
            position: { x: 18, y: 0, width: 6, height: 8 }
          }
        ],
        refreshInterval: 30000,
        timeRange: '1h'
      },
      {
        id: 'application-performance',
        name: 'Application Performance',
        description: 'Detailed application performance metrics',
        panels: [
          {
            id: 'response-time',
            title: 'Response Time Distribution',
            type: 'graph',
            metrics: ['histogram_quantile(0.50, rate(http_request_duration_ms_bucket[5m]))', 'histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m]))'],
            visualization: { type: 'line', options: { legend: true } },
            position: { x: 0, y: 0, width: 12, height: 8 }
          },
          {
            id: 'database-performance',
            title: 'Database Performance',
            type: 'graph',
            metrics: ['rate(db_query_duration_ms_sum[5m]) / rate(db_query_duration_ms_count[5m])'],
            visualization: { type: 'line', options: { yAxis: { unit: 'ms' } } },
            position: { x: 12, y: 0, width: 12, height: 8 }
          }
        ],
        refreshInterval: 30000,
        timeRange: '1h'
      },
      {
        id: 'ai-services',
        name: 'AI Services',
        description: 'AI service performance and cost metrics',
        panels: [
          {
            id: 'ai-request-latency',
            title: 'AI Request Latency',
            type: 'graph',
            metrics: ['histogram_quantile(0.95, rate(ai_request_duration_ms_bucket[5m]))'],
            visualization: { type: 'line', options: { yAxis: { unit: 'ms' } } },
            position: { x: 0, y: 0, width: 12, height: 8 }
          },
          {
            id: 'ai-cost-tracking',
            title: 'AI Service Cost',
            type: 'graph',
            metrics: ['increase(ai_cost_usd[1h])'],
            visualization: { type: 'line', options: { yAxis: { unit: 'USD' } } },
            position: { x: 12, y: 0, width: 12, height: 8 }
          }
        ],
        refreshInterval: 60000,
        timeRange: '24h'
      }
    ];

    dashboards.forEach(dashboard => {
      this.dashboards.set(dashboard.id, dashboard);
    });
  }

  /**
   * Initialize health checks
   */
  private initializeHealthChecks(): void {
    const healthChecks: HealthCheck[] = [
      {
        name: 'api-health',
        endpoint: '/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000,
        interval: 30000,
        enabled: true
      },
      {
        name: 'database-health',
        endpoint: '/health/database',
        method: 'GET',
        expectedStatus: 200,
        timeout: 3000,
        interval: 30000,
        enabled: true
      },
      {
        name: 'redis-health',
        endpoint: '/health/redis',
        method: 'GET',
        expectedStatus: 200,
        timeout: 2000,
        interval: 30000,
        enabled: true
      },
      {
        name: 'websocket-health',
        endpoint: '/ws/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000,
        interval: 60000,
        enabled: true
      }
    ];

    healthChecks.forEach(check => {
      this.healthChecks.set(check.name, check);
    });
  }

  /**
   * Create a new metric
   */
  createMetric(definition: MetricDefinition): void {
    this.metrics.set(definition.name, {
      definition,
      values: new Map(),
      timestamps: []
    });
  }

  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.isEnabled) return;

    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Metric not found: ${name}`);
      return;
    }

    const labelKey = labels ? JSON.stringify(labels) : 'default';

    if (metric.definition.type === 'counter') {
      const current = metric.values.get(labelKey) || 0;
      metric.values.set(labelKey, current + value);
    } else if (metric.definition.type === 'gauge') {
      metric.values.set(labelKey, value);
    } else if (metric.definition.type === 'histogram' || metric.definition.type === 'summary') {
      if (!metric.values.has(labelKey)) {
        metric.values.set(labelKey, []);
      }
      (metric.values.get(labelKey) as number[]).push(value);
    }

    metric.timestamps.push(Date.now());

    // Keep only recent timestamps (last hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    metric.timestamps = metric.timestamps.filter(ts => ts > oneHourAgo);
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, labels?: Record<string, string>): void {
    this.recordMetric(name, 1, labels);
  }

  /**
   * Set a gauge metric value
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, value, labels);
  }

  /**
   * Record a histogram observation
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, value, labels);
  }

  /**
   * Add a log entry
   */
  addLog(entry: LogEntry): void {
    if (!this.isEnabled) return;

    this.logBuffer.push(entry);

    // Keep log buffer manageable (last 10000 entries)
    if (this.logBuffer.length > 10000) {
      this.logBuffer = this.logBuffer.slice(-5000);
    }

    this.emit('log', entry);
  }

  /**
   * Add a trace span
   */
  addTraceSpan(span: TraceSpan): void {
    if (!this.isEnabled) return;

    if (!this.traces.has(span.traceId)) {
      this.traces.set(span.traceId, []);
    }

    this.traces.get(span.traceId)!.push(span);
    this.emit('trace', span);
  }

  /**
   * Create a new trace span
   */
  startTrace(operationName: string, parentSpanId?: string): { traceId: string; spanId: string; startTime: number } {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();
    const startTime = Date.now();

    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId,
      operationName,
      startTime,
      endTime: 0,
      duration: 0,
      tags: {},
      logs: [],
      status: 'ok'
    };

    this.addTraceSpan(span);

    return { traceId, spanId, startTime };
  }

  /**
   * Finish a trace span
   */
  finishTrace(traceId: string, spanId: string, tags?: Record<string, any>, status: 'ok' | 'error' = 'ok'): void {
    const traces = this.traces.get(traceId);
    if (!traces) return;

    const span = traces.find(s => s.spanId === spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    if (tags) span.tags = { ...span.tags, ...tags };
    span.status = status;

    this.emit('traceComplete', span);
  }

  /**
   * Check system health
   */
  async checkHealth(): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const now = Date.now();

    for (const [name, check] of this.healthChecks) {
      if (!check.enabled) continue;

      try {
        const startTime = Date.now();
        const response = await this.makeHealthCheckRequest(check);
        const duration = Date.now() - startTime;

        results[name] = {
          status: response.status === check.expectedStatus ? 'healthy' : 'unhealthy',
          responseTime: duration,
          lastChecked: now,
          details: response
        };
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message,
          lastChecked: now
        };
      }
    }

    // Calculate overall health
    const unhealthyCount = Object.values(results).filter((r: any) => r.status === 'unhealthy').length;
    const overallHealth = unhealthyCount === 0 ? 'healthy' : unhealthyCount < Object.keys(results).length / 2 ? 'degraded' : 'unhealthy';

    return {
      overall: overallHealth,
      timestamp: now,
      checks: results
    };
  }

  /**
   * Make health check request
   */
  private async makeHealthCheckRequest(check: HealthCheck): Promise<any> {
    // Implementation would depend on your HTTP client
    // This is a placeholder for the actual implementation
    return {
      status: check.expectedStatus,
      body: { status: 'ok' }
    };
  }

  /**
   * Evaluate alerts
   */
  async evaluateAlerts(): Promise<any[]> {
    const triggeredAlerts: any[] = [];

    for (const [name, alert] of this.alerts) {
      if (!alert.enabled) continue;

      try {
        const value = await this.evaluateAlertCondition(alert.condition);
        const isTriggered = this.compareValues(value, alert.threshold, alert.comparison);

        if (isTriggered) {
          triggeredAlerts.push({
            name: alert.name,
            severity: alert.severity,
            value,
            threshold: alert.threshold,
            description: alert.description,
            timestamp: Date.now()
          });

          this.emit('alert', {
            name: alert.name,
            severity: alert.severity,
            value,
            threshold: alert.threshold,
            description: alert.description
          });
        }
      } catch (error) {
        console.error(`Failed to evaluate alert ${alert.name}:`, error);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Evaluate alert condition (placeholder)
   */
  private async evaluateAlertCondition(condition: string): Promise<number> {
    // This would integrate with your metrics storage/query system
    // For now, return a placeholder value
    return 0;
  }

  /**
   * Compare values for alert evaluation
   */
  private compareValues(value: number, threshold: number, comparison: string): boolean {
    switch (comparison) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  /**
   * Get dashboard data
   */
  getDashboardData(dashboardId: string): any {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return null;

    return {
      ...dashboard,
      panels: dashboard.panels.map(panel => ({
        ...panel,
        data: this.getPanelData(panel.metrics)
      }))
    };
  }

  /**
   * Get panel data
   */
  private getPanelData(metrics: string[]): any {
    // This would query your metrics storage system
    // For now, return placeholder data
    return metrics.map(metric => ({
      metric,
      values: []
    }));
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Collect every 30 seconds
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    // Collect memory usage
    const memUsage = process.memoryUsage();
    this.setGauge('system_memory_usage_bytes', memUsage.heapUsed);

    // Collect CPU usage (simplified)
    this.setGauge('system_cpu_usage_percent', Math.random() * 100); // Placeholder

    // Collect other system metrics
    this.emit('metricsCollected');
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return Math.random().toString(36).substr(2, 16);
  }

  /**
   * Generate span ID
   */
  private generateSpanId(): string {
    return Math.random().toString(36).substr(2, 8);
  }

  /**
   * Enable/disable observability
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Get all metrics
   */
  getMetrics(): Map<string, any> {
    return this.metrics;
  }

  /**
   * Get all alerts
   */
  getAlerts(): Map<string, AlertDefinition> {
    return this.alerts;
  }

  /**
   * Get all dashboards
   */
  getDashboards(): Map<string, DashboardDefinition> {
    return this.dashboards;
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit: number = 1000): LogEntry[] {
    return this.logBuffer.slice(-limit);
  }

  /**
   * Get traces
   */
  getTraces(traceId?: string): Map<string, TraceSpan[]> | TraceSpan[] {
    if (traceId) {
      return this.traces.get(traceId) || [];
    }
    return this.traces;
  }

  /**
   * Cleanup old data
   */
  cleanup(): void {
    // Clean old traces (older than 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const [traceId, spans] of this.traces) {
      if (spans.every(span => span.startTime < oneDayAgo)) {
        this.traces.delete(traceId);
      }
    }

    // Clean old metrics timestamps
    for (const metric of this.metrics.values()) {
      metric.timestamps = metric.timestamps.filter(ts => ts > oneDayAgo);
    }
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    this.setEnabled(false);
  }
}

export { ObservabilityManager };
