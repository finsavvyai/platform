/**
 * Database Manager Service
 * Manages database connections and provides IPC interface
 */

import { EventEmitter } from 'events';
import {
  ConnectionParams,
  DatabaseType,
  IDatabaseAdapter,
  DatabaseInfo,
  CollectionInfo,
  QueryResult,
  DatabaseError,
  DatabaseAdapterFactory,
  getSupportedDatabases
} from './database';

interface Connection {
  id: string;
  name: string;
  adapter: IDatabaseAdapter;
  config: ConnectionParams;
  connectedAt: Date;
  lastUsed: Date;
  metadata: Record<string, any>;
}

interface SavedConnection {
  id: string;
  name: string;
  type: DatabaseType;
  config: ConnectionParams;
  lastConnected?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class DatabaseManager extends EventEmitter {
  private connections = new Map<string, Connection>();
  private savedConnections: SavedConnection[] = [];
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.setMaxListeners(100);

    // Load saved connections from storage
    this.loadSavedConnections();

    // Start cleanup interval for inactive connections
    this.startCleanupInterval();
  }

  /**
   * Get available database types
   */
  getAvailableTypes(): Array<{ type: DatabaseType; name: string; description: string }> {
    const supported = getSupportedDatabases();

    return Object.entries(supported).map(([type, description]) => ({
      type: type as DatabaseType,
      name: type,
      description
    }));
  }

  /**
   * Test a database connection without saving
   */
  async testConnection(config: Record<string, any>): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      const connectionParams: ConnectionParams = {
        host: config.host || 'localhost',
        port: config.port || this.getDefaultPort(config.type),
        username: config.username,
        password: config.password,
        database: config.database,
        ssl: config.ssl || false,
        additionalParams: config.additionalParams || {}
      };

      const adapter = DatabaseAdapterFactory.createFromConfig(config);
      const result = await adapter.testConnection();

      await adapter.cleanup();

      return {
        success: result.connected || false,
        data: result
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Create a new database connection
   */
  async connect(config: Record<string, any>, name?: string): Promise<{ connectionId: string; error?: string }> {
    try {
      const connectionId = this.generateConnectionId();

      const connectionParams: ConnectionParams = {
        host: config.host || 'localhost',
        port: config.port || this.getDefaultPort(config.type),
        username: config.username,
        password: config.password,
        database: config.database,
        ssl: config.ssl || false,
        additionalParams: config.additionalParams || {}
      };

      const adapter = DatabaseAdapterFactory.createFromConfig(config);
      await adapter.connect();

      const connection: Connection = {
        id: connectionId,
        name: name || `${config.type}_${config.host}:${config.port}`,
        adapter,
        config: connectionParams,
        connectedAt: new Date(),
        lastUsed: new Date(),
        metadata: {
          databaseType: config.type,
          host: config.host,
          port: config.port,
          database: config.database
        }
      };

      // Set up event listeners
      this.setupAdapterEventListeners(adapter, connectionId);

      this.connections.set(connectionId, connection);

      // Emit connection event
      this.emit('connection:connected', {
        connectionId,
        name: connection.name,
        type: config.type
      });

      return { connectionId };

    } catch (error) {
      return {
        connectionId: '',
        error: (error as Error).message
      };
    }
  }

  /**
   * Disconnect from a database
   */
  async disconnect(connectionId: string): Promise<{ success: boolean; error?: string }> {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      await connection.adapter.disconnect();
      connection.adapter.cleanup();
      this.connections.delete(connectionId);

      this.emit('connection:disconnected', {
        connectionId,
        name: connection.name
      });

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Execute a query
   */
  async executeQuery(
    connectionId: string,
    query: string,
    options: {
      collection?: string;
      limit?: number;
      params?: any[];
    } = {}
  ): Promise<QueryResult> {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      throw new Error('Connection not found');
    }

    // Update last used time
    connection.lastUsed = new Date();

    return await connection.adapter.executeQuery(
      query,
      options.collection,
      options.limit
    );
  }

  /**
   * Validate a query
   */
  async validateQuery(connectionId: string, query: string): Promise<{ valid: boolean; warnings: string[]; suggestions: string[] }> {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      throw new Error('Connection not found');
    }

    return await connection.adapter.validateQuery(query);
  }

  /**
   * Explain a query
   */
  async explainQuery(connectionId: string, query: string, collection?: string): Promise<any> {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      throw new Error('Connection not found');
    }

    return await connection.adapter.explainQuery(query, collection);
  }

  /**
   * Get query suggestions
   */
  async getQuerySuggestions(
    connectionId: string,
    partialQuery: string,
    context?: Record<string, any>
  ): Promise<Array<{ text: string; description?: string; type: string }>> {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      throw new Error('Connection not found');
    }

    return await connection.adapter.getQuerySuggestions(partialQuery, context);
  }

  /**
   * Get database information
   */
  async getInfo(connectionId: string): Promise<DatabaseInfo> {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      throw new Error('Connection not found');
    }

    return await connection.adapter.getDatabaseInfo();
  }

  /**
   * List collections/tables
   */
  async listCollections(connectionId: string): Promise<CollectionInfo[]> {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      throw new Error('Connection not found');
    }

    return await connection.adapter.listCollections();
  }

  /**
   * Get collection/table information
   */
  async getCollectionInfo(connectionId: string, collectionName: string): Promise<CollectionInfo> {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      throw new Error('Connection not found');
    }

    return await connection.adapter.getCollectionInfo(collectionName);
  }

  /**
   * Get sample data
   */
  async getSampleData(connectionId: string, collectionName: string, limit: number = 10): Promise<Array<Record<string, any>>> {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      throw new Error('Connection not found');
    }

    return await connection.adapter.getSampleDocuments(collectionName, limit);
  }

  /**
   * Get performance stats
   */
  async getPerformanceStats(connectionId: string): Promise<any> {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      throw new Error('Connection not found');
    }

    return await connection.adapter.getPerformanceStats();
  }

  /**
   * Save a connection
   */
  async saveConnection(config: Record<string, any>, name?: string, overwrite = false): Promise<{ success: boolean; connectionId?: string; error?: string }> {
    try {
      const connectionId = config.id || this.generateConnectionId();

      const savedConnection: SavedConnection = {
        id: connectionId,
        name: name || `${config.type}_${config.host}:${config.port}`,
        type: config.type as DatabaseType,
        config: {
          host: config.host || 'localhost',
          port: config.port || this.getDefaultPort(config.type),
          username: config.username,
          database: config.database,
          ssl: config.ssl || false,
          additionalParams: config.additionalParams || {}
        },
        createdAt: config.createdAt || new Date(),
        updatedAt: new Date()
      };

      // Don't save password in saved connections
      delete savedConnection.config.password;

      // Check if connection already exists
      const existingIndex = this.savedConnections.findIndex(c => c.id === connectionId);

      if (existingIndex >= 0) {
        if (!overwrite) {
          return {
            success: false,
            error: 'Connection already exists'
          };
        }

        savedConnection.createdAt = this.savedConnections[existingIndex].createdAt;
        this.savedConnections[existingIndex] = savedConnection;
      } else {
        this.savedConnections.push(savedConnection);
      }

      // Save to persistent storage
      await this.saveToStorage();

      this.emit('connection:saved', {
        connectionId,
        name: savedConnection.name,
        type: savedConnection.type
      });

      return { success: true, connectionId };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get saved connections
   */
  getSavedConnections(): SavedConnection[] {
    return this.savedConnections.map(conn => ({ ...conn }));
  }

  /**
   * Delete a saved connection
   */
  async deleteSavedConnection(connectionId: string): Promise<{ success: boolean; error?: string }> {
    const index = this.savedConnections.findIndex(c => c.id === connectionId);

    if (index < 0) {
      return { success: false, error: 'Connection not found' };
    }

    this.savedConnections.splice(index, 1);
    await this.saveToStorage();

    this.emit('connection:deleted', { connectionId });

    return { success: true };
  }

  /**
   * Get active connections
   */
  getActiveConnections(): Array<{
    id: string;
    name: string;
    type: DatabaseType;
    connectedAt: Date;
    lastUsed: Date;
    connected: boolean;
  }> {
    return Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      name: conn.name,
      type: conn.adapter.dbType,
      connectedAt: conn.connectedAt,
      lastUsed: conn.lastUsed,
      connected: conn.adapter.connected
    }));
  }

  /**
   * Clean up inactive connections
   */
  async cleanup(): Promise<void> {
    const inactiveTime = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();

    for (const [id, connection] of this.connections.entries()) {
      if (now - connection.lastUsed.getTime() > inactiveTime) {
        try {
          await this.disconnect(id);
        } catch (error) {
          console.error(`Failed to cleanup connection ${id}:`, error);
        }
      }
    }
  }

  /**
   * Shutdown all connections
   */
  async shutdown(): Promise<void> {
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Disconnect all active connections
    const disconnectionPromises = Array.from(this.connections.keys()).map(id =>
      this.disconnect(id).catch(error => {
        console.error(`Failed to disconnect ${id}:`, error);
      })
    );

    await Promise.all(disconnectionPromises);
    this.connections.clear();
  }

  // Private methods

  private setupAdapterEventListeners(adapter: IDatabaseAdapter, connectionId: string): void {
    adapter.on('error', (event) => {
      this.emit('connection:error', {
        connectionId,
        error: event.error,
        data: event.data
      });
    });

    adapter.on('connecting', () => {
      this.emit('connection:connecting', { connectionId });
    });

    adapter.on('connected', (event) => {
      this.emit('connection:connected', {
        connectionId,
        data: event.data
      });
    });

    adapter.on('disconnected', () => {
      this.emit('connection:disconnected', { connectionId });
    });

    adapter.on('query', (event) => {
      this.emit('connection:query', {
        connectionId,
        data: event.data,
        executionTime: event.timestamp
      });
    });
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultPort(dbType: string): number {
    const defaultPorts: Record<string, number> = {
      postgresql: 5432,
      mysql: 3306,
      mongodb: 27017,
      redis: 6379,
      sqlite: 0,
      sqlserver: 1433,
      oracle: 1521
    };

    return defaultPorts[dbType] || 0;
  }

  private async loadSavedConnections(): Promise<void> {
    try {
      // In a real implementation, this would load from secure storage
      // For now, we'll use a simple JSON file
      // const data = await fs.readFile(savedConnectionsFile, 'utf-8');
      // this.savedConnections = JSON.parse(data);

      // Start with empty connections for now
      this.savedConnections = [];

    } catch (error) {
      console.error('Failed to load saved connections:', error);
      this.savedConnections = [];
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      // In a real implementation, this would save to secure storage
      // await fs.writeFile(savedConnectionsFile, JSON.stringify(this.savedConnections, null, 2));

    } catch (error) {
      console.error('Failed to save connections:', error);
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(error => {
        console.error('Connection cleanup failed:', error);
      });
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}

export default DatabaseManager;
