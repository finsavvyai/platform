/**
 * Observer Pattern: Connection Observer
 * Monitors database connections and notifies subscribers of events
 */

import { Connection, ConnectionHealth } from '../entities/Connection';
import { Query, QueryResult } from '../entities/Query';

/**
 * Observer interface for connection events
 */
export interface IConnectionObserver {
  // Connection lifecycle events
  onConnectionCreated(connection: Connection): void;
  onConnectionUpdated(connection: Connection): void;
  onConnectionDeleted(connectionId: string): void;
  onConnectionConnected(connectionId: string): void;
  onConnectionDisconnected(connectionId: string): void;
  onConnectionFailed(connectionId: string, error: Error): void;

  // Health monitoring events
  onHealthCheck(connectionId: string, health: ConnectionHealth): void;
  onConnectionSlow(connectionId: string, responseTime: number): void;
  onConnectionUnstable(connectionId: string, failures: number): void;
  onConnectionRecovered(connectionId: string): void;

  // Query execution events
  onQueryStarted(connectionId: string, query: Query): void;
  onQueryCompleted(connectionId: string, query: Query, result: QueryResult): void;
  onQueryFailed(connectionId: string, query: Query, error: Error): void;
  onSlowQuery(connectionId: string, query: Query, executionTime: number): void;
  onQueryTimeout(connectionId: string, query: Query): void;

  // Resource monitoring events
  onConnectionPoolCreated(connectionId: string, poolSize: number): void;
  onConnectionAcquired(connectionId: string, poolSize: number, activeConnections: number): void;
  onConnectionReleased(connectionId: string, poolSize: number, activeConnections: number): void;
  onConnectionPoolExhausted(connectionId: string): void;

  // Security events
  onUnauthorizedAccessAttempt(connectionId: string, details: any): void;
  onSuspiciousActivity(connectionId: string, activity: any): void;

  // Configuration events
  onConfigurationChanged(connectionId: string, oldConfig: any, newConfig: any): void;
  onCredentialsRotated(connectionId: string): void;
}

/**
 * Subject interface for connection monitoring
 */
export interface IConnectionSubject {
  attach(observer: IConnectionObserver): void;
  detach(observer: IConnectionObserver): void;
  notify(event: ConnectionEvent): void;
}

/**
 * Connection event types
 */
export type ConnectionEvent =
  | ConnectionCreatedEvent
  | ConnectionUpdatedEvent
  | ConnectionDeletedEvent
  | ConnectionConnectedEvent
  | ConnectionDisconnectedEvent
  | ConnectionFailedEvent
  | HealthCheckEvent
  | ConnectionSlowEvent
  | ConnectionUnstableEvent
  | ConnectionRecoveredEvent
  | QueryStartedEvent
  | QueryCompletedEvent
  | QueryFailedEvent
  | SlowQueryEvent
  | QueryTimeoutEvent
  | ConnectionPoolCreatedEvent
  | ConnectionAcquiredEvent
  | ConnectionReleasedEvent
  | ConnectionPoolExhaustedEvent
  | UnauthorizedAccessEvent
  | SuspiciousActivityEvent
  | ConfigurationChangedEvent
  | CredentialsRotatedEvent;

// Event interfaces
export interface ConnectionCreatedEvent {
  type: 'connection.created';
  data: { connection: Connection };
  timestamp: Date;
}

export interface ConnectionUpdatedEvent {
  type: 'connection.updated';
  data: { connection: Connection };
  timestamp: Date;
}

export interface ConnectionDeletedEvent {
  type: 'connection.deleted';
  data: { connectionId: string };
  timestamp: Date;
}

export interface ConnectionConnectedEvent {
  type: 'connection.connected';
  data: { connectionId: string; serverVersion?: string };
  timestamp: Date;
}

export interface ConnectionDisconnectedEvent {
  type: 'connection.disconnected';
  data: { connectionId: string; reason?: string };
  timestamp: Date;
}

export interface ConnectionFailedEvent {
  type: 'connection.failed';
  data: { connectionId: string; error: Error };
  timestamp: Date;
}

export interface HealthCheckEvent {
  type: 'connection.health';
  data: { connectionId: string; health: ConnectionHealth };
  timestamp: Date;
}

export interface ConnectionSlowEvent {
  type: 'connection.slow';
  data: { connectionId: string; responseTime: number; threshold: number };
  timestamp: Date;
}

export interface ConnectionUnstableEvent {
  type: 'connection.unstable';
  data: { connectionId: string; failures: number; threshold: number };
  timestamp: Date;
}

export interface ConnectionRecoveredEvent {
  type: 'connection.recovered';
  data: { connectionId: string };
  timestamp: Date;
}

export interface QueryStartedEvent {
  type: 'query.started';
  data: { connectionId: string; query: Query };
  timestamp: Date;
}

export interface QueryCompletedEvent {
  type: 'query.completed';
  data: { connectionId: string; query: Query; result: QueryResult };
  timestamp: Date;
}

export interface QueryFailedEvent {
  type: 'query.failed';
  data: { connectionId: string; query: Query; error: Error };
  timestamp: Date;
}

export interface SlowQueryEvent {
  type: 'query.slow';
  data: { connectionId: string; query: Query; executionTime: number; threshold: number };
  timestamp: Date;
}

export interface QueryTimeoutEvent {
  type: 'query.timeout';
  data: { connectionId: string; query: Query; timeout: number };
  timestamp: Date;
}

export interface ConnectionPoolCreatedEvent {
  type: 'pool.created';
  data: { connectionId: string; poolSize: number };
  timestamp: Date;
}

export interface ConnectionAcquiredEvent {
  type: 'pool.acquired';
  data: { connectionId: string; poolSize: number; activeConnections: number };
  timestamp: Date;
}

export interface ConnectionReleasedEvent {
  type: 'pool.released';
  data: { connectionId: string; poolSize: number; activeConnections: number };
  timestamp: Date;
}

export interface ConnectionPoolExhaustedEvent {
  type: 'pool.exhausted';
  data: { connectionId: string; waitingCount: number };
  timestamp: Date;
}

export interface UnauthorizedAccessEvent {
  type: 'security.unauthorized';
  data: { connectionId: string; details: any };
  timestamp: Date;
}

export interface SuspiciousActivityEvent {
  type: 'security.suspicious';
  data: { connectionId: string; activity: any };
  timestamp: Date;
}

export interface ConfigurationChangedEvent {
  type: 'config.changed';
  data: { connectionId: string; oldConfig: any; newConfig: any };
  timestamp: Date;
}

export interface CredentialsRotatedEvent {
  type: 'security.credentials_rotated';
  data: { connectionId: string; rotatedAt: Date };
  timestamp: Date;
}

/**
 * Concrete implementation of connection subject
 */
export class ConnectionMonitor implements IConnectionSubject {
  private observers: Set<IConnectionObserver> = new Set();
  private eventHistory: ConnectionEvent[] = [];
  private maxHistorySize = 1000;
  private eventBuffer: ConnectionEvent[] = [];
  private bufferFlushInterval = 1000; // 1 second
  private bufferTimer?: NodeJS.Timeout;

  constructor() {
    this.startBufferTimer();
  }

  attach(observer: IConnectionObserver): void {
    this.observers.add(observer);
  }

  detach(observer: IConnectionObserver): void {
    this.observers.delete(observer);
  }

  notify(event: ConnectionEvent): void {
    // Add to buffer for batch processing
    this.eventBuffer.push(event);
  }

  private startBufferTimer(): void {
    this.bufferTimer = setInterval(() => {
      this.flushBuffer();
    }, this.bufferFlushInterval);
  }

  private flushBuffer(): void {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    // Add to history
    this.eventHistory.push(...events);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }

    // Notify observers
    for (const event of events) {
      this.notifyObservers(event);
    }
  }

  private notifyObservers(event: ConnectionEvent): void {
    for (const observer of this.observers) {
      try {
        this.dispatchToObserver(observer, event);
      } catch (error) {
        console.error('Error notifying observer:', error);
      }
    }
  }

  private dispatchToObserver(observer: IConnectionObserver, event: ConnectionEvent): void {
    switch (event.type) {
      case 'connection.created':
        observer.onConnectionCreated(event.data.connection);
        break;
      case 'connection.updated':
        observer.onConnectionUpdated(event.data.connection);
        break;
      case 'connection.deleted':
        observer.onConnectionDeleted(event.data.connectionId);
        break;
      case 'connection.connected':
        observer.onConnectionConnected(event.data.connectionId);
        break;
      case 'connection.disconnected':
        observer.onConnectionDisconnected(event.data.connectionId);
        break;
      case 'connection.failed':
        observer.onConnectionFailed(event.data.connectionId, event.data.error);
        break;
      case 'connection.health':
        observer.onHealthCheck(event.data.connectionId, event.data.health);
        break;
      case 'connection.slow':
        observer.onConnectionSlow(event.data.connectionId, event.data.responseTime);
        break;
      case 'connection.unstable':
        observer.onConnectionUnstable(event.data.connectionId, event.data.failures);
        break;
      case 'connection.recovered':
        observer.onConnectionRecovered(event.data.connectionId);
        break;
      case 'query.started':
        observer.onQueryStarted(event.data.connectionId, event.data.query);
        break;
      case 'query.completed':
        observer.onQueryCompleted(event.data.connectionId, event.data.query, event.data.result);
        break;
      case 'query.failed':
        observer.onQueryFailed(event.data.connectionId, event.data.query, event.data.error);
        break;
      case 'query.slow':
        observer.onSlowQuery(event.data.connectionId, event.data.query, event.data.executionTime);
        break;
      case 'query.timeout':
        observer.onQueryTimeout(event.data.connectionId, event.data.query);
        break;
      case 'pool.created':
        observer.onConnectionPoolCreated(event.data.connectionId, event.data.poolSize);
        break;
      case 'pool.acquired':
        observer.onConnectionAcquired(event.data.connectionId, event.data.poolSize, event.data.activeConnections);
        break;
      case 'pool.released':
        observer.onConnectionReleased(event.data.connectionId, event.data.poolSize, event.data.activeConnections);
        break;
      case 'pool.exhausted':
        observer.onConnectionPoolExhausted(event.data.connectionId);
        break;
      case 'security.unauthorized':
        observer.onUnauthorizedAccessAttempt(event.data.connectionId, event.data.details);
        break;
      case 'security.suspicious':
        observer.onSuspiciousActivity(event.data.connectionId, event.data.activity);
        break;
      case 'config.changed':
        observer.onConfigurationChanged(event.data.connectionId, event.data.oldConfig, event.data.newConfig);
        break;
      case 'security.credentials_rotated':
        observer.onCredentialsRotated(event.data.connectionId);
        break;
    }
  }

  /**
   * Get event history with optional filtering
   */
  getEventHistory(filter?: EventFilter): ConnectionEvent[] {
    let events = [...this.eventHistory];

    if (filter) {
      if (filter.connectionId) {
        events = events.filter(e =>
          'connectionId' in e.data && e.data.connectionId === filter.connectionId
        );
      }
      if (filter.eventType) {
        events = events.filter(e => e.type === filter.eventType);
      }
      if (filter.dateFrom) {
        events = events.filter(e => e.timestamp >= filter.dateFrom!);
      }
      if (filter.dateTo) {
        events = events.filter(e => e.timestamp <= filter.dateTo!);
      }
      if (filter.limit) {
        events = events.slice(-filter.limit);
      }
    }

    return events.reverse(); // Most recent first
  }

  /**
   * Get statistics about events
   */
  getEventStatistics(connectionId?: string): EventStatistics {
    const events = connectionId
      ? this.eventHistory.filter(e => 'connectionId' in e.data && e.data.connectionId === connectionId)
      : this.eventHistory;

    const stats: EventStatistics = {
      total: events.length,
      byType: {} as Record<string, number>,
      lastHour: 0,
      last24Hours: 0,
      lastWeek: 0,
      slowQueries: 0,
      failedQueries: 0,
      connectionFailures: 0
    };

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (const event of events) {
      // Count by type
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;

      // Count by time period
      if (event.timestamp >= oneHourAgo) stats.lastHour++;
      if (event.timestamp >= oneDayAgo) stats.last24Hours++;
      if (event.timestamp >= oneWeekAgo) stats.lastWeek++;

      // Count specific events
      if (event.type === 'query.slow') stats.slowQueries++;
      if (event.type === 'query.failed') stats.failedQueries++;
      if (event.type === 'connection.failed') stats.connectionFailures++;
    }

    return stats;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Destroy the monitor and clean up resources
   */
  destroy(): void {
    if (this.bufferTimer) {
      clearInterval(this.bufferTimer);
    }
    this.flushBuffer();
    this.observers.clear();
    this.eventHistory = [];
  }
}

/**
 * DTO: Event Filter
 */
export interface EventFilter {
  connectionId?: string;
  eventType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}

/**
 * DTO: Event Statistics
 */
export interface EventStatistics {
  total: number;
  byType: Record<string, number>;
  lastHour: number;
  last24Hours: number;
  lastWeek: number;
  slowQueries: number;
  failedQueries: number;
  connectionFailures: number;
}

/**
 * Abstract base class for connection observers
 * Provides default implementations for all methods
 */
export abstract class BaseConnectionObserver implements IConnectionObserver {
  onConnectionCreated(connection: Connection): void {}
  onConnectionUpdated(connection: Connection): void {}
  onConnectionDeleted(connectionId: string): void {}
  onConnectionConnected(connectionId: string): void {}
  onConnectionDisconnected(connectionId: string): void {}
  onConnectionFailed(connectionId: string, error: Error): void {}
  onHealthCheck(connectionId: string, health: ConnectionHealth): void {}
  onConnectionSlow(connectionId: string, responseTime: number): void {}
  onConnectionUnstable(connectionId: string, failures: number): void {}
  onConnectionRecovered(connectionId: string): void {}
  onQueryStarted(connectionId: string, query: Query): void {}
  onQueryCompleted(connectionId: string, query: Query, result: QueryResult): void {}
  onQueryFailed(connectionId: string, query: Query, error: Error): void {}
  onSlowQuery(connectionId: string, query: Query, executionTime: number): void {}
  onQueryTimeout(connectionId: string, query: Query): void {}
  onConnectionPoolCreated(connectionId: string, poolSize: number): void {}
  onConnectionAcquired(connectionId: string, poolSize: number, activeConnections: number): void {}
  onConnectionReleased(connectionId: string, poolSize: number, activeConnections: number): void {}
  onConnectionPoolExhausted(connectionId: string): void {}
  onUnauthorizedAccessAttempt(connectionId: string, details: any): void {}
  onSuspiciousActivity(connectionId: string, activity: any): void {}
  onConfigurationChanged(connectionId: string, oldConfig: any, newConfig: any): void {}
  onCredentialsRotated(connectionId: string): void {}
}
