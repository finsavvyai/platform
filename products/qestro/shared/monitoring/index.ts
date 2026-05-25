import { EventEmitter } from '../utils';
import { config } from '../config';

export interface TelemetryEvent {
  id: string;
  type: string;
  category: TelemetryCategory;
  userId?: string;
  sessionId?: string;
  projectId?: string;
  teamId?: string;
  data: Record<string, any>;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export type TelemetryCategory =
  | 'user_action'
  | 'system_event'
  | 'performance'
  | 'error'
  | 'security'
  | 'api_call'
  | 'test_execution'
  | 'recording'
  | 'feature_usage'
  | 'deployment';

export interface Metric {
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  labels?: Record<string, string>;
  timestamp: Date;
  unit?: string;
  description?: string;
}

export interface HealthCheck {
  id: string;
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  metrics?: Metric[];
  timestamp: Date;
  duration?: number;
  dependencies?: string[];
}

export interface Alert {
  id: string;
  name: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  type: string;
  message: string;
  source: string;
  timestamp: Date;
  resolved?: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export interface MonitoringConfig {
  enabled: boolean;
  providers: {
    telemetry: string;
    analytics: string;
    errorReporting: string;
    logging: string;
  };
  thresholds: {
    errorRate: number;
    responseTime: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  };
  alerts: {
    enabled: boolean;
    channels: string[];
    rules: AlertRule[];
  };
  sampling: {
    enabled: boolean;
    rate: number;
    maxEvents: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  window: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  enabled: boolean;
  channels: string[];
}

export class TelemetryService {
  private static instance: TelemetryService;
  private eventEmitter: EventEmitter;
  private config: MonitoringConfig;
  private events: TelemetryEvent[] = [];
  private metrics: Map<string, Metric[]> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();

  private constructor() {
    this.eventEmitter = new EventEmitter();
    this.config = this.loadConfig();
    this.setupEventHandlers();
  }

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  private loadConfig(): MonitoringConfig {
    const monitoringConfig = config.get('monitoring');
    return {
      enabled: monitoringConfig.telemetry.enabled || false,
      providers: {
        telemetry: monitoringConfig.telemetry.provider || 'console',
        analytics: monitoringConfig.analytics.provider || 'console',
        errorReporting: monitoringConfig.errorReporting.provider || 'console',
        logging: monitoringConfig.logging.provider || 'console'
      },
      thresholds: {
        errorRate: 0.05,
        responseTime: 5000,
        cpuUsage: 80,
        memoryUsage: 85,
        diskUsage: 90
      },
      alerts: {
        enabled: true,
        channels: ['console'],
        rules: []
      },
      sampling: {
        enabled: true,
        rate: 0.1,
        maxEvents: 10000
      }
    };
  }

  private setupEventHandlers(): void {
    // Setup alert checking interval
    setInterval(() => {
      this.checkAlerts();
    }, 60000); // Check every minute

    // Setup event cleanup
    setInterval(() => {
      this.cleanupOldData();
    }, 300000); // Clean up every 5 minutes

    // Setup health check interval
    setInterval(() => {
      this.runHealthChecks();
    }, 30000); // Health checks every 30 seconds
  }

  // Telemetry events
  trackEvent(type: string, data: Record<string, any>, context?: {
    userId?: string;
    sessionId?: string;
    projectId?: string;
    teamId?: string;
    category?: TelemetryCategory;
    metadata?: Record<string, any>;
  }): void {
    if (!this.config.enabled) return;

    if (this.config.sampling.enabled && Math.random() > this.config.sampling.rate) {
      return;
    }

    const event: TelemetryEvent = {
      id: this.generateId('event'),
      type,
      category: context?.category || 'user_action',
      userId: context?.userId,
      sessionId: context?.sessionId,
      projectId: context?.projectId,
      teamId: context?.teamId,
      data: this.sanitizeData(data),
      timestamp: new Date(),
      metadata: context?.metadata
    };

    this.events.push(event);

    // Limit events in memory
    if (this.events.length > this.config.sampling.maxEvents) {
      this.events = this.events.slice(-this.config.sampling.maxEvents);
    }

    // Emit event for real-time processing
    this.eventEmitter.emit('telemetry.event', event);

    // Send to provider
    this.sendEvent(event);
  }

  trackMetric(name: string, value: number, type: Metric['type'] = 'gauge', context?: {
    labels?: Record<string, string>;
    unit?: string;
    description?: string;
  }): void {
    if (!this.config.enabled) return;

    const metric: Metric = {
      name,
      value,
      type,
      labels: context?.labels,
      timestamp: new Date(),
      unit: context?.unit,
      description: context?.description
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricList = this.metrics.get(name)!;
    metricList.push(metric);

    // Keep only last 1000 metrics per name
    if (metricList.length > 1000) {
      metricList.splice(0, metricList.length - 1000);
    }

    // Emit metric for real-time processing
    this.eventEmitter.emit('telemetry.metric', metric);

    // Send to provider
    this.sendMetric(metric);
  }

  trackError(error: Error, context?: {
    userId?: string;
    sessionId?: string;
    projectId?: string;
    stack?: string;
    metadata?: Record<string, any>;
  }): void {
    const errorData = {
      name: error.name,
      message: error.message,
      stack: error.stack || context?.stack,
      metadata: context?.metadata
    };

    this.trackEvent('error_occurred', errorData, {
      category: 'error',
      userId: context?.userId,
      sessionId: context?.sessionId,
      projectId: context?.projectId,
      metadata: context?.metadata
    });

    // Create alert for critical errors
    if (this.isCriticalError(error)) {
      this.createAlert({
        id: this.generateId('alert'),
        name: `Critical Error: ${error.name}`,
        severity: 'critical',
        type: 'error',
        message: error.message,
        source: 'system',
        timestamp: new Date(),
        metadata: {
          stack: error.stack,
          ...context?.metadata
        }
      });
    }
  }

  trackPerformance(operation: string, duration: number, context?: {
    labels?: Record<string, string>;
    metadata?: Record<string, any>;
  }): void {
    this.trackMetric(`${operation}_duration`, duration, 'timer', {
      labels: context?.labels,
      unit: 'milliseconds',
      description: `Duration of ${operation} operation`
    });

    // Track slow operations
    if (duration > this.config.thresholds.responseTime) {
      this.trackEvent('slow_operation', {
        operation,
        duration,
        threshold: this.config.thresholds.responseTime
      }, {
        category: 'performance',
        metadata: context?.metadata
      });
    }
  }

  trackApiCall(method: string, path: string, statusCode: number, duration: number, context?: {
    userId?: string;
    userAgent?: string;
    ip?: string;
    metadata?: Record<string, any>;
  }): void {
    this.trackEvent('api_call', {
      method,
      path,
      statusCode,
      duration,
      userAgent: context?.userAgent,
      ip: context?.ip
    }, {
      category: 'api_call',
      userId: context?.userId,
      metadata: context?.metadata
    });

    // Track response time metric
    this.trackMetric('api_response_time', duration, 'histogram', {
      labels: {
        method,
        path: path.split('/')[1] || 'root',
        status_code_family: Math.floor(statusCode / 100).toString()
      },
      unit: 'milliseconds'
    });

    // Track error rate
    if (statusCode >= 400) {
      this.trackMetric('api_error_rate', 1, 'counter', {
        labels: {
          method,
          path,
          status_code: statusCode.toString()
        }
      });
    }
  }

  trackTestExecution(testId: string, status: string, duration: number, context?: {
    userId?: string;
    projectId?: string;
    framework?: string;
    metadata?: Record<string, any>;
  }): void {
    this.trackEvent('test_executed', {
      testId,
      status,
      duration,
      framework: context?.framework
    }, {
      category: 'test_execution',
      userId: context?.userId,
      projectId: context?.projectId,
      metadata: context?.metadata
    });

    // Track test metrics
    this.trackMetric('test_duration', duration, 'histogram', {
      labels: {
        status,
        framework: context?.framework || 'unknown'
      },
      unit: 'milliseconds'
    });
  }

  trackRecordingSession(sessionId: string, type: string, action: string, context?: {
    userId?: string;
    projectId?: string;
    duration?: number;
    metadata?: Record<string, any>;
  }): void {
    this.trackEvent('recording_action', {
      sessionId,
      type,
      action,
      duration: context?.duration
    }, {
      category: 'recording',
      userId: context?.userId,
      projectId: context?.projectId,
      metadata: context?.metadata
    });
  }

  // Health checks
  registerHealthCheck(name: string, dependencies: string[]): void {
    const healthCheck: HealthCheck = {
      id: this.generateId('health'),
      name,
      status: 'healthy',
      timestamp: new Date(),
      dependencies
    };

    this.healthChecks.set(name, healthCheck);
  }

  updateHealthCheck(name: string, status: HealthCheck['status'], message?: string, metrics?: Metric[]): void {
    const healthCheck = this.healthChecks.get(name);
    if (healthCheck) {
      healthCheck.status = status;
      healthCheck.message = message;
      healthCheck.metrics = metrics;
      healthCheck.timestamp = new Date();

      this.eventEmitter.emit('health.check.updated', healthCheck);

      // Create alert for unhealthy services
      if (status === 'unhealthy') {
        this.createAlert({
          id: this.generateId('alert'),
          name: `Service Unhealthy: ${name}`,
          severity: 'error',
          type: 'health',
          message: message || `Service ${name} is unhealthy`,
          source: name,
          timestamp: new Date()
        });
      }
    }
  }

  // Alerts
  private createAlert(alert: Alert): void {
    if (!this.config.alerts.enabled) return;

    this.alerts.set(alert.id, alert);

    // Emit alert for real-time processing
    this.eventEmitter.emit('alert.created', alert);

    // Send to alert channels
    this.sendAlert(alert);
  }

  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  private checkAlerts(): void {
    if (!this.config.alerts.enabled) return;

    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      try {
        const shouldAlert = this.evaluateAlertRule(rule);
        if (shouldAlert) {
          this.createAlert({
            id: this.generateId('alert'),
            name: rule.name,
            severity: rule.severity,
            type: 'rule',
            message: `Alert rule triggered: ${rule.name}`,
            source: 'monitoring',
            timestamp: new Date(),
            metadata: { ruleId: rule.id }
          });
        }
      } catch (error) {
        console.error(`Error evaluating alert rule ${rule.name}:`, error);
      }
    }
  }

  private evaluateAlertRule(rule: AlertRule): boolean {
    // This is a simplified rule evaluator
    // In production, you'd want a more sophisticated rule engine
    switch (rule.condition) {
      case 'high_error_rate':
        return this.getErrorRate() > rule.threshold;
      case 'slow_response_time':
        return this.getAverageResponseTime() > rule.threshold;
      case 'high_cpu_usage':
        return this.getCpuUsage() > rule.threshold;
      case 'high_memory_usage':
        return this.getMemoryUsage() > rule.threshold;
      default:
        return false;
    }
  }

  // Metrics calculations
  private getErrorRate(): number {
    const recentEvents = this.events.filter(e =>
      e.category === 'error' &&
      Date.now() - e.timestamp.getTime() < 300000 // Last 5 minutes
    );
    const totalEvents = this.events.filter(e =>
      Date.now() - e.timestamp.getTime() < 300000
    );
    return totalEvents.length > 0 ? recentEvents.length / totalEvents.length : 0;
  }

  private getAverageResponseTime(): number {
    const responseTimeMetrics = this.metrics.get('api_response_time') || [];
    const recentMetrics = responseTimeMetrics.filter(m =>
      Date.now() - m.timestamp.getTime() < 300000 // Last 5 minutes
    );
    return recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length
      : 0;
  }

  private getCpuUsage(): number {
    // This would integrate with system monitoring
    // For now, return placeholder value
    return process.cpuUsage().user / 1000000; // Convert to percentage
  }

  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    const totalMemory = usage.heapTotal;
    const usedMemory = usage.heapUsed;
    return (usedMemory / totalMemory) * 100;
  }

  // System health checks
  private runHealthChecks(): void {
    for (const [name, healthCheck] of this.healthChecks) {
      this.runSingleHealthCheck(healthCheck);
    }
  }

  private async runSingleHealthCheck(healthCheck: HealthCheck): Promise<void> {
    const startTime = Date.now();

    try {
      // Check database connectivity
      const dbHealthy = await this.checkDatabaseHealth();

      // Check Redis connectivity
      const redisHealthy = await this.checkRedisHealth();

      // Check disk space
      const diskHealthy = this.checkDiskHealth();

      const allHealthy = dbHealthy && redisHealthy && diskHealthy;
      const status = allHealthy ? 'healthy' : 'unhealthy';
      const message = allHealthy ? 'All systems operational' : 'Some systems are degraded';

      this.updateHealthCheck(healthCheck.name, status, message, [
        {
          name: 'response_time',
          value: Date.now() - startTime,
          type: 'timer',
          timestamp: new Date(),
          unit: 'milliseconds'
        }
      ]);

    } catch (error) {
      this.updateHealthCheck(healthCheck.name, 'unhealthy', (error as Error).message);
    }
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      // This would integrate with your database service
      // For now, return true as placeholder
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      // This would integrate with your Redis service
      // For now, return true as placeholder
      return true;
    } catch {
      return false;
    }
  }

  private checkDiskHealth(): boolean {
    try {
      // This would check actual disk usage
      // For now, return true as placeholder
      return true;
    } catch {
      return false;
    }
  }

  // Data providers
  private sendEvent(event: TelemetryEvent): void {
    switch (this.config.providers.telemetry) {
      case 'mixpanel':
        this.sendToMixpanel(event);
        break;
      case 'amplitude':
        this.sendToAmplitude(event);
        break;
      case 'console':
      default:
        console.log('Telemetry Event:', event);
    }
  }

  private sendMetric(metric: Metric): void {
    switch (this.config.providers.telemetry) {
      case 'prometheus':
        this.sendToPrometheus(metric);
        break;
      case 'datadog':
        this.sendToDatadog(metric);
        break;
      case 'console':
      default:
        console.log('Metric:', metric);
    }
  }

  private sendAlert(alert: Alert): void {
    this.config.alerts.channels.forEach(channel => {
      switch (channel) {
        case 'slack':
          this.sendToSlack(alert);
          break;
        case 'email':
          this.sendToEmail(alert);
          break;
        case 'console':
        default:
          console.log('Alert:', alert);
      }
    });
  }

  // Provider integrations (simplified)
  private sendToMixpanel(event: TelemetryEvent): void {
    // Mixpanel integration would go here
  }

  private sendToAmplitude(event: TelemetryEvent): void {
    // Amplitude integration would go here
  }

  private sendToPrometheus(metric: Metric): void {
    // Prometheus integration would go here
  }

  private sendToDatadog(metric: Metric): void {
    // Datadog integration would go here
  }

  private sendToSlack(alert: Alert): void {
    // Slack integration would go here
  }

  private sendToEmail(alert: Alert): void {
    // Email integration would go here
  }

  // Utility methods
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeData(data: any): any {
    // Remove sensitive information from event data
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];

    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private isCriticalError(error: Error): boolean {
    const criticalPatterns = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'OutOfMemoryError',
      'UnhandledPromiseRejectionWarning'
    ];

    return criticalPatterns.some(pattern =>
      error.message.includes(pattern) || error.name.includes(pattern)
    );
  }

  private cleanupOldData(): void {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

    // Clean old events
    this.events = this.events.filter(event =>
      event.timestamp.getTime() > cutoffTime
    );

    // Clean old metrics
    for (const [name, metricList] of this.metrics) {
      const filteredMetrics = metricList.filter(metric =>
        metric.timestamp.getTime() > cutoffTime
      );
      this.metrics.set(name, filteredMetrics);
    }

    // Clean resolved alerts older than 7 days
    const alertCutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const [id, alert] of this.alerts) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt.getTime() < alertCutoffTime) {
        this.alerts.delete(id);
      }
    }
  }

  // Public API for data access
  public getEvents(filter?: {
    type?: string;
    category?: TelemetryCategory;
    userId?: string;
    projectId?: string;
    startTime?: Date;
    endTime?: Date;
  }): TelemetryEvent[] {
    let events = this.events;

    if (filter) {
      if (filter.type) {
        events = events.filter(e => e.type === filter.type);
      }
      if (filter.category) {
        events = events.filter(e => e.category === filter.category);
      }
      if (filter.userId) {
        events = events.filter(e => e.userId === filter.userId);
      }
      if (filter.projectId) {
        events = events.filter(e => e.projectId === filter.projectId);
      }
      if (filter.startTime) {
        events = events.filter(e => e.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        events = events.filter(e => e.timestamp <= filter.endTime!);
      }
    }

    return events;
  }

  public getMetrics(name?: string): Metric[] {
    if (name) {
      return this.metrics.get(name) || [];
    }

    const allMetrics: Metric[] = [];
    for (const metricList of this.metrics.values()) {
      allMetrics.push(...metricList);
    }
    return allMetrics;
  }

  public getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  public getAlerts(resolved?: boolean): Alert[] {
    const alerts = Array.from(this.alerts.values());
    return resolved !== undefined
      ? alerts.filter(alert => alert.resolved === resolved)
      : alerts;
  }

  // Event subscription
  public onEvent(callback: (event: TelemetryEvent) => void): void {
    this.eventEmitter.on('telemetry.event', callback);
  }

  public onMetric(callback: (metric: Metric) => void): void {
    this.eventEmitter.on('telemetry.metric', callback);
  }

  public onAlert(callback: (alert: Alert) => void): void {
    this.eventEmitter.on('alert.created', callback);
  }

  public onHealthCheckUpdate(callback: (healthCheck: HealthCheck) => void): void {
    this.eventEmitter.on('health.check.updated', callback);
  }
}

// Export singleton instance
export const telemetry = TelemetryService.getInstance();

// Export convenience functions
export const trackEvent = (type: string, data: any, context?: any) =>
  telemetry.trackEvent(type, data, context);

export const trackMetric = (name: string, value: number, type?: Metric['type'], context?: any) =>
  telemetry.trackMetric(name, value, type, context);

export const trackError = (error: Error, context?: any) =>
  telemetry.trackError(error, context);

export const trackPerformance = (operation: string, duration: number, context?: any) =>
  telemetry.trackPerformance(operation, duration, context);

export const trackApiCall = (method: string, path: string, statusCode: number, duration: number, context?: any) =>
  telemetry.trackApiCall(method, path, statusCode, duration, context);

export default telemetry;