/**
 * Production Monitoring Service
 * Provides comprehensive monitoring for Questro production environment
 */

import EventEmitter from 'events';
import winston from 'winston';
import axios from 'axios';

interface HealthCheck {
  name: string;
  url: string;
  method?: string;
  timeout?: number;
  interval?: number;
  retries?: number;
}

interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  service: string;
  message: string;
  value?: number;
  threshold?: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

interface MonitoringConfig {
  enabled: boolean;
  interval: number;
  alerts: {
    slack: {
      webhook: string;
      channel: string;
      enabled: boolean;
    };
    email: {
      enabled: boolean;
      recipients: string[];
    };
    pagerduty?: {
      integrationKey: string;
      enabled: boolean;
    };
  };
  thresholds: {
    responseTime: number;
    errorRate: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  };
}

export class ProductionMonitor extends EventEmitter {
  private logger: winston.Logger;
  private config: MonitoringConfig;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private metrics: Map<string, Metric[]> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/monitoring-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/monitoring.log' }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.setupHealthChecks();
  }

  /**
   * Initialize production monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Production monitoring is already running');
      return;
    }

    this.logger.info('Starting production monitoring...');

    // Start health checks
    for (const [name, healthCheck] of this.healthChecks) {
      this.startHealthCheck(name, healthCheck);
    }

    // Start metrics collection
    this.startMetricsCollection();

    // Setup alert monitoring
    this.startAlertMonitoring();

    this.isRunning = true;
    this.emit('started');
    this.logger.info('Production monitoring started successfully');
  }

  /**
   * Stop production monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Production monitoring is not running');
      return;
    }

    this.logger.info('Stopping production monitoring...');

    // Clear all intervals
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();

    this.isRunning = false;
    this.emit('stopped');
    this.logger.info('Production monitoring stopped');
  }

  /**
   * Setup default health checks
   */
  private setupHealthChecks(): void {
    const defaultChecks: HealthCheck[] = [
      {
        name: 'frontend',
        url: 'https://qestro.app/health',
        method: 'GET',
        timeout: 10000,
        interval: 30000,
        retries: 3
      },
      {
        name: 'backend-api',
        url: 'https://api.qestro.app/health',
        method: 'GET',
        timeout: 10000,
        interval: 30000,
        retries: 3
      },
      {
        name: 'database',
        url: 'https://api.qestro.app/health/database',
        method: 'GET',
        timeout: 15000,
        interval: 60000,
        retries: 2
      },
      {
        name: 'redis',
        url: 'https://api.qestro.app/health/redis',
        method: 'GET',
        timeout: 10000,
        interval: 60000,
        retries: 2
      },
      {
        name: 'websockets',
        url: 'https://api.qestro.app/health/websockets',
        method: 'GET',
        timeout: 10000,
        interval: 60000,
        retries: 2
      }
    ];

    defaultChecks.forEach(check => {
      this.healthChecks.set(check.name, check);
    });
  }

  /**
   * Start health check for a service
   */
  private startHealthCheck(name: string, healthCheck: HealthCheck): void {
    const interval = setInterval(async () => {
      await this.performHealthCheck(name, healthCheck);
    }, healthCheck.interval || 30000);

    this.intervals.set(`health:${name}`, interval);
    this.logger.info(`Started health check for ${name}`);
  }

  /**
   * Perform health check for a service
   */
  private async performHealthCheck(name: string, healthCheck: HealthCheck): Promise<void> {
    const startTime = Date.now();
    let attempts = 0;
    const maxRetries = healthCheck.retries || 3;

    while (attempts < maxRetries) {
      try {
        const response = await axios({
          url: healthCheck.url,
          method: healthCheck.method || 'GET',
          timeout: healthCheck.timeout || 10000,
          validateStatus: (status) => status < 500
        });

        const responseTime = Date.now() - startTime;

        // Record metric
        this.recordMetric(`${name}_response_time`, responseTime, 'ms');
        this.recordMetric(`${name}_status_code`, response.status, 'status');

        // Check if response time is within threshold
        if (responseTime > this.config.thresholds.responseTime) {
          this.createAlert(
            'warning',
            name,
            `High response time: ${responseTime}ms (threshold: ${this.config.thresholds.responseTime}ms)`,
            responseTime,
            this.config.thresholds.responseTime
          );
        }

        // Check if service is healthy
        if (response.status >= 200 && response.status < 400) {
          this.resolveAlert(name);
          this.logger.debug(`Health check passed for ${name}: ${responseTime}ms`);
        } else {
          this.createAlert(
            'error',
            name,
            `Service returned status ${response.status}`,
            response.status,
            400
          );
        }

        return;
      } catch (error) {
        attempts++;
        this.logger.warn(`Health check failed for ${name} (attempt ${attempts}/${maxRetries}):`, error);

        if (attempts >= maxRetries) {
          const responseTime = Date.now() - startTime;
          this.createAlert(
            'error',
            name,
            `Health check failed after ${maxRetries} attempts: ${error.message}`,
            responseTime,
            this.config.thresholds.responseTime
          );
          this.recordMetric(`${name}_errors`, 1, 'count');
        }
      }
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    const interval = setInterval(async () => {
      await this.collectSystemMetrics();
    }, 60000); // Collect every minute

    this.intervals.set('metrics:system', interval);
    this.logger.info('Started system metrics collection');
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      // Collect backend metrics
      await this.collectBackendMetrics();

      // Collect database metrics
      await this.collectDatabaseMetrics();

      // Collect business metrics
      await this.collectBusinessMetrics();

      // Clean old metrics (keep last 24 hours)
      this.cleanOldMetrics();
    } catch (error) {
      this.logger.error('Failed to collect system metrics:', error);
    }
  }

  /**
   * Collect backend-specific metrics
   */
  private async collectBackendMetrics(): Promise<void> {
    try {
      const response = await axios.get('https://api.qestro.app/metrics', {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${process.env.MONITORING_API_KEY}`
        }
      });

      const metrics = response.data;

      if (metrics.cpu) {
        this.recordMetric('backend_cpu_usage', metrics.cpu, 'percent');
      }
      if (metrics.memory) {
        this.recordMetric('backend_memory_usage', metrics.memory, 'percent');
      }
      if (metrics.active_connections) {
        this.recordMetric('active_connections', metrics.active_connections, 'count');
      }
      if (metrics.requests_per_minute) {
        this.recordMetric('requests_per_minute', metrics.requests_per_minute, 'rate');
      }
      if (metrics.error_rate) {
        this.recordMetric('error_rate', metrics.error_rate, 'percent');
      }
    } catch (error) {
      this.logger.warn('Failed to collect backend metrics:', error);
    }
  }

  /**
   * Collect database metrics
   */
  private async collectDatabaseMetrics(): Promise<void> {
    try {
      const response = await axios.get('https://api.qestro.app/health/database', {
        timeout: 15000
      });

      const health = response.data;

      if (health.connection_pool) {
        this.recordMetric('db_connection_pool_active', health.connection_pool.active, 'count');
        this.recordMetric('db_connection_pool_idle', health.connection_pool.idle, 'count');
      }
      if (health.performance) {
        this.recordMetric('db_query_time_avg', health.performance.avg_query_time, 'ms');
        this.recordMetric('db_queries_per_second', health.performance.queries_per_second, 'rate');
      }
    } catch (error) {
      this.logger.warn('Failed to collect database metrics:', error);
    }
  }

  /**
   * Collect business metrics
   */
  private async collectBusinessMetrics(): Promise<void> {
    try {
      const response = await axios.get('https://api.qestro.app/metrics/business', {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${process.env.MONITORING_API_KEY}`
        }
      });

      const metrics = response.data;

      if (metrics.active_users) {
        this.recordMetric('active_users', metrics.active_users, 'count');
      }
      if (metrics.test_runs_per_hour) {
        this.recordMetric('test_runs_per_hour', metrics.test_runs_per_hour, 'rate');
      }
      if (metrics.ai_requests_per_hour) {
        this.recordMetric('ai_requests_per_hour', metrics.ai_requests_per_hour, 'rate');
      }
    } catch (error) {
      this.logger.warn('Failed to collect business metrics:', error);
    }
  }

  /**
   * Start alert monitoring
   */
  private startAlertMonitoring(): void {
    const interval = setInterval(() => {
      this.checkAlertConditions();
    }, 30000); // Check every 30 seconds

    this.intervals.set('alerts:monitoring', interval);
    this.logger.info('Started alert monitoring');
  }

  /**
   * Check alert conditions
   */
  private checkAlertConditions(): void {
    const now = new Date();

    // Check CPU usage
    const cpuMetrics = this.getRecentMetrics('backend_cpu_usage', 5);
    if (cpuMetrics.length > 0) {
      const avgCpu = cpuMetrics.reduce((sum, m) => sum + m.value, 0) / cpuMetrics.length;
      if (avgCpu > this.config.thresholds.cpuUsage) {
        this.createAlert(
          'warning',
          'backend',
          `High CPU usage: ${avgCpu.toFixed(1)}% (threshold: ${this.config.thresholds.cpuUsage}%)`,
          avgCpu,
          this.config.thresholds.cpuUsage
        );
      }
    }

    // Check memory usage
    const memoryMetrics = this.getRecentMetrics('backend_memory_usage', 5);
    if (memoryMetrics.length > 0) {
      const avgMemory = memoryMetrics.reduce((sum, m) => sum + m.value, 0) / memoryMetrics.length;
      if (avgMemory > this.config.thresholds.memoryUsage) {
        this.createAlert(
          'warning',
          'backend',
          `High memory usage: ${avgMemory.toFixed(1)}% (threshold: ${this.config.thresholds.memoryUsage}%)`,
          avgMemory,
          this.config.thresholds.memoryUsage
        );
      }
    }

    // Check error rate
    const errorMetrics = this.getRecentMetrics('error_rate', 10);
    if (errorMetrics.length > 0) {
      const avgErrorRate = errorMetrics.reduce((sum, m) => sum + m.value, 0) / errorMetrics.length;
      if (avgErrorRate > this.config.thresholds.errorRate) {
        this.createAlert(
          'error',
          'backend',
          `High error rate: ${avgErrorRate.toFixed(1)}% (threshold: ${this.config.thresholds.errorRate}%)`,
          avgErrorRate,
          this.config.thresholds.errorRate
        );
      }
    }
  }

  /**
   * Record a metric
   */
  private recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    const metric: Metric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricList = this.metrics.get(name)!;
    metricList.push(metric);

    // Emit metric event
    this.emit('metric', metric);
  }

  /**
   * Get recent metrics for a name
   */
  private getRecentMetrics(name: string, count: number): Metric[] {
    const metricList = this.metrics.get(name) || [];
    return metricList.slice(-count);
  }

  /**
   * Create an alert
   */
  private createAlert(type: 'error' | 'warning' | 'info', service: string, message: string, value?: number, threshold?: number): void {
    const alertId = `${service}_${Date.now()}`;

    // Check if similar alert already exists and is not resolved
    const existingAlert = Array.from(this.alerts.values()).find(
      alert => alert.service === service && !alert.resolved && alert.message.includes(message.split(':')[0])
    );

    if (existingAlert) {
      return; // Don't create duplicate alerts
    }

    const alert: Alert = {
      id: alertId,
      type,
      service,
      message,
      value,
      threshold,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.set(alertId, alert);
    this.emit('alert', alert);
    this.logger.warn(`Alert created: [${type.toUpperCase()}] ${service}: ${message}`);

    // Send notifications
    this.sendAlertNotification(alert);
  }

  /**
   * Resolve an alert
   */
  private resolveAlert(service: string): void {
    const unresolvedAlerts = Array.from(this.alerts.values()).filter(
      alert => alert.service === service && !alert.resolved
    );

    unresolvedAlerts.forEach(alert => {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.emit('alert-resolved', alert);
      this.logger.info(`Alert resolved: ${service}: ${alert.message}`);
    });
  }

  /**
   * Send alert notification
   */
  private async sendAlertNotification(alert: Alert): Promise<void> {
    if (!this.config.alerts.slack.enabled) {
      return;
    }

    try {
      const color = alert.type === 'error' ? 'danger' : alert.type === 'warning' ? 'warning' : 'good';
      const emoji = alert.type === 'error' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️';

      const payload = {
        channel: this.config.alerts.slack.channel,
        attachments: [{
          color,
          title: `${emoji} Production Alert`,
          fields: [
            { title: 'Service', value: alert.service, short: true },
            { title: 'Type', value: alert.type.toUpperCase(), short: true },
            { title: 'Message', value: alert.message, short: false }
          ],
          timestamp: Math.floor(alert.timestamp.getTime() / 1000),
          footer: 'Questro Production Monitor',
          footer_icon: 'https://qestro.app/icon.png'
        }]
      };

      await axios.post(this.config.alerts.slack.webhook, payload);
      this.logger.info(`Alert notification sent to Slack: ${alert.service}`);
    } catch (error) {
      this.logger.error('Failed to send alert notification:', error);
    }
  }

  /**
   * Clean old metrics
   */
  private cleanOldMetrics(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    for (const [name, metricList] of this.metrics) {
      const filteredMetrics = metricList.filter(metric => metric.timestamp > cutoff);
      this.metrics.set(name, filteredMetrics);
    }
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    isRunning: boolean;
    healthChecks: Array<{ name: string; status: string; lastCheck?: Date }>;
    activeAlerts: number;
    metricsCount: number;
  } {
    const healthChecks = Array.from(this.healthChecks.keys()).map(name => ({
      name,
      status: 'unknown', // Would be determined by last health check result
      lastCheck: new Date() // Would be actual last check time
    }));

    return {
      isRunning: this.isRunning,
      healthChecks,
      activeAlerts: Array.from(this.alerts.values()).filter(alert => !alert.resolved).length,
      metricsCount: Array.from(this.metrics.values()).reduce((sum, list) => sum + list.length, 0)
    };
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit: number = 50): Alert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get metrics for a specific name
   */
  getMetrics(name: string, since?: Date): Metric[] {
    const metrics = this.metrics.get(name) || [];
    if (since) {
      return metrics.filter(metric => metric.timestamp >= since);
    }
    return metrics;
  }
}

export default ProductionMonitor;