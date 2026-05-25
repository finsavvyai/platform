import { BaseConnectionObserver } from './ConnectionObserver';
import { Connection, ConnectionHealth } from '../entities/Connection';
import { Query, QueryResult } from '../entities/Query';

/**
 * Metrics Observer
 * Collects and aggregates metrics from connection events
 */
export class MetricsObserver extends BaseConnectionObserver {
  private metrics: ConnectionMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    failedConnections: 0,
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    slowQueries: 0,
    avgResponseTime: 0,
    avgQueryTime: 0,
    connectionUptime: new Map(),
    queryCountByConnection: new Map(),
    errorCountByConnection: new Map(),
    lastActivity: new Map(),
    hourlyStats: new Map(),
    dailyStats: new Map()
  };

  private responseTimes: number[] = [];
  private queryTimes: number[] = [];
  private maxResponseTimeHistory = 100;
  private maxQueryTimeHistory = 1000;

  // Connection lifecycle
  onConnectionCreated(connection: Connection): void {
    this.metrics.totalConnections++;
    this.metrics.connectionUptime.set(connection.id, Date.now());
    this.metrics.lastActivity.set(connection.id, Date.now());
    this.updateHourlyStats('connections_created');
  }

  onConnectionConnected(connectionId: string): void {
    this.metrics.activeConnections++;
    this.metrics.lastActivity.set(connectionId, Date.now());
  }

  onConnectionDisconnected(connectionId: string): void {
    this.metrics.activeConnections--;
    this.metrics.connectionUptime.delete(connectionId);
    this.metrics.lastActivity.delete(connectionId);
  }

  onConnectionFailed(connectionId: string, error: Error): void {
    this.metrics.failedConnections++;
    const currentCount = this.metrics.errorCountByConnection.get(connectionId) || 0;
    this.metrics.errorCountByConnection.set(connectionId, currentCount + 1);
    this.updateHourlyStats('connection_failures');
  }

  // Health monitoring
  onHealthCheck(connectionId: string, health: ConnectionHealth): void {
    this.metrics.lastActivity.set(connectionId, Date.now());

    if (health.responseTime) {
      this.recordResponseTime(health.responseTime);
    }

    if (!health.isHealthy()) {
      const currentCount = this.metrics.errorCountByConnection.get(connectionId) || 0;
      this.metrics.errorCountByConnection.set(connectionId, currentCount + 1);
    }
  }

  onConnectionSlow(connectionId: string, responseTime: number): void {
    this.recordResponseTime(responseTime);
    this.updateHourlyStats('slow_connections');
  }

  onConnectionUnstable(connectionId: string, failures: number): void {
    this.metrics.errorCountByConnection.set(connectionId, failures);
    this.updateHourlyStats('unstable_connections');
  }

  // Query monitoring
  onQueryStarted(connectionId: string, query: Query): void {
    this.metrics.totalQueries++;
    this.metrics.lastActivity.set(connectionId, Date.now());

    const currentCount = this.metrics.queryCountByConnection.get(connectionId) || 0;
    this.metrics.queryCountByConnection.set(connectionId, currentCount + 1);
  }

  onQueryCompleted(connectionId: string, query: Query, result: QueryResult): void {
    if (result.success) {
      this.metrics.successfulQueries++;
    } else {
      this.metrics.failedQueries++;
      const currentCount = this.metrics.errorCountByConnection.get(connectionId) || 0;
      this.metrics.errorCountByConnection.set(connectionId, currentCount + 1);
    }

    if (result.executionTime) {
      this.recordQueryTime(result.executionTime);
    }

    this.updateHourlyStats('queries_completed');
  }

  onQueryFailed(connectionId: string, query: Query, error: Error): void {
    this.metrics.failedQueries++;
    const currentCount = this.metrics.errorCountByConnection.get(connectionId) || 0;
    this.metrics.errorCountByConnection.set(connectionId, currentCount + 1);
    this.updateHourlyStats('query_failures');
  }

  onSlowQuery(connectionId: string, query: Query, executionTime: number): void {
    this.metrics.slowQueries++;
    this.recordQueryTime(executionTime);
    this.updateHourlyStats('slow_queries');
  }

  onQueryTimeout(connectionId: string, query: Query): void {
    this.metrics.failedQueries++;
    this.updateHourlyStats('query_timeouts');
  }

  // Pool monitoring
  onConnectionPoolCreated(connectionId: string, poolSize: number): void {
    this.updateHourlyStats('pools_created');
  }

  onConnectionPoolExhausted(connectionId: string): void {
    this.updateHourlyStats('pools_exhausted');
  }

  // Security events
  onUnauthorizedAccessAttempt(connectionId: string, details: any): void {
    this.updateHourlyStats('unauthorized_attempts');
  }

  onSuspiciousActivity(connectionId: string, activity: any): void {
    this.updateHourlyStats('suspicious_activities');
  }

  // Public methods to retrieve metrics
  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  getMetricsForConnection(connectionId: string): ConnectionConnectionMetrics {
    return {
      connectionId,
      queryCount: this.metrics.queryCountByConnection.get(connectionId) || 0,
      errorCount: this.metrics.errorCountByConnection.get(connectionId) || 0,
      uptime: this.calculateUptime(connectionId),
      lastActivity: this.metrics.lastActivity.get(connectionId) || null,
      avgQueryTime: this.getAverageQueryTimeForConnection(connectionId),
      successRate: this.calculateSuccessRate(connectionId)
    };
  }

  getTopConnectionsByQueryCount(limit: number = 10): ConnectionQueryRanking[] {
    const rankings: ConnectionQueryRanking[] = [];

    for (const [connectionId, queryCount] of this.metrics.queryCountByConnection) {
      rankings.push({
        connectionId,
        queryCount,
        errorCount: this.metrics.errorCountByConnection.get(connectionId) || 0,
        successRate: this.calculateSuccessRate(connectionId)
      });
    }

    return rankings
      .sort((a, b) => b.queryCount - a.queryCount)
      .slice(0, limit);
  }

  getHourlyStats(hours: number = 24): HourlyMetrics[] {
    const stats: HourlyMetrics[] = [];
    const now = new Date();

    for (let i = hours - 1; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourKey = this.getHourKey(hour);
      const hourStats = this.metrics.hourlyStats.get(hourKey) || this.createEmptyHourStats();

      stats.push({
        hour,
        ...hourStats
      });
    }

    return stats;
  }

  getDailyStats(days: number = 30): DailyMetrics[] {
    const stats: DailyMetrics[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayKey = this.getDayKey(day);
      const dayStats = this.metrics.dailyStats.get(dayKey) || this.createEmptyDayStats();

      stats.push({
        day,
        ...dayStats
      });
    }

    return stats;
  }

  reset(): void {
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      failedConnections: 0,
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      slowQueries: 0,
      avgResponseTime: 0,
      avgQueryTime: 0,
      connectionUptime: new Map(),
      queryCountByConnection: new Map(),
      errorCountByConnection: new Map(),
      lastActivity: new Map(),
      hourlyStats: new Map(),
      dailyStats: new Map()
    };
    this.responseTimes = [];
    this.queryTimes = [];
  }

  // Private helper methods
  private recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }
    this.metrics.avgResponseTime = this.calculateAverage(this.responseTimes);
  }

  private recordQueryTime(time: number): void {
    this.queryTimes.push(time);
    if (this.queryTimes.length > this.maxQueryTimeHistory) {
      this.queryTimes.shift();
    }
    this.metrics.avgQueryTime = this.calculateAverage(this.queryTimes);
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  private calculateUptime(connectionId: string): number {
    const startTime = this.metrics.connectionUptime.get(connectionId);
    if (!startTime) return 0;
    return Date.now() - startTime;
  }

  private calculateSuccessRate(connectionId: string): number {
    const queryCount = this.metrics.queryCountByConnection.get(connectionId) || 0;
    const errorCount = this.metrics.errorCountByConnection.get(connectionId) || 0;
    if (queryCount === 0) return 100;
    return ((queryCount - errorCount) / queryCount) * 100;
  }

  private getAverageQueryTimeForConnection(connectionId: string): number {
    // This would require tracking per-connection query times
    // For now, return the global average
    return this.metrics.avgQueryTime;
  }

  private updateHourlyStats(metric: string): void {
    const hourKey = this.getHourKey(new Date());
    let stats = this.metrics.hourlyStats.get(hourKey);

    if (!stats) {
      stats = this.createEmptyHourStats();
      this.metrics.hourlyStats.set(hourKey, stats);
    }

    (stats as any)[metric] = ((stats as any)[metric] || 0) + 1;
  }

  private updateDailyStats(metric: string): void {
    const dayKey = this.getDayKey(new Date());
    let stats = this.metrics.dailyStats.get(dayKey);

    if (!stats) {
      stats = this.createEmptyDayStats();
      this.metrics.dailyStats.set(dayKey, stats);
    }

    (stats as any)[metric] = ((stats as any)[metric] || 0) + 1;
  }

  private getHourKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    return `${year}-${month}-${day}-${hour}`;
  }

  private getDayKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private createEmptyHourStats(): any {
    return {
      connections_created: 0,
      connection_failures: 0,
      slow_connections: 0,
      unstable_connections: 0,
      queries_completed: 0,
      query_failures: 0,
      slow_queries: 0,
      query_timeouts: 0,
      pools_created: 0,
      pools_exhausted: 0,
      unauthorized_attempts: 0,
      suspicious_activities: 0
    };
  }

  private createEmptyDayStats(): any {
    return this.createEmptyHourStats();
  }
}

// Type definitions for metrics
export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  failedConnections: number;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  slowQueries: number;
  avgResponseTime: number;
  avgQueryTime: number;
  connectionUptime: Map<string, number>;
  queryCountByConnection: Map<string, number>;
  errorCountByConnection: Map<string, number>;
  lastActivity: Map<string, number>;
  hourlyStats: Map<string, any>;
  dailyStats: Map<string, any>;
}

export interface ConnectionConnectionMetrics {
  connectionId: string;
  queryCount: number;
  errorCount: number;
  uptime: number;
  lastActivity: number | null;
  avgQueryTime: number;
  successRate: number;
}

export interface ConnectionQueryRanking {
  connectionId: string;
  queryCount: number;
  errorCount: number;
  successRate: number;
}

export interface HourlyMetrics {
  hour: Date;
  connections_created: number;
  connection_failures: number;
  slow_connections: number;
  unstable_connections: number;
  queries_completed: number;
  query_failures: number;
  slow_queries: number;
  query_timeouts: number;
  pools_created: number;
  pools_exhausted: number;
  unauthorized_attempts: number;
  suspicious_activities: number;
}

export interface DailyMetrics {
  day: Date;
  connections_created: number;
  connection_failures: number;
  slow_connections: number;
  unstable_connections: number;
  queries_completed: number;
  query_failures: number;
  slow_queries: number;
  query_timeouts: number;
  pools_created: number;
  pools_exhausted: number;
  unauthorized_attempts: number;
  suspicious_activities: number;
}
