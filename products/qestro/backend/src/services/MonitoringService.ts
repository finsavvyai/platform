import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { Request, Response, NextFunction } from 'express';

export interface MetricData {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: Date;
}

export interface PerformanceMetrics {
  requestCount: number;
  responseTime: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  activeConnections: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
}

export interface Alert {
  id: string;
  name: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  condition: string;
  threshold: number;
  currentValue: number;
  triggered: boolean;
  triggeredAt?: Date;
  resolvedAt?: Date;
  notificationChannels: ('email' | 'slack' | 'pagerduty' | 'webhook')[];
}

class MonitoringService extends EventEmitter {
  private metrics: Map<string, MetricData[]> = new Map();
  private requestTimes: number[] = [];
  private requestCount = 0;
  private errorCount = 0;
  private activeConnections = 0;
  private metricsRetentionMs = 24 * 60 * 60 * 1000; // 24 hours
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Alerting
  private alerts: Map<string, Alert> = new Map();
  private readonly webhookUrl?: string;
  private readonly slackWebhookUrl?: string;

  constructor() {
    super();
    this.webhookUrl = process.env.KEY_ALERT_WEBHOOK_URL;
    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

    this.startMetricsCleanup();
    this.initializeDefaultAlerts();
    this.startPeriodicEvaluation();
  }

  /**
   * Initialize default system alerts
   */
  private initializeDefaultAlerts(): void {
    // High error rate alert
    this.registerAlert({
      id: 'high_error_rate',
      name: 'High Error Rate',
      severity: 'warning',
      condition: 'error_rate > threshold',
      threshold: 5, // 5%
      currentValue: 0,
      triggered: false,
      notificationChannels: ['slack', 'email'],
    });

    // API latency alert
    this.registerAlert({
      id: 'high_latency',
      name: 'High API Latency',
      severity: 'warning',
      condition: 'p95_latency > threshold_ms',
      threshold: 2000,
      currentValue: 0,
      triggered: false,
      notificationChannels: ['slack'],
    });

    // Memory usage alert
    this.registerAlert({
      id: 'high_memory',
      name: 'High Memory Usage',
      severity: 'warning',
      condition: 'memory_usage_percent > threshold',
      threshold: 85,
      currentValue: 0,
      triggered: false,
      notificationChannels: ['slack'],
    });
  }

  /**
   * Register a new alert
   */
  registerAlert(alert: Alert): void {
    this.alerts.set(alert.id, alert);
  }

  /**
   * Record a custom metric
   */
  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    const metric: MetricData = {
      name,
      value,
      labels,
      timestamp: new Date()
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);
    this.emit('metricRecorded', metric);
  }

  /**
   * Record request timing
   */
  recordRequestTime(responseTimeMs: number): void {
    this.requestTimes.push(responseTimeMs);
    this.requestCount++;

    // Keep only last 1000 request times for percentile calculations
    if (this.requestTimes.length > 1000) {
      this.requestTimes.shift();
    }

    this.recordMetric('http_request_duration_ms', responseTimeMs);
    this.recordMetric('http_requests_total', this.requestCount);

    // Evaluate latency alert
    this.evaluateAlert('high_latency', responseTimeMs); // Simplified check per request
  }

  /**
   * Record an error
   */
  recordError(errorType: string, details?: any): void {
    this.errorCount++;
    this.recordMetric('http_errors_total', this.errorCount, { type: errorType });

    if (details) {
      logger.error(`Error recorded: ${errorType}`, details);
    }

    // Check error rate
    const errorRate = (this.errorCount / Math.max(1, this.requestCount)) * 100;
    this.evaluateAlert('high_error_rate', errorRate);
  }

  /**
   * Update active connections count
   */
  updateActiveConnections(count: number): void {
    this.activeConnections = count;
    this.recordMetric('active_connections', count);
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Calculate response time percentiles
    const sortedTimes = [...this.requestTimes].sort((a, b) => a - b);
    const responseTime = {
      avg: sortedTimes.length > 0 ? sortedTimes.reduce((sum, time) => sum + time, 0) / sortedTimes.length : 0,
      p50: this.getPercentile(sortedTimes, 50),
      p95: this.getPercentile(sortedTimes, 95),
      p99: this.getPercentile(sortedTimes, 99)
    };

    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;

    return {
      requestCount: this.requestCount,
      responseTime,
      errorRate,
      activeConnections: this.activeConnections,
      memoryUsage: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024) // MB
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };
  }

  /**
   * Get metrics for a specific name
   */
  getMetrics(name: string, since?: Date): MetricData[] {
    const metrics = this.metrics.get(name) || [];

    if (since) {
      return metrics.filter(m => m.timestamp >= since);
    }

    return metrics;
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Generate Prometheus-style metrics
   */
  generatePrometheusMetrics(): string {
    const metrics: string[] = [];
    const performanceMetrics = this.getPerformanceMetrics();
    const timestamp = Date.now();

    // Add performance metrics
    metrics.push(
      '# HELP qestro_http_requests_total Total number of HTTP requests',
      '# TYPE qestro_http_requests_total counter',
      `qestro_http_requests_total ${performanceMetrics.requestCount} ${timestamp}`,
      '',
      '# HELP qestro_http_request_duration_ms HTTP request duration in milliseconds',
      '# TYPE qestro_http_request_duration_ms histogram',
      `qestro_http_request_duration_ms_avg ${performanceMetrics.responseTime.avg} ${timestamp}`,
      `qestro_http_request_duration_ms_p50 ${performanceMetrics.responseTime.p50} ${timestamp}`,
      `qestro_http_request_duration_ms_p95 ${performanceMetrics.responseTime.p95} ${timestamp}`,
      `qestro_http_request_duration_ms_p99 ${performanceMetrics.responseTime.p99} ${timestamp}`,
      '',
      '# HELP qestro_http_error_rate HTTP error rate percentage',
      '# TYPE qestro_http_error_rate gauge',
      `qestro_http_error_rate ${performanceMetrics.errorRate} ${timestamp}`,
      '',
      '# HELP qestro_active_connections Number of active connections',
      '# TYPE qestro_active_connections gauge',
      `qestro_active_connections ${performanceMetrics.activeConnections} ${timestamp}`,
      '',
      '# HELP qestro_memory_usage_mb Memory usage in megabytes',
      '# TYPE qestro_memory_usage_mb gauge',
      `qestro_memory_usage_mb{type="heap_used"} ${performanceMetrics.memoryUsage.heapUsed} ${timestamp}`,
      `qestro_memory_usage_mb{type="heap_total"} ${performanceMetrics.memoryUsage.heapTotal} ${timestamp}`,
      `qestro_memory_usage_mb{type="external"} ${performanceMetrics.memoryUsage.external} ${timestamp}`,
      `qestro_memory_usage_mb{type="rss"} ${performanceMetrics.memoryUsage.rss} ${timestamp}`,
      '',
      '# HELP qestro_cpu_usage_microseconds CPU usage in microseconds',
      '# TYPE qestro_cpu_usage_microseconds counter',
      `qestro_cpu_usage_microseconds{type="user"} ${performanceMetrics.cpuUsage.user} ${timestamp}`,
      `qestro_cpu_usage_microseconds{type="system"} ${performanceMetrics.cpuUsage.system} ${timestamp}`,
      ''
    );

    // Add custom metrics
    for (const [name, metricList] of this.metrics.entries()) {
      if (metricList.length === 0) continue;

      const latestMetric = metricList[metricList.length - 1];
      const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, '_');

      metrics.push(
        `# HELP qestro_${sanitizedName} Custom metric: ${name}`,
        `# TYPE qestro_${sanitizedName} gauge`
      );

      if (latestMetric.labels) {
        const labelStr = Object.entries(latestMetric.labels)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');
        metrics.push(`qestro_${sanitizedName}{${labelStr}} ${latestMetric.value} ${timestamp}`);
      } else {
        metrics.push(`qestro_${sanitizedName} ${latestMetric.value} ${timestamp}`);
      }

      metrics.push('');
    }

    return metrics.join('\n');
  }

  /**
   * Create middleware for Express to track requests
   */
  createExpressMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Track active connections
      this.updateActiveConnections(this.activeConnections + 1);

      // Override res.end to capture response time
      const originalEnd = res.end;
      const self = this;

      // @ts-ignore
      res.end = function (chunk?: any, encoding?: any, cb?: any) {
        const responseTime = Date.now() - startTime;
        self.recordRequestTime(responseTime);

        // Record error if status code indicates error
        if (res.statusCode >= 400) {
          self.recordError(`http_${res.statusCode}`, {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode
          });
        }

        // Update active connections
        self.updateActiveConnections(self.activeConnections - 1);

        // Call original end method
        // @ts-ignore
        originalEnd.apply(res, arguments);
      };

      next();
    };
  }

  /**
   * Alert Evaluation Logic
   */
  async evaluateAlert(alertId: string, currentValue: number): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) return;

    alert.currentValue = currentValue;
    const previouslyTriggered = alert.triggered;

    // Check condition based on alert type - simplified/safe eval
    let shouldTrigger = false;
    if (alert.condition.includes('>')) {
      shouldTrigger = currentValue > alert.threshold;
    } else if (alert.condition.includes('<')) {
      shouldTrigger = currentValue < alert.threshold;
    }

    if (shouldTrigger && !previouslyTriggered) {
      // New trigger
      alert.triggered = true;
      alert.triggeredAt = new Date();
      alert.resolvedAt = undefined;
      await this.notify(alert, 'triggered');
      logger.warn(`Alert triggered: ${alert.name}`, {
        alertId,
        currentValue,
        threshold: alert.threshold
      });
    } else if (!shouldTrigger && previouslyTriggered) {
      // Resolved
      alert.triggered = false;
      alert.resolvedAt = new Date();
      await this.notify(alert, 'resolved');
      logger.info(`Alert resolved: ${alert.name}`, { alertId });
    }
  }

  async notify(alert: Alert, status: 'triggered' | 'resolved'): Promise<void> {
    // In production this would send actual HTTP requests
    logger.info(`[NOTIFICATION] ${alert.name} is ${status.toUpperCase()} (Value: ${alert.currentValue})`);

    const payload = {
      alert: alert.name,
      severity: alert.severity,
      status,
      currentValue: alert.currentValue,
      threshold: alert.threshold,
      timestamp: new Date().toISOString(),
    };

    if (alert.notificationChannels.includes('webhook') && this.webhookUrl) {
      // Fire and forget
      fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(e => logger.error('Failed to send alert webhook', e));
    }
  }

  /**
   * Start periodic tasks like memory monitoring
   */
  private startPeriodicEvaluation(): void {
    setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
      this.evaluateAlert('high_memory', heapUsedPercent);
    }, 30000);
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.metrics.clear();
    this.requestTimes.length = 0;
    this.requestCount = 0;
    this.errorCount = 0;
    this.activeConnections = 0;
  }

  /**
   * Start periodic cleanup of old metrics
   */
  private startMetricsCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Clean up old metrics beyond retention period
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - this.metricsRetentionMs);
    let totalCleaned = 0;

    for (const [name, metricList] of this.metrics.entries()) {
      const originalLength = metricList.length;
      const filteredMetrics = metricList.filter(m => m.timestamp >= cutoffTime);

      if (filteredMetrics.length !== originalLength) {
        this.metrics.set(name, filteredMetrics);
        totalCleaned += originalLength - filteredMetrics.length;
      }
    }

    if (totalCleaned > 0) {
      logger.debug(`Cleaned up ${totalCleaned} old metrics`);
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Check if monitoring service is healthy
   */
  async isHealthy(): Promise<boolean> {
    return true; // Placeholder - always healthy for now
  }

  /**
   * Report a critical alert
   */
  async reportCriticalAlert(alert: any): Promise<void> {
    logger.error('CRITICAL ALERT:', alert);
    this.emit('criticalAlert', alert);
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();