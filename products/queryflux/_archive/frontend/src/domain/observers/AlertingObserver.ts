import { BaseConnectionObserver } from './ConnectionObserver';
import { Connection, ConnectionHealth } from '../entities/Connection';
import { Query, QueryResult } from '../entities/Query';

/**
 * Alerting Observer
 * Monitors connection events and triggers alerts based on configured rules
 */
export class AlertingObserver extends BaseConnectionObserver {
  private alertRules: AlertRule[] = [];
  private alertHistory: Alert[] = [];
  private alertCooldowns = new Map<string, number>();
  private alertHandlers: Map<AlertType, AlertHandler[]> = new Map();
  private defaultHandlers: AlertHandler[] = [];

  constructor() {
    super();
    this.initializeDefaultRules();
    this.initializeDefaultHandlers();
  }

  // Configuration methods
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
  }

  removeAlertRule(ruleId: string): void {
    this.alertRules = this.alertRules.filter(r => r.id !== ruleId);
  }

  addAlertHandler(type: AlertType, handler: AlertHandler): void {
    if (!this.alertHandlers.has(type)) {
      this.alertHandlers.set(type, []);
    }
    this.alertHandlers.get(type)!.push(handler);
  }

  addDefaultHandler(handler: AlertHandler): void {
    this.defaultHandlers.push(handler);
  }

  // Event handlers
  onConnectionFailed(connectionId: string, error: Error): void {
    this.evaluateRules('connection.failed', {
      connectionId,
      error,
      timestamp: new Date()
    });
  }

  onConnectionSlow(connectionId: string, responseTime: number): void {
    this.evaluateRules('connection.slow', {
      connectionId,
      responseTime,
      timestamp: new Date()
    });
  }

  onConnectionUnstable(connectionId: string, failures: number): void {
    this.evaluateRules('connection.unstable', {
      connectionId,
      failures,
      timestamp: new Date()
    });
  }

  onQueryFailed(connectionId: string, query: Query, error: Error): void {
    this.evaluateRules('query.failed', {
      connectionId,
      query,
      error,
      timestamp: new Date()
    });
  }

  onSlowQuery(connectionId: string, query: Query, executionTime: number): void {
    this.evaluateRules('query.slow', {
      connectionId,
      query,
      executionTime,
      timestamp: new Date()
    });
  }

  onQueryTimeout(connectionId: string, query: Query): void {
    this.evaluateRules('query.timeout', {
      connectionId,
      query,
      timestamp: new Date()
    });
  }

  onConnectionPoolExhausted(connectionId: string): void {
    this.evaluateRules('pool.exhausted', {
      connectionId,
      timestamp: new Date()
    });
  }

  onUnauthorizedAccessAttempt(connectionId: string, details: any): void {
    this.evaluateRules('security.unauthorized', {
      connectionId,
      details,
      timestamp: new Date()
    });
  }

  onSuspiciousActivity(connectionId: string, activity: any): void {
    this.evaluateRules('security.suspicious', {
      connectionId,
      activity,
      timestamp: new Date()
    });
  }

  // Public methods
  getAlerts(filter?: AlertFilter): Alert[] {
    let alerts = [...this.alertHistory];

    if (filter) {
      if (filter.type) {
        alerts = alerts.filter(a => a.type === filter.type);
      }
      if (filter.severity) {
        alerts = alerts.filter(a => a.severity === filter.severity);
      }
      if (filter.connectionId) {
        alerts = alerts.filter(a => a.context.connectionId === filter.connectionId);
      }
      if (filter.dateFrom) {
        alerts = alerts.filter(a => a.timestamp >= filter.dateFrom!);
      }
      if (filter.dateTo) {
        alerts = alerts.filter(a => a.timestamp <= filter.dateTo!);
      }
      if (filter.status) {
        alerts = alerts.filter(a => a.status === filter.status);
      }
      if (filter.limit) {
        alerts = alerts.slice(0, filter.limit);
      }
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert && alert.status === AlertStatus.OPEN) {
      alert.status = AlertStatus.ACKNOWLEDGED;
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = acknowledgedBy;
    }
  }

  resolveAlert(alertId: string, resolvedBy: string, resolution?: string): void {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert && (alert.status === AlertStatus.OPEN || alert.status === AlertStatus.ACKNOWLEDGED)) {
      alert.status = AlertStatus.RESOLVED;
      alert.resolvedAt = new Date();
      alert.resolvedBy = resolvedBy;
      alert.resolution = resolution;
    }
  }

  getAlertStatistics(): AlertStatistics {
    const stats: AlertStatistics = {
      total: this.alertHistory.length,
      byType: {} as Record<AlertType, number>,
      bySeverity: {} as Record<AlertSeverity, number>,
      byStatus: {
        [AlertStatus.OPEN]: 0,
        [AlertStatus.ACKNOWLEDGED]: 0,
        [AlertStatus.RESOLVED]: 0,
        [AlertStatus.SUPPRESSED]: 0
      },
      last24Hours: 0,
      last7Days: 0,
      last30Days: 0
    };

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const alert of this.alertHistory) {
      // Count by type
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;

      // Count by severity
      stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;

      // Count by status
      stats.byStatus[alert.status]++;

      // Count by time period
      if (alert.timestamp >= oneDayAgo) stats.last24Hours++;
      if (alert.timestamp >= sevenDaysAgo) stats.last7Days++;
      if (alert.timestamp >= thirtyDaysAgo) stats.last30Days++;
    }

    return stats;
  }

  // Private methods
  private evaluateRules(eventType: string, context: any): void {
    for (const rule of this.alertRules) {
      if (rule.eventType === eventType && this.evaluateCondition(rule.condition, context)) {
        this.triggerAlert(rule, context);
      }
    }
  }

  private evaluateCondition(condition: AlertCondition, context: any): boolean {
    switch (condition.operator) {
      case 'greater_than':
        return this.extractValue(condition.field, context) > condition.value;
      case 'less_than':
        return this.extractValue(condition.field, context) < condition.value;
      case 'equals':
        return this.extractValue(condition.field, context) === condition.value;
      case 'not_equals':
        return this.extractValue(condition.field, context) !== condition.value;
      case 'contains':
        return String(this.extractValue(condition.field, context)).includes(condition.value);
      case 'matches':
        return new RegExp(condition.value).test(String(this.extractValue(condition.field, context)));
      default:
        return false;
    }
  }

  private extractValue(field: string, context: any): any {
    return field.split('.').reduce((obj, key) => obj?.[key], context);
  }

  private triggerAlert(rule: AlertRule, context: any): void {
    const alertKey = `${rule.id}-${context.connectionId || 'global'}`;

    // Check cooldown
    const lastAlertTime = this.alertCooldowns.get(alertKey) || 0;
    if (Date.now() - lastAlertTime < (rule.cooldownMinutes * 60 * 1000)) {
      return;
    }

    const alert: Alert = {
      id: this.generateAlertId(),
      ruleId: rule.id,
      type: rule.alertType,
      severity: rule.severity,
      title: this.generateAlertTitle(rule, context),
      message: this.generateAlertMessage(rule, context),
      context,
      timestamp: new Date(),
      status: AlertStatus.OPEN
    };

    this.alertHistory.push(alert);
    this.alertCooldowns.set(alertKey, Date.now());

    // Trigger handlers
    this.triggerHandlers(alert);
  }

  private triggerHandlers(alert: Alert): void {
    const handlers = [
      ...(this.alertHandlers.get(alert.type) || []),
      ...this.defaultHandlers
    ];

    for (const handler of handlers) {
      try {
        handler.handle(alert);
      } catch (error) {
        console.error('Error in alert handler:', error);
      }
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertTitle(rule: AlertRule, context: any): string {
    const templates: Record<string, string> = {
      'connection.failed': 'Connection Failed',
      'connection.slow': 'Slow Connection',
      'connection.unstable': 'Unstable Connection',
      'query.failed': 'Query Failed',
      'query.slow': 'Slow Query Detected',
      'query.timeout': 'Query Timeout',
      'pool.exhausted': 'Connection Pool Exhausted',
      'security.unauthorized': 'Unauthorized Access Attempt',
      'security.suspicious': 'Suspicious Activity Detected'
    };

    return templates[rule.alertType] || 'Alert';
  }

  private generateAlertMessage(rule: AlertRule, context: any): string {
    const templates: Record<string, (context: any) => string> = {
      'connection.failed': (c) => `Connection ${c.connectionId} failed: ${c.error?.message}`,
      'connection.slow': (c) => `Connection ${c.connectionId} is slow (${c.responseTime}ms)`,
      'connection.unstable': (c) => `Connection ${c.connectionId} is unstable (${c.failures} failures)`,
      'query.failed': (c) => `Query failed on ${c.connectionId}: ${c.error?.message}`,
      'query.slow': (c) => `Slow query on ${c.connectionId} (${c.executionTime}ms): ${c.query?.sql?.substring(0, 100)}...`,
      'query.timeout': (c) => `Query timeout on ${c.connectionId}`,
      'pool.exhausted': (c) => `Connection pool exhausted for ${c.connectionId}`,
      'security.unauthorized': (c) => `Unauthorized access attempt on ${c.connectionId}`,
      'security.suspicious': (c) => `Suspicious activity detected on ${c.connectionId}`
    };

    const template = templates[rule.alertType];
    return template ? template(context) : `Alert triggered for ${rule.alertType}`;
  }

  private initializeDefaultRules(): void {
    this.addAlertRule({
      id: 'connection-failure',
      eventType: 'connection.failed',
      condition: { field: 'error', operator: 'exists', value: true },
      alertType: AlertType.CONNECTION_FAILED,
      severity: AlertSeverity.CRITICAL,
      cooldownMinutes: 5,
      enabled: true
    });

    this.addAlertRule({
      id: 'slow-connection',
      eventType: 'connection.slow',
      condition: { field: 'responseTime', operator: 'greater_than', value: 5000 },
      alertType: AlertType.SLOW_CONNECTION,
      severity: AlertSeverity.WARNING,
      cooldownMinutes: 10,
      enabled: true
    });

    this.addAlertRule({
      id: 'unstable-connection',
      eventType: 'connection.unstable',
      condition: { field: 'failures', operator: 'greater_than', value: 3 },
      alertType: AlertType.UNSTABLE_CONNECTION,
      severity: AlertSeverity.ERROR,
      cooldownMinutes: 15,
      enabled: true
    });

    this.addAlertRule({
      id: 'slow-query',
      eventType: 'query.slow',
      condition: { field: 'executionTime', operator: 'greater_than', value: 30000 },
      alertType: AlertType.SLOW_QUERY,
      severity: AlertSeverity.WARNING,
      cooldownMinutes: 5,
      enabled: true
    });

    this.addAlertRule({
      id: 'query-timeout',
      eventType: 'query.timeout',
      condition: { field: 'query', operator: 'exists', value: true },
      alertType: AlertType.QUERY_TIMEOUT,
      severity: AlertSeverity.ERROR,
      cooldownMinutes: 5,
      enabled: true
    });

    this.addAlertRule({
      id: 'unauthorized-access',
      eventType: 'security.unauthorized',
      condition: { field: 'details', operator: 'exists', value: true },
      alertType: AlertType.UNAUTHORIZED_ACCESS,
      severity: AlertSeverity.CRITICAL,
      cooldownMinutes: 1,
      enabled: true
    });
  }

  private initializeDefaultHandlers(): void {
    // Console logging handler
    this.addDefaultHandler({
      handle: (alert) => {
        console.log(`[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`);
      }
    });

    // Could add more handlers: email, Slack, webhook, etc.
  }
}

// Type definitions
export interface AlertRule {
  id: string;
  eventType: string;
  condition: AlertCondition;
  alertType: AlertType;
  severity: AlertSeverity;
  cooldownMinutes: number;
  enabled: boolean;
  description?: string;
}

export interface AlertCondition {
  field: string;
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals' | 'contains' | 'matches' | 'exists';
  value: any;
}

export enum AlertType {
  CONNECTION_FAILED = 'connection.failed',
  SLOW_CONNECTION = 'connection.slow',
  UNSTABLE_CONNECTION = 'connection.unstable',
  QUERY_FAILED = 'query.failed',
  SLOW_QUERY = 'query.slow',
  QUERY_TIMEOUT = 'query.timeout',
  POOL_EXHAUSTED = 'pool.exhausted',
  UNAUTHORIZED_ACCESS = 'security.unauthorized',
  SUSPICIOUS_ACTIVITY = 'security.suspicious',
  HIGH_ERROR_RATE = 'metrics.high_error_rate',
  LOW_CONNECTION_COUNT = 'metrics.low_connection_count'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum AlertStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed'
}

export interface Alert {
  id: string;
  ruleId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  context: any;
  timestamp: Date;
  status: AlertStatus;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
}

export interface AlertHandler {
  handle(alert: Alert): void;
}

export interface AlertFilter {
  type?: AlertType;
  severity?: AlertSeverity;
  status?: AlertStatus;
  connectionId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}

export interface AlertStatistics {
  total: number;
  byType: Record<AlertType, number>;
  bySeverity: Record<AlertSeverity, number>;
  byStatus: Record<AlertStatus, number>;
  last24Hours: number;
  last7Days: number;
  last30Days: number;
}
