/**
 * Database Connection Manager for Questro Platform
 *
 * This service provides advanced connection management with:
 * - Connection pooling and reuse
 * - Health monitoring and automatic recovery
 * - Load balancing across multiple connections
 * - Connection timeout and retry management
 * - Resource cleanup and optimization
 *
 * @author Questro Platform Team
 * @version 1.0.0
 * @since 2025-11-01
 */

import { DatabaseService, DatabaseError, DatabaseErrorType } from './database-service';

export interface ConnectionConfig {
  id: string;
  d1Database: D1Database;
  maxConnections: number;
  connectionTimeout: number;
  healthCheckInterval: number;
  maxRetries: number;
  priority: number; // Load balancing priority
}

export interface ConnectionStats {
  id: string;
  activeConnections: number;
  totalQueries: number;
  averageQueryTime: number;
  errorCount: number;
  lastHealthCheck: number;
  isHealthy: boolean;
  uptime: number;
}

export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  availableConnections: number;
  queuedRequests: number;
  totalQueries: number;
  averageResponseTime: number;
  errorRate: number;
}

/**
 * Connection pool manager for handling multiple database connections
 */
export class DatabaseConnectionManager {
  private connections = new Map<string, ConnectionConfig>();
  private pools = new Map<string, Array<{
    connection: D1Database;
    inUse: boolean;
    lastUsed: number;
    created: number;
    queryCount: number;
  }>>();
  private services = new Map<string, DatabaseService>();
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>();
  private connectionStats = new Map<string, ConnectionStats>();
  private requestQueue = Array<{
    resolve: (connection: D1Database) => void;
    reject: (error: Error) => void;
    connectionId: string;
    timestamp: number;
  }>();
  private isShuttingDown = false;

  constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanupIdleConnections(), 60000); // Every minute
  }

  /**
   * Register a new database connection
   */
  async registerConnection(config: ConnectionConfig): Promise<void> {
    if (this.connections.has(config.id)) {
      throw new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `Connection with ID ${config.id} already exists`
      );
    }

    this.connections.set(config.id, config);
    this.pools.set(config.id, []);

    // Initialize connection stats
    this.connectionStats.set(config.id, {
      id: config.id,
      activeConnections: 0,
      totalQueries: 0,
      averageQueryTime: 0,
      errorCount: 0,
      lastHealthCheck: Date.now(),
      isHealthy: true,
      uptime: Date.now()
    });

    // Create initial database service
    const service = new DatabaseService(config.d1Database, {
      maxConnections: config.maxConnections,
      connectionTimeout: config.connectionTimeout,
      maxRetries: config.maxRetries,
      enableMetrics: true
    });

    this.services.set(config.id, service);

    // Start health checking
    this.startHealthCheck(config);

    console.log(`Database connection registered: ${config.id}`);
  }

  /**
   * Get a connection from the pool
   */
  async getConnection(connectionId?: string): Promise<{
    connection: D1Database;
    service: DatabaseService;
    connectionId: string;
  }> {
    if (this.isShuttingDown) {
      throw new DatabaseError(
        DatabaseErrorType.CONNECTION_ERROR,
        'Connection manager is shutting down'
      );
    }

    // If no specific connection requested, use load balancing
    if (!connectionId) {
      connectionId = this.selectBestConnection();
    }

    if (!this.connections.has(connectionId)) {
      throw new DatabaseError(
        DatabaseErrorType.CONNECTION_ERROR,
        `Connection ${connectionId} not found`
      );
    }

    const config = this.connections.get(connectionId)!;
    const pool = this.pools.get(connectionId)!;
    const stats = this.connectionStats.get(connectionId)!;

    // Try to find an available connection
    const availableConnection = pool.find(conn => !conn.inUse);

    if (availableConnection) {
      availableConnection.inUse = true;
      availableConnection.lastUsed = Date.now();
      availableConnection.queryCount++;
      stats.activeConnections++;
      stats.totalQueries++;

      return {
        connection: availableConnection.connection,
        service: this.services.get(connectionId)!,
        connectionId
      };
    }

    // Create new connection if under limit
    if (pool.length < config.maxConnections) {
      const newConnection = {
        connection: config.d1Database,
        inUse: true,
        lastUsed: Date.now(),
        created: Date.now(),
        queryCount: 1
      };

      pool.push(newConnection);
      stats.activeConnections++;
      stats.totalQueries++;

      return {
        connection: newConnection.connection,
        service: this.services.get(connectionId)!,
        connectionId
      };
    }

    // Queue the request if all connections are in use
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.requestQueue.findIndex(req => req.timestamp === Date.now());
        if (index !== -1) {
          this.requestQueue.splice(index, 1);
        }
        reject(new DatabaseError(
          DatabaseErrorType.TIMEOUT_ERROR,
          `Connection request timeout for ${connectionId}`
        ));
      }, config.connectionTimeout);

      this.requestQueue.push({
        resolve: ({ connection, service, connectionId }) => {
          clearTimeout(timeout);
          resolve({ connection, service, connectionId });
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        connectionId,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(connectionId: string, connection: D1Database): void {
    const pool = this.pools.get(connectionId);
    const stats = this.connectionStats.get(connectionId);

    if (!pool || !stats) {
      console.warn(`Attempted to release unknown connection: ${connectionId}`);
      return;
    }

    const poolConnection = pool.find(conn => conn.connection === connection);
    if (poolConnection) {
      poolConnection.inUse = false;
      poolConnection.lastUsed = Date.now();
      stats.activeConnections--;

      // Process queued requests
      this.processQueue();
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(connectionId?: string): ConnectionStats[] {
    if (connectionId) {
      const stats = this.connectionStats.get(connectionId);
      return stats ? [stats] : [];
    }

    return Array.from(this.connectionStats.values());
  }

  /**
   * Get overall pool statistics
   */
  getPoolStats(): PoolStats {
    let totalConnections = 0;
    let activeConnections = 0;
    let totalQueries = 0;
    let totalResponseTime = 0;
    let totalErrors = 0;

    for (const [connectionId, pool] of this.pools.entries()) {
      totalConnections += pool.length;
      activeConnections += pool.filter(conn => conn.inUse).length;

      const stats = this.connectionStats.get(connectionId);
      if (stats) {
        totalQueries += stats.totalQueries;
        totalResponseTime += stats.averageQueryTime * stats.totalQueries;
        totalErrors += stats.errorCount;
      }
    }

    return {
      totalConnections,
      activeConnections,
      availableConnections: totalConnections - activeConnections,
      queuedRequests: this.requestQueue.length,
      totalQueries,
      averageResponseTime: totalQueries > 0 ? totalResponseTime / totalQueries : 0,
      errorRate: totalQueries > 0 ? (totalErrors / totalQueries) * 100 : 0
    };
  }

  /**
   * Execute a query with automatic connection management
   */
  async executeQuery<T>(
    queryFn: (service: DatabaseService) => Promise<T>,
    connectionId?: string
  ): Promise<T> {
    const { service, connectionId: usedConnectionId } = await this.getConnection(connectionId);
    const startTime = Date.now();

    try {
      const result = await queryFn(service);

      // Update stats
      const stats = this.connectionStats.get(usedConnectionId);
      if (stats) {
        const queryTime = Date.now() - startTime;
        stats.averageQueryTime =
          (stats.averageQueryTime * (stats.totalQueries - 1) + queryTime) / stats.totalQueries;
      }

      return result;

    } catch (error) {
      // Update error stats
      const stats = this.connectionStats.get(usedConnectionId);
      if (stats) {
        stats.errorCount++;
      }

      throw error;

    } finally {
      this.releaseConnection(usedConnectionId, service as any);
    }
  }

  /**
   * Remove a connection from the pool
   */
  async removeConnection(connectionId: string): Promise<void> {
    if (!this.connections.has(connectionId)) {
      throw new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `Connection ${connectionId} not found`
      );
    }

    // Stop health checking
    const healthCheckInterval = this.healthCheckIntervals.get(connectionId);
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      this.healthCheckIntervals.delete(connectionId);
    }

    // Wait for all connections to be released
    const pool = this.pools.get(connectionId);
    if (pool) {
      const maxWait = 30000; // 30 seconds
      const startWait = Date.now();

      while (pool.some(conn => conn.inUse) && Date.now() - startWait < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Force close any remaining connections
      this.pools.delete(connectionId);
    }

    // Clean up
    this.connections.delete(connectionId);
    this.services.delete(connectionId);
    this.connectionStats.delete(connectionId);

    console.log(`Database connection removed: ${connectionId}`);
  }

  /**
   * Gracefully shutdown all connections
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Reject all queued requests
    for (const request of this.requestQueue) {
      request.reject(new DatabaseError(
        DatabaseErrorType.CONNECTION_ERROR,
        'Connection manager is shutting down'
      ));
    }
    this.requestQueue = [];

    // Remove all connections
    const connectionIds = Array.from(this.connections.keys());
    await Promise.all(connectionIds.map(id => this.removeConnection(id)));

    console.log('Database connection manager shutdown complete');
  }

  /**
   * Select the best connection based on load balancing
   */
  private selectBestConnection(): string {
    const healthyConnections = Array.from(this.connectionStats.entries())
      .filter(([_, stats]) => stats.isHealthy)
      .sort(([_, a], [_, b]) => {
        // Sort by priority, then by active connections, then by average query time
        const aConfig = this.connections.get(a.id)!;
        const bConfig = this.connections.get(b.id)!;

        if (aConfig.priority !== bConfig.priority) {
          return bConfig.priority - aConfig.priority; // Higher priority first
        }

        if (a.activeConnections !== b.activeConnections) {
          return a.activeConnections - b.activeConnections; // Fewer active connections first
        }

        return a.averageQueryTime - b.averageQueryTime; // Faster response time first
      });

    if (healthyConnections.length === 0) {
      throw new DatabaseError(
        DatabaseErrorType.CONNECTION_ERROR,
        'No healthy connections available'
      );
    }

    return healthyConnections[0][0];
  }

  /**
   * Start health checking for a connection
   */
  private startHealthCheck(config: ConnectionConfig): void {
    const interval = setInterval(async () => {
      const stats = this.connectionStats.get(config.id);
      const service = this.services.get(config.id);

      if (!stats || !service) return;

      try {
        const health = await service.healthCheck();
        stats.isHealthy = health.status === 'healthy';
        stats.lastHealthCheck = Date.now();

        if (health.status === 'unhealthy') {
          console.warn(`Connection ${config.id} is unhealthy:`, health.details);

          // Attempt recovery
          await this.attemptConnectionRecovery(config.id);
        }

      } catch (error) {
        console.error(`Health check failed for connection ${config.id}:`, error);
        stats.isHealthy = false;
        stats.errorCount++;
      }
    }, config.healthCheckInterval);

    this.healthCheckIntervals.set(config.id, interval);
  }

  /**
   * Attempt to recover a failed connection
   */
  private async attemptConnectionRecovery(connectionId: string): Promise<void> {
    const config = this.connections.get(connectionId);
    const service = this.services.get(connectionId);

    if (!config || !service) return;

    try {
      console.log(`Attempting to recover connection ${connectionId}...`);

      // Test basic connectivity
      await service.healthCheck();

      // If successful, mark as healthy
      const stats = this.connectionStats.get(connectionId);
      if (stats) {
        stats.isHealthy = true;
        stats.errorCount = 0; // Reset error count on successful recovery
      }

      console.log(`Connection ${connectionId} recovered successfully`);

    } catch (error) {
      console.error(`Failed to recover connection ${connectionId}:`, error);

      // Mark as unhealthy and try again later
      const stats = this.connectionStats.get(connectionId);
      if (stats) {
        stats.isHealthy = false;
      }
    }
  }

  /**
   * Process queued connection requests
   */
  private processQueue(): void {
    if (this.requestQueue.length === 0) return;

    const request = this.requestQueue[0];
    const connectionId = request.connectionId;
    const pool = this.pools.get(connectionId);

    if (!pool) return;

    const availableConnection = pool.find(conn => !conn.inUse);
    if (availableConnection) {
      availableConnection.inUse = true;
      availableConnection.lastUsed = Date.now();

      const stats = this.connectionStats.get(connectionId);
      if (stats) {
        stats.activeConnections++;
      }

      this.requestQueue.shift();
      request.resolve({
        connection: availableConnection.connection,
        service: this.services.get(connectionId)!,
        connectionId
      });

      // Process next request
      this.processQueue();
    }
  }

  /**
   * Clean up idle connections
   */
  private cleanupIdleConnections(): void {
    const idleTimeout = 300000; // 5 minutes

    for (const [connectionId, pool] of this.pools.entries()) {
      const config = this.connections.get(connectionId);
      if (!config) continue;

      // Remove connections that have been idle for too long (but keep minimum connections)
      const minConnections = Math.max(1, Math.floor(config.maxConnections * 0.25));
      const idleConnections = pool.filter(conn =>
        !conn.inUse &&
        Date.now() - conn.lastUsed > idleTimeout &&
        pool.length > minConnections
      );

      for (const idleConn of idleConnections) {
        const index = pool.indexOf(idleConn);
        if (index !== -1) {
          pool.splice(index, 1);
          console.log(`Removed idle connection from pool ${connectionId}`);
        }
      }
    }
  }
}

// Global connection manager instance
let connectionManager: DatabaseConnectionManager;

export function getConnectionManager(): DatabaseConnectionManager {
  if (!connectionManager) {
    connectionManager = new DatabaseConnectionManager();
  }
  return connectionManager;
}

export function initializeConnectionManager(): DatabaseConnectionManager {
  connectionManager = new DatabaseConnectionManager();
  return connectionManager;
}

// Utility functions for easy connection management
export async function withConnection<T>(
  queryFn: (service: DatabaseService) => Promise<T>,
  connectionId?: string
): Promise<T> {
  const manager = getConnectionManager();
  return manager.executeQuery(queryFn, connectionId);
}

export async function registerConnection(config: ConnectionConfig): Promise<void> {
  const manager = getConnectionManager();
  return manager.registerConnection(config);
}

export async function removeConnection(connectionId: string): Promise<void> {
  const manager = getConnectionManager();
  return manager.removeConnection(connectionId);
}
