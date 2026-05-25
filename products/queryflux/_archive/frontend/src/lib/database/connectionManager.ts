/**
 * Database Connection Manager
 *
 * Manages multiple database connections with connection pooling,
 * automatic reconnection, and secure connection handling.
 */

import { DatabaseAdapter } from './baseAdapter';
import { PostgresAdapter, PostgresConnectionConfig } from './adapters/postgresAdapter';
import { Connection } from '../lib/supabase';

export interface ManagedConnection {
  id: string;
  name: string;
  adapter: DatabaseAdapter;
  config: any;
  isActive: boolean;
  lastConnected: Date | null;
  connectionCount: number;
  errorCount: number;
  lastError?: string;
}

export class ConnectionManager {
  private connections: Map<string, ManagedConnection> = new Map();
  private maxConnections: number = 50;
  private connectionTimeout: number = 30000; // 30 seconds
  private healthCheckInterval: number = 60000; // 1 minute
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startHealthChecks();
  }

  /**
   * Create and register a new database connection
   */
  async createConnection(connection: Connection): Promise<ManagedConnection> {
    const connectionId = connection.id;

    // Check if connection already exists
    if (this.connections.has(connectionId)) {
      const existing = this.connections.get(connectionId)!;
      if (existing.isActive) {
        return existing;
      }
      // Remove inactive connection
      this.connections.delete(connectionId);
    }

    // Check connection limit
    if (this.connections.size >= this.maxConnections) {
      throw new Error(`Maximum connection limit (${this.maxConnections}) reached`);
    }

    // Create appropriate adapter based on database type
    const adapter = this.createAdapter(connection);

    const managedConnection: ManagedConnection = {
      id: connectionId,
      name: connection.name,
      adapter,
      config: connection,
      isActive: false,
      lastConnected: null,
      connectionCount: 0,
      errorCount: 0,
    };

    try {
      // Test the connection
      const testResult = await adapter.testConnection();

      if (testResult.success) {
        await adapter.connect();
        managedConnection.isActive = true;
        managedConnection.lastConnected = new Date();
        managedConnection.connectionCount = 1;
      } else {
        throw new Error(testResult.message);
      }
    } catch (error) {
      managedConnection.errorCount = 1;
      managedConnection.lastError = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }

    this.connections.set(connectionId, managedConnection);
    return managedConnection;
  }

  /**
   * Get an existing connection by ID
   */
  getConnection(connectionId: string): ManagedConnection | null {
    return this.connections.get(connectionId) || null;
  }

  /**
   * Remove a connection
   */
  async removeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      try {
        await connection.adapter.disconnect();
      } catch (error) {
        console.error(`Error disconnecting ${connectionId}:`, error);
      }
      this.connections.delete(connectionId);
    }
  }

  /**
   * Execute a query on a specific connection
   */
  async executeQuery(
    connectionId: string,
    query: string,
    params?: any[]
  ): Promise<any> {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    if (!connection.isActive) {
      // Try to reconnect
      try {
        await connection.adapter.connect();
        connection.isActive = true;
        connection.lastConnected = new Date();
        connection.connectionCount++;
      } catch (error) {
        connection.errorCount++;
        connection.lastError = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Connection ${connectionId} is not active and reconnection failed: ${connection.lastError}`);
      }
    }

    try {
      const result = await connection.adapter.executeQuery(query, params);
      connection.connectionCount++;
      return result;
    } catch (error) {
      connection.errorCount++;
      connection.lastError = error instanceof Error ? error.message : 'Unknown error';

      // If it's a connection error, mark as inactive
      if (this.isConnectionError(error)) {
        connection.isActive = false;
      }

      throw error;
    }
  }

  /**
   * Get schema for a specific connection
   */
  async getSchema(connectionId: string): Promise<any> {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    if (!connection.isActive) {
      throw new Error(`Connection ${connectionId} is not active`);
    }

    return await connection.adapter.getSchema();
  }

  /**
   * Test a connection without creating a persistent connection
   */
  async testConnection(connection: Connection): Promise<{ success: boolean; message: string; latency?: number }> {
    const adapter = this.createAdapter(connection);

    try {
      const result = await adapter.testConnection();
      await adapter.disconnect(); // Clean up test connection
      return result;
    } catch (error) {
      try {
        await adapter.disconnect(); // Ensure cleanup on error
      } catch {}

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): ManagedConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.isActive);
  }

  /**
   * Get all connections (active and inactive)
   */
  getAllConnections(): ManagedConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    activeConnections: number;
    totalQueries: number;
    totalErrors: number;
  } {
    const connections = Array.from(this.connections.values());

    return {
      totalConnections: connections.length,
      activeConnections: connections.filter(conn => conn.isActive).length,
      totalQueries: connections.reduce((sum, conn) => sum + conn.connectionCount, 0),
      totalErrors: connections.reduce((sum, conn) => sum + conn.errorCount, 0),
    };
  }

  /**
   * Close all connections
   */
  async closeAllConnections(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.values()).map(async (connection) => {
      try {
        await connection.adapter.disconnect();
      } catch (error) {
        console.error(`Error closing connection ${connection.id}:`, error);
      }
    });

    await Promise.all(disconnectPromises);
    this.connections.clear();
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.healthCheckInterval);
  }

  /**
   * Perform health checks on all active connections
   */
  private async performHealthChecks(): Promise<void> {
    const activeConnections = this.getActiveConnections();

    const healthCheckPromises = activeConnections.map(async (connection) => {
      try {
        // Simple health check query
        await connection.adapter.executeQuery('SELECT 1');
      } catch (error) {
        console.warn(`Health check failed for connection ${connection.id}:`, error);
        connection.isActive = false;
        connection.errorCount++;
        connection.lastError = error instanceof Error ? error.message : 'Health check failed';
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * Create appropriate adapter based on database type
   */
  private createAdapter(connection: Connection): DatabaseAdapter {
    const config = this.buildConnectionConfig(connection);

    switch (connection.database_type) {
      case 'postgresql':
        return new PostgresAdapter(config as PostgresConnectionConfig);

      case 'mysql':
        // TODO: Implement MySQL adapter
        throw new Error('MySQL adapter not yet implemented');

      case 'mongodb':
        // TODO: Implement MongoDB adapter
        throw new Error('MongoDB adapter not yet implemented');

      default:
        throw new Error(`Unsupported database type: ${connection.database_type}`);
    }
  }

  /**
   * Build connection config from Connection object
   */
  private buildConnectionConfig(connection: Connection): any {
    const baseConfig = {
      host: connection.host,
      port: connection.port,
      database: connection.database_name,
      user: connection.username,
      password: connection.password,
      ssl: connection.ssl_enabled,
    };

    // Use connection URL if available
    if (connection.connection_url) {
      return {
        connectionString: connection.connection_url,
        ssl: connection.ssl_enabled,
      };
    }

    return baseConfig;
  }

  /**
   * Check if an error is a connection-related error
   */
  private isConnectionError(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error);

    const connectionErrorKeywords = [
      'connection',
      'timeout',
      'network',
      'unreachable',
      'refused',
      'reset',
      'broken',
      'terminated',
      'econnreset',
      'enotfound',
      'etimedout',
    ];

    return connectionErrorKeywords.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
}

// Global connection manager instance
export const connectionManager = new ConnectionManager();
