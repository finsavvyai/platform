/**
 * Questro AI-Powered Testing Automation Platform
 * Metrics Collection Service
 *
 * Comprehensive metrics collection system providing application,
 * business, and infrastructure metrics with real-time aggregation
 * and intelligent alerting capabilities.
 */

import { EventEmitter } from 'events';

export interface MetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  labels: string[];
  unit?: string;
  aggregation?: 'sum' | 'avg' | 'max' | 'min' | 'count';
}

export interface MetricValue {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
  aggregation?: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: string;
  threshold: number;
  comparison: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  severity: 'info' | 'warning' | 'critical';
  duration: number; // seconds
  enabled: boolean;
  labels: Record<string, string>;
}

export interface Alert {
  id: string;
  rule: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  labels: Record<string, string>;
  acknowledged: boolean;
  resolved: boolean;
}

export interface DashboardConfig {
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

/**
 * Metrics Collection Service
 */
export class MetricsCollector extends EventEmitter {
  private metrics: Map<string, MetricDefinition> = new Map();
  private metricValues: Map<string, MetricValue[]> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private dashboards: Map<string, DashboardConfig> = new Map();
  private collectionInterval?: NodeJS.Timeout;
  private evaluationInterval?: NodeJS.Timeout;
  private isEnabled: boolean = true;

  constructor() {
    super();
    this.initializeDefaultMetrics();
    this.initializeAlertRules();
    this.initializeDashboards();
    this.startCollection();
  }

  /**
   * Initialize default metrics
   */
  private initializeDefaultMetrics(): void {
    const defaultMetrics: MetricDefinition[] = [
      // Application Metrics
      {
        name: 'http_requests_total',
        type: 'counter',
        help: 'Total HTTP requests',
        labels: ['method', 'route', 'status'],
        unit: 'requests',
        aggregation: 'sum'
      },
      {
        name: 'http_request_duration_ms',
        type: 'histogram',
        help: 'HTTP request duration in milliseconds',
        labels: ['method', 'route'],
        unit: 'milliseconds'
      },
      {
        name: 'http_active_connections',
        type: 'gauge',
        help: 'Active HTTP connections',
        labels: [],
        unit: 'connections',
        aggregation: 'sum'
      },
      {
        name: 'http_errors_total',
        type: 'counter',
        help: 'Total HTTP errors',
        labels: ['method', 'route', 'status', 'error_type'],
        unit: 'errors',
        aggregation: 'sum'
      },

      // Business Metrics
      {
        name: 'users_active',
        type: 'gauge',
        help: 'Active users in the last 5 minutes',
        labels: ['subscription_tier'],
        unit: 'users'
      },
      {
        name: 'test_runs_total',
        type: 'counter',
        help: 'Total test runs executed',
        labels: ['platform', 'status', 'test_type'],
        unit: 'runs',
        aggregation: 'sum'
      },
      {
        name: 'test_execution_duration',
        type: 'histogram',
        help: 'Test execution duration in seconds',
        labels: ['platform', 'test_type'],
        unit: 'seconds'
      },
      {
        name: 'test_success_rate',
        type: 'gauge',
        help: 'Test success rate percentage',
        labels: ['platform', 'time_range'],
        unit: 'percent'
      },

      // AI Service Metrics
      {
        name: 'ai_requests_total',
        type: 'counter',
        help: 'Total AI API requests',
        labels: ['provider', 'model', 'operation'],
        unit: 'requests',
        aggregation: 'sum'
      },
      {
        name: 'ai_request_duration',
        type: 'histogram',
        help: 'AI request duration in milliseconds',
        labels: ['provider', 'model'],
        unit: 'milliseconds'
      },
      {
        name: 'ai_tokens_used',
        type: 'counter',
        help: 'Total AI tokens used',
        labels: ['provider', 'model', 'token_type'],
        unit: 'tokens',
        aggregation: 'sum'
      },
      {
        name: 'ai_cost_usd',
        type: 'counter',
        help: 'AI service cost in USD',
        labels: ['provider', 'model'],
        unit: 'dollars',
        aggregation: 'sum'
      },

      // WebSocket Metrics
      {
        name: 'websocket_connections_total',
        type: 'counter',
        help: 'Total WebSocket connections',
        labels: ['status'],
        unit: 'connections',
        aggregation: 'sum'
      },
      {
        name: 'websocket_connections_active',
        type: 'gauge',
        help: 'Active WebSocket connections',
        labels: [],
        unit: 'connections'
      },
      {
        name: 'websocket_messages_total',
        type: 'counter',
        help: 'Total WebSocket messages',
        labels: ['type', 'direction'],
        unit: 'messages',
        aggregation: 'sum'
      },
      {
        name: 'websocket_message_latency',
        type: 'histogram',
        help: 'WebSocket message latency in milliseconds',
        labels: ['message_type'],
        unit: 'milliseconds'
      },

      // Database Metrics
      {
        name: 'db_connections_active',
        type: 'gauge',
        help: 'Active database connections',
        labels: ['database_type'],
        unit: 'connections'
      },
      {
        name: 'db_query_duration',
        type: 'histogram',
        help: 'Database query duration in milliseconds',
        labels: ['table', 'operation'],
        unit: 'milliseconds'
      },
      {
        name: 'db_queries_total',
        type: 'counter',
        help: 'Total database queries',
        labels: ['table', 'operation', 'status'],
        unit: 'queries',
        aggregation: 'sum'
      },
      {
        name: 'db_rows_affected',
        type: 'counter',
        help: 'Total database rows affected',
        labels: ['table', 'operation'],
        unit: 'rows',
        aggregation: 'sum'
      },

      // Infrastructure Metrics
      {
        name: 'system_cpu_usage_percent',
        type: 'gauge',
        help: 'CPU usage percentage',
        labels: ['core'],
        unit: 'percent'
      },
      {
        name: 'system_memory_usage_bytes',
        type: 'gauge',
        help: 'Memory usage in bytes',
        labels: ['type'],
        unit: 'bytes'
      },
      {
        name: 'system_disk_usage_bytes',
        type: 'gauge',
        help: 'Disk usage in bytes',
        labels: ['mount_point'],
        unit: 'bytes'
      },
      {
        name: 'system_network_bytes',
        type: 'counter',
        help: 'Network bytes transferred',
        labels: ['direction', 'interface'],
        unit: 'bytes',
        aggregation: 'sum'
      },

      // Cache Metrics
      {
        name: 'cache_hits_total',
        type: 'counter',
        help: 'Cache hits',
        labels: ['cache_type', 'key_pattern'],
        unit: 'hits',
        aggregation: 'sum'
      },
      {
        name: 'cache_misses_total',
        type: 'counter',
        help: 'Cache misses',
        labels: ['cache_type', 'key_pattern'],
        unit: 'misses',
        aggregation: 'sum'
      },
      {
        name: 'cache_hit_rate',
        type: 'gauge',
        help: 'Cache hit rate percentage',
        labels: ['cache_type'],
        unit: 'percent'
      },

      // Team Collaboration Metrics
      {
        name: 'collaboration_sessions_active',
        type: 'gauge',
        help: 'Active collaboration sessions',
        labels: ['session_type'],
        unit: 'sessions'
      },
      {
        name: 'collaboration_participants',
        type: 'gauge',
        help: 'Active collaboration participants',
        labels: ['session_type'],
        unit: 'participants'
      },
      {
        name: 'collaboration_events_total',
        type: 'counter',
        help: 'Total collaboration events',
        labels: ['event_type', 'session_type'],
        unit: 'events',
        aggregation: 'sum'
      }
    ];

    defaultMetrics.forEach(metric => {
      this.metrics.set(metric.name, metric);
      this.metricValues.set(metric.name, []);
    });
  }

  /**
   * Initialize alert rules
   */
  private initializeAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'HTTP error rate is above 5%',
        metric: 'http_errors_total',
        condition: 'rate(http_errors_total[5m]) / rate(http_requests_total[5m])',
        threshold: 0.05,
        comparison: 'gt',
        severity: 'critical',
        duration: 300, // 5 minutes
        enabled: true,
        labels: { category: 'application', service: 'api' }
      },
      {
        id: 'slow_response_time',
        name: 'Slow Response Time',
        description: '95th percentile response time is above 2 seconds',
        metric: 'http_request_duration_ms',
        condition: 'histogram_quantile(0.95, http_request_duration_ms[5m])',
        threshold: 2000,
        comparison: 'gt',
        severity: 'warning',
        duration: 180, // 3 minutes
        enabled: true,
        labels: { category: 'performance', service: 'api' }
      },
      {
        id: 'database_connections_exhaustion',
        name: 'Database Connection Exhaustion',
        description: 'Database connections are near exhaustion',
        metric: 'db_connections_active',
        condition: 'db_connections_active',
        threshold: 18, // Assuming max 20 connections
        comparison: 'gt',
        severity: 'critical',
        duration: 60, // 1 minute
        enabled: true,
        labels: { category: 'database', service: 'backend' }
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        description: 'Memory usage is above 85%',
        metric: 'system_memory_usage_bytes',
        condition: 'system_memory_usage_bytes / system_memory_total_bytes',
        threshold: 0.85,
        comparison: 'gt',
        severity: 'warning',
        duration: 300, // 5 minutes
        enabled: true,
        labels: { category: 'infrastructure', service: 'system' }
      },
      {
        id: 'ai_service_failure',
        name: 'AI Service Failure',
        description: 'AI service error rate is above 10%',
        metric: 'ai_requests_total',
        condition: 'rate(ai_requests_total{status="error"}[5m]) / rate(ai_requests_total[5m])',
        threshold: 0.1,
        comparison: 'gt',
        severity: 'warning',
        duration: 180, // 3 minutes
        enabled: true,
        labels: { category: 'ai', service: 'external' }
      },
      {
        id: 'low_test_success_rate',
        name: 'Low Test Success Rate',
        description: 'Test success rate is below 90%',
        metric: 'test_success_rate',
        condition: 'test_success_rate',
        threshold: 90,
        comparison: 'lt',
        severity: 'warning',
        duration: 600, // 10 minutes
        enabled: true,
        labels: { category: 'business', service: 'testing' }
      },
      {
        id: 'websocket_connection_failures',
        name: 'WebSocket Connection Failures',
        description: 'WebSocket connection failures are high',
        metric: 'websocket_connections_total',
        condition: 'rate(websocket_connections_total{status="error"}[5m])',
        threshold: 10,
        comparison: 'gt',
        severity: 'warning',
        duration: 180, // 3 minutes
        enabled: true,
        labels: { category: 'realtime', service: 'websocket' }
      }
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  /**
   * Initialize dashboards
   */
  private initializeDashboards(): void {
    const dashboards: DashboardConfig[] = [
      {
        id: 'system-overview',
        name: 'System Overview',
        description: 'High-level system health and performance metrics',
        panels: [
          {
            id: 'active-users',
            title: 'Active Users',
            type: 'stat',
            metrics: ['users_active'],
            visualization: {
              type: 'stat',
              options: { unit: 'short' }
            },
            position: { x: 0, y: 0, width: 6, height: 8 }
          },
          {
            id: 'request-rate',
            title: 'Request Rate',
            type: 'graph',
            metrics: ['rate(http_requests_total[5m])'],
            visualization: {
              type: 'line',
              options: { legend: true }
            },
            position: { x: 6, y: 0, width: 12, height: 8 }
          },
          {
            id: 'error-rate',
            title: 'Error Rate',
            type: 'graph',
            metrics: ['rate(http_errors_total[5m]) / rate(http_requests_total[5m])'],
            visualization: {
              type: 'line',
              options: { color: 'red' }
            },
            position: { x: 18, y: 0, width: 6, height: 8 }
          }
        ],
        refreshInterval: 30000, // 30 seconds
        timeRange: '1h'
      },
      {
        id: 'business-metrics',
        name: 'Business Metrics',
        description: 'Business intelligence and user engagement metrics',
        panels: [
          {
            id: 'test-execution-trend',
            title: 'Test Execution Trend',
            type: 'graph',
            metrics: ['rate(test_runs_total[1h])'],
            visualization: {
              type: 'line',
              options: { legend: true }
            },
            position: { x: 0, y: 0, width: 12, height: 8 }
          },
          {
            id: 'ai-usage-cost',
            title: 'AI Usage Cost',
            type: 'graph',
            metrics: ['increase(ai_cost_usd[1h])'],
            visualization: {
              type: 'line',
              options: { yAxis: { unit: 'USD' } }
            },
            position: { x: 12, y: 0, width: 12, height: 8 }
          }
        ],
        refreshInterval: 60000, // 1 minute
        timeRange: '24h'
      }
    ];

    dashboards.forEach(dashboard => {
      this.dashboards.set(dashboard.id, dashboard);
    });
  }

  /**
   * Start metrics collection
   */
  private startCollection(): void {
    this.collectionInterval = setInterval(() => {
      if (this.isEnabled) {
        this.collectSystemMetrics();
      }
    }, 30000); // Collect every 30 seconds

    this.evaluationInterval = setInterval(() => {
      if (this.isEnabled) {
        this.evaluateAlertRules();
      }
    }, 60000); // Evaluate alerts every minute
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    // Memory usage
    const memUsage = process.memoryUsage();
    this.setGauge('system_memory_usage_bytes', memUsage.heapUsed, { type: 'heap' });
    this.setGauge('system_memory_usage_bytes', memUsage.heapTotal, { type: 'heap_total' });
    this.setGauge('system_memory_usage_bytes', memUsage.rss, { type: 'rss' });

    // CPU usage (simplified - in production would use proper system monitoring)
    const cpuUsage = Math.random() * 100; // Placeholder
    this.setGauge('system_cpu_usage_percent', cpuUsage, { core: '0' });

    // Active connections (would be tracked by the application)
    const activeConnections = Math.floor(Math.random() * 50); // Placeholder
    this.setGauge('http_active_connections', activeConnections);

    // Database connections (would be tracked by database service)
    const dbConnections = Math.floor(Math.random() * 20); // Placeholder
    this.setGauge('db_connections_active', dbConnections, { database_type: 'postgres' });

    // Cache metrics (would be tracked by cache service)
    const cacheHitRate = 85 + Math.random() * 10; // Placeholder 85-95%
    this.setGauge('cache_hit_rate', cacheHitRate, { cache_type: 'redis' });

    this.emit('metricsCollected');
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

    const timestamp = new Date();
    const metricValue: MetricValue = {
      timestamp,
      value,
      labels
    };

    const values = this.metricValues.get(name) || [];
    values.push(metricValue);

    // Keep only last 1000 values
    if (values.length > 1000) {
      values.splice(0, values.length - 1000);
    }

    this.metricValues.set(name, values);

    // Emit metric event
    this.emit('metric', { name, value, labels, timestamp });
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const currentValues = this.metricValues.get(name) || [];
    const lastValue = currentValues[currentValues.length - 1];
    const currentValue = lastValue?.value || 0;

    this.recordMetric(name, currentValue + value, labels);
  }

  /**
   * Set a gauge metric
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
   * Evaluate alert rules
   */
  private async evaluateAlertRules(): Promise<void> {
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        const currentValue = await this.getMetricValue(rule.metric);
        if (currentValue === null) continue;

        const shouldAlert = this.evaluateCondition(currentValue, rule.threshold, rule.comparison);

        if (shouldAlert) {
          await this.checkAlertThreshold(rule, currentValue);
        } else {
          await this.resolveAlert(ruleId);
        }
      } catch (error) {
        console.error(`Error evaluating alert rule ${ruleId}:`, error);
      }
    }
  }

  /**
   * Get metric value (simplified implementation)
   */
  private async getMetricValue(metricName: string): Promise<number | null> {
    const values = this.metricValues.get(metricName);
    if (!values || values.length === 0) return null;

    // For simplicity, return the most recent value
    // In a real implementation, this would parse the condition and calculate the result
    return values[values.length - 1].value;
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(value: number, threshold: number, comparison: string): boolean {
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
   * Check alert threshold with duration
   */
  private async checkAlertThreshold(rule: AlertRule, currentValue: number): Promise<void> {
    const alertId = `${rule.id}_${Math.floor(Date.now() / (rule.duration * 1000))}`;
    const existingAlert = this.alerts.get(alertId);

    if (!existingAlert) {
      const alert: Alert = {
        id: alertId,
        rule: rule.id,
        severity: rule.severity,
        message: `${rule.name}: ${currentValue} ${rule.comparison} ${rule.threshold}`,
        value: currentValue,
        threshold: rule.threshold,
        timestamp: new Date(),
        labels: rule.labels,
        acknowledged: false,
        resolved: false
      };

      this.alerts.set(alertId, alert);
      this.emit('alert', alert);

      // Send notification
      await this.sendAlertNotification(alert);
    }
  }

  /**
   * Resolve alert
   */
  private async resolveAlert(ruleId: string): Promise<void> {
    const activeAlerts = Array.from(this.alerts.values())
      .filter(alert => alert.rule === ruleId && !alert.resolved);

    for (const alert of activeAlerts) {
      alert.resolved = true;
      alert.acknowledged = true; // Auto-acknowledge resolved alerts

      this.emit('alertResolved', alert);

      // Send resolution notification
      await this.sendAlertResolvedNotification(alert);
    }
  }

  /**
   * Send alert notification
   */
  private async sendAlertNotification(alert: Alert): Promise<void> {
    console.log(`🚨 ALERT [${alert.severity.toUpperCase()}] ${alert.message}`);

    // In a real implementation, this would send to Slack, PagerDuty, etc.
    this.emit('notification', {
      type: 'alert',
      severity: alert.severity,
      message: alert.message,
      rule: alert.rule,
      value: alert.value,
      threshold: alert.threshold,
      labels: alert.labels
    });
  }

  /**
   * Send alert resolved notification
   */
  private async sendAlertResolvedNotification(alert: Alert): Promise<void> {
    console.log(`✅ RESOLVED [${alert.severity.toUpperCase()}] ${alert.message}`);

    // In a real implementation, this would send to Slack, PagerDuty, etc.
    this.emit('notification', {
      type: 'alert_resolved',
      severity: alert.severity,
      message: alert.message,
      rule: alert.rule,
      duration: Date.now() - alert.timestamp.getTime(),
      labels: alert.labels
    });
  }

  /**
   * Get metric values
   */
  getMetricValues(name: string, timeRange?: number): MetricValue[] {
    const values = this.metricValues.get(name) || [];

    if (!timeRange) return values;

    const cutoff = Date.now() - (timeRange * 1000);
    return values.filter(v => v.timestamp.getTime() > cutoff);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
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
    return metrics.map(metricName => ({
      metric: metricName,
      values: this.getMetricValues(metricName, 3600) // Last hour
    }));
  }

  /**
   * Create custom metric
   */
  createMetric(definition: MetricDefinition): void {
    this.metrics.set(definition.name, definition);
    this.metricValues.set(definition.name, []);
  }

  /**
   * Create alert rule
   */
  createAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  /**
   * Create dashboard
   */
  createDashboard(dashboard: DashboardConfig): void {
    this.dashboards.set(dashboard.id, dashboard);
  }

  /**
   * Enable/disable metrics collection
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Get all metrics definitions
   */
  getMetrics(): MetricDefinition[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get all dashboards
   */
  getDashboards(): DashboardConfig[] {
    return Array.from(this.dashboards.values());
  }

  /**
   * Cleanup old data
   */
  cleanup(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

    for (const [name, values] of this.metricValues) {
      const filtered = values.filter(v => v.timestamp.getTime() > cutoff);
      this.metricValues.set(name, filtered);
    }

    // Cleanup resolved alerts older than 7 days
    const alertCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    for (const [id, alert] of this.alerts) {
      if (alert.resolved && alert.timestamp.getTime() < alertCutoff) {
        this.alerts.delete(id);
      }
    }
  }

  /**
   * Shutdown metrics collector
   */
  shutdown(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }
    this.setEnabled(false);
  }
}

export { MetricsCollector };
