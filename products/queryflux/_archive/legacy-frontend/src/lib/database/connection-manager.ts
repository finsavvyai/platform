import { DatabaseAdapter, DatabaseConnection, QueryResult, TableInfo, ConnectionTestResult } from './types';
import { DatabaseAdapterFactory } from './adapters';

export class DatabaseConnectionManager {
  private connections: Map<string, DatabaseConnection> = new Map();
  private connectionIdCounter = 0;

  async connect(config: any): Promise<{ success: boolean; connectionId?: string; error?: string }> {
    try {
      const connectionId = `conn_${++this.connectionIdCounter}_${Date.now()}`;

      // Create adapter using our factory
      const adapter = DatabaseAdapterFactory.create(config);
      await adapter.connect();

      const connection: DatabaseConnection = {
        id: connectionId,
        config: this.sanitizeConfig(config),
        client: adapter, // Store the adapter instead of raw client
        type: config.type,
        connected: true,
        connectedAt: new Date()
      };

      this.connections.set(connectionId, connection);

      return {
        success: true,
        connectionId
      };

    } catch (error) {
      console.error('Database connection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown connection error'
      };
    }
  }

  async disconnect(connectionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        return {
          success: false,
          error: 'Connection not found'
        };
      }

      if (connection.client && typeof connection.client === 'object' && 'disconnect' in connection.client) {
        await (connection.client as DatabaseAdapter).disconnect();
      }

      this.connections.delete(connectionId);
      return { success: true };

    } catch (error) {
      console.error('Database disconnection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown disconnection error'
      };
    }
  }

  async executeQuery(connectionId: string, query: string, params?: any[]): Promise<QueryResult> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      if (connection.client && typeof connection.client === 'object' && 'executeQuery' in connection.client) {
        return await (connection.client as DatabaseAdapter).executeQuery(query, params);
      } else {
        throw new Error('Invalid connection: missing executeQuery method');
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query execution failed',
        executionTime: 0
      };
    }
  }

  async getSchema(connectionId: string): Promise<{ tables: TableInfo[] }> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    if (connection.client && typeof connection.client === 'object' && 'getSchema' in connection.client) {
      return await (connection.client as DatabaseAdapter).getSchema();
    } else {
      throw new Error('Invalid connection: missing getSchema method');
    }
  }

  async testConnection(connectionId: string): Promise<ConnectionTestResult> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    if (connection.client && typeof connection.client === 'object' && 'testConnection' in connection.client) {
      return await (connection.client as DatabaseAdapter).testConnection();
    } else {
      throw new Error('Invalid connection: missing testConnection method');
    }
  }

  getConnection(connectionId: string): DatabaseConnection | undefined {
    return this.connections.get(connectionId);
  }

  getAllConnections(): DatabaseConnection[] {
    return Array.from(this.connections.values());
  }

  async healthCheck(connectionId: string): Promise<boolean> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return false;

      if (connection.client && typeof connection.client === 'object' && 'isConnected' in connection.client) {
        return (connection.client as DatabaseAdapter).isConnected();
      } else {
        return true; // Assume healthy if no error thrown
      }
    } catch {
      return false;
    }
  }

  private sanitizeConfig(config: any): any {
    const sanitized = { ...config };
    // Remove sensitive data for storage
    if (sanitized.password) {
      sanitized.password = '***encrypted***';
    }
    return sanitized;
  }

  // Get supported database types
  getSupportedDatabaseTypes(): string[] {
    return DatabaseAdapterFactory.getSupportedTypes();
  }

  // Get database info for UI display
  getDatabaseInfo(type: string) {
    return DatabaseAdapterFactory.getDatabaseInfo(type);
  }
}

// Export singleton instance
export const databaseConnectionManager = new DatabaseConnectionManager();
