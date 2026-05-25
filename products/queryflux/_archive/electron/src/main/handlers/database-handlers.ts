import { ipcMain } from 'electron';
import { connectionManager, DatabaseConfig, QueryResult } from '../database/connection-manager';
import { EncryptionService } from '../database/encryption';
import { logger } from '../utils/logger';
import Store from 'electron-store';

const secureStore = new Store({
  name: 'queryflux-connections',
  encryptionKey: 'queryflux-secure-key-2024'
});

export function setupDatabaseHandlers(): void {
  // Connect to database
  ipcMain.handle('db:connect', async (_, config: DatabaseConfig) => {
    try {
      // Validate configuration
      if (!config.host || !config.port || !config.database) {
        return {
          success: false,
          error: 'Missing required connection parameters (host, port, database)'
        };
      }

      // Test connection first if credentials are provided
      if (config.username && config.password) {
        const testConfig = { ...config };

        // Encrypt password for storage
        const encryptionKey = secureStore.get('encryption_key') || EncryptionService.generatePassword();
        secureStore.set('encryption_key', encryptionKey);

        const encryptedPassword = EncryptionService.encrypt(config.password, encryptionKey);
        testConfig.password = encryptedPassword;
      }

      // Connect to database
      logger.logDatabase('Connecting', '', { type: config.type, host: config.host, database: config.database });
      const result = await connectionManager.connect(config);

      if (result.success && result.connectionId) {
        // Store connection configuration (without sensitive data)
        const storedConnections: any[] = secureStore.get('connections', []);
        storedConnections.push({
          id: result.connectionId,
          name: `${config.type}://${config.host}:${config.port}/${config.database}`,
          type: config.type,
          host: config.host,
          port: config.port,
          database: config.database,
          username: config.username,
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        });
        secureStore.set('connections', storedConnections);

        logger.logDatabase('Connected', result.connectionId, { type: config.type, host: config.host, database: config.database });

        // Broadcast connection event
        broadcastToRenderer('database:connected', {
          connectionId: result.connectionId,
          type: config.type,
          host: config.host,
          database: config.database
        });
      }

      return result;

    } catch (error) {
      logger.error('Database connection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown connection error'
      };
    }
  });

  // Disconnect from database
  ipcMain.handle('db:disconnect', async (_, connectionId: string) => {
    try {
      const result = await connectionManager.disconnect(connectionId);

      if (result.success) {
        // Remove from recent connections
        const storedConnections: any[] = secureStore.get('connections', []);
        const updatedConnections = storedConnections.filter((conn: any) => conn.id !== connectionId);
        secureStore.set('connections', updatedConnections);

        // Broadcast disconnection event
        broadcastToRenderer('database:disconnected', { connectionId });
      }

      return result;

    } catch (error) {
      console.error('Database disconnection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown disconnection error'
      };
    }
  });

  // Execute query
  ipcMain.handle('db:executeQuery', async (_, { connectionId, query, params = [] }) => {
    try {
      // Validate query to prevent SQL injection attempts
      if (!query || typeof query !== 'string') {
        return {
          success: false,
          error: 'Invalid query provided',
          executionTime: 0
        };
      }

      // Update last used timestamp
      const storedConnections: any[] = secureStore.get('connections', []);
      const connectionIndex = storedConnections.findIndex((conn: any) => conn.id === connectionId);
      if (connectionIndex >= 0) {
        storedConnections[connectionIndex].lastUsed = new Date().toISOString();
        secureStore.set('connections', storedConnections);
      }

      // Broadcast query start event
      broadcastToRenderer('query:started', {
        connectionId,
        query: query.substring(0, 100) + (query.length > 100 ? '...' : '')
      });

      const result = await connectionManager.executeQuery(connectionId, query, params);

      // Broadcast query completion event
      if (result.success) {
        broadcastToRenderer('query:completed', {
          connectionId,
          executionTime: result.executionTime,
          rowCount: result.data?.rowCount || 0
        });
      } else {
        broadcastToRenderer('query:error', {
          connectionId,
          error: result.error,
          executionTime: result.executionTime
        });
      }

      return result;

    } catch (error) {
      console.error('Query execution error:', error);
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown query error',
        executionTime: 0
      };

      broadcastToRenderer('query:error', {
        connectionId,
        error: errorResult.error,
        executionTime: 0
      });

      return errorResult;
    }
  });

  // Get database schema
  ipcMain.handle('db:getSchema', async (_, connectionId: string) => {
    try {
      const schema = await connectionManager.getSchema(connectionId);
      return {
        success: true,
        data: schema
      };

    } catch (error) {
      console.error('Schema retrieval error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Schema retrieval failed'
      };
    }
  });

  // Get table list
  ipcMain.handle('db:getTables', async (_, connectionId: string) => {
    try {
      const schema = await connectionManager.getSchema(connectionId);
      return {
        success: true,
        data: schema.tables.map(table => ({
          name: table.name,
          schema: table.schema,
          type: table.type,
          rowCount: table.rowCount
        }))
      };

    } catch (error) {
      console.error('Table list retrieval error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Table list retrieval failed'
      };
    }
  });

  // Get table columns
  ipcMain.handle('db:getColumns', async (_, { connectionId, tableName }) => {
    try {
      const schema = await connectionManager.getSchema(connectionId);
      const table = schema.tables.find(t => t.name === tableName);

      if (!table) {
        return {
          success: false,
          error: `Table '${tableName}' not found`
        };
      }

      return {
        success: true,
        data: table.columns
      };

    } catch (error) {
      console.error('Column retrieval error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Column retrieval failed'
      };
    }
  });

  // Test connection
  ipcMain.handle('db:testConnection', async (_, config: DatabaseConfig) => {
    try {
      const startTime = Date.now();
      const result = await connectionManager.connect(config);
      const testTime = Date.now() - startTime;

      if (result.success && result.connectionId) {
        // Clean up test connection
        await connectionManager.disconnect(result.connectionId);
      }

      return {
        success: result.success,
        error: result.error,
        testTime
      };

    } catch (error) {
      console.error('Connection test error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
        testTime: 0
      };
    }
  });

  // Get stored connections
  ipcMain.handle('db:getStoredConnections', async () => {
    try {
      const connections: any[] = secureStore.get('connections', []);
      return {
        success: true,
        data: connections
      };

    } catch (error) {
      console.error('Stored connections retrieval error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve stored connections'
      };
    }
  });

  // Delete stored connection
  ipcMain.handle('db:deleteStoredConnection', async (_, connectionId: string) => {
    try {
      const storedConnections: any[] = secureStore.get('connections', []);
      const updatedConnections = storedConnections.filter((conn: any) => conn.id !== connectionId);
      secureStore.set('connections', updatedConnections);

      // Also disconnect if currently connected
      await connectionManager.disconnect(connectionId);

      return { success: true };

    } catch (error) {
      console.error('Stored connection deletion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete stored connection'
      };
    }
  });

  // Get connection info
  ipcMain.handle('db:getConnectionInfo', async (_, connectionId: string) => {
    try {
      const connection = connectionManager.getConnection(connectionId);

      if (!connection) {
        return {
          success: false,
          error: 'Connection not found'
        };
      }

      const healthCheck = await connectionManager.healthCheck(connectionId);

      return {
        success: true,
        data: {
          id: connection.id,
          type: connection.type,
          host: connection.config.host,
          port: connection.config.port,
          database: connection.config.database,
          connected: connection.connected,
          connectedAt: connection.connectedAt,
          healthy: healthCheck
        }
      };

    } catch (error) {
      console.error('Connection info retrieval error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve connection info'
      };
    }
  });

  // Get all active connections
  ipcMain.handle('db:getActiveConnections', async () => {
    try {
      const connections = connectionManager.getAllConnections();
      const connectionInfo = await Promise.all(
        connections.map(async (conn) => {
          const healthCheck = await connectionManager.healthCheck(conn.id);
          return {
            id: conn.id,
            type: conn.type,
            host: conn.config.host,
            database: conn.config.database,
            connectedAt: conn.connectedAt,
            healthy: healthCheck
          };
        })
      );

      return {
        success: true,
        data: connectionInfo
      };

    } catch (error) {
      console.error('Active connections retrieval error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve active connections'
      };
    }
  });
}

// Helper function to broadcast events to renderer processes
function broadcastToRenderer(channel: string, data: any): void {
  // Get all windows and broadcast to them
  const { BrowserWindow } = require('electron');
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, data);
    }
  });
}