import { useState, useEffect, useCallback } from "react";

// Types for Electron database operations
export interface DatabaseConfig {
  type:
    | "postgresql"
    | "mysql"
    | "mongodb"
    | "redis"
    | "sqlite"
    | "sqlserver"
    | "oracle"
    | "cassandra"
    | "cockroachdb";
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  connectionString?: string;
  options?: Record<string, any>;
  // Database-specific options
  dataCenter?: string; // Cassandra
  keyspace?: string; // Cassandra
  serviceName?: string; // Oracle
  sid?: string; // Oracle
  encrypt?: boolean; // SQL Server
  trustServerCertificate?: boolean; // SQL Server
  file?: string; // SQLite
  readonly?: boolean; // SQLite
  authDatabase?: string; // MongoDB
  readPreference?: string; // MongoDB
  replicaSet?: string; // MongoDB
  family?: number; // Redis (4 or 6)
  db?: number; // Redis (0-15)
  keepAlive?: boolean; // Redis
  connectTimeout?: number; // Redis
  commandTimeout?: number; // Redis
}

export interface DatabaseConnection {
  id: string;
  name: string;
  type: string;
  host: string;
  database: string;
  username?: string;
  createdAt: string;
  lastUsed: string;
}

export interface QueryResult {
  success: boolean;
  data?: {
    columns: string[];
    rows: any[][];
    rowCount: number;
  };
  error?: string;
  executionTime: number;
  affectedRows?: number;
}

export interface TableInfo {
  name: string;
  schema: string;
  type: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  rowCount?: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  primaryKey: boolean;
  foreignKey?: {
    table: string;
    column: string;
  };
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  type: string;
}

export const useElectronDatabase = () => {
  const [isElectron, setIsElectron] = useState(false);
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [activeConnections, setActiveConnections] = useState<
    DatabaseConnection[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(!!window.electronAPI);
  }, []);

  // Load stored connections
  const loadStoredConnections = useCallback(async () => {
    if (!isElectron) return;

    try {
      setIsLoading(true);
      const result = await window.electronAPI.database.getStoredConnections();

      if (result.success) {
        setConnections(result.data || []);
      } else {
        setError(result.error || "Failed to load connections");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [isElectron]);

  // Load active connections
  const loadActiveConnections = useCallback(async () => {
    if (!isElectron) return;

    try {
      const result = await window.electronAPI.database.getActiveConnections();

      if (result.success) {
        setActiveConnections(result.data || []);
      }
    } catch (err) {
      console.error("Failed to load active connections:", err);
    }
  }, [isElectron]);

  // Connect to database
  const connect = useCallback(
    async (
      config: DatabaseConfig,
    ): Promise<{ success: boolean; connectionId?: string; error?: string }> => {
      if (!isElectron) {
        return {
          success: false,
          error: "Database connections are only available in the Electron app",
        };
      }

      try {
        setIsLoading(true);
        setError(null);

        const result = await window.electronAPI.database.connect(config);

        if (result.success) {
          // Reload connections list
          await loadStoredConnections();
          await loadActiveConnections();
        } else {
          setError(result.error || "Connection failed");
        }

        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown connection error";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [isElectron, loadStoredConnections, loadActiveConnections],
  );

  // Disconnect from database
  const disconnect = useCallback(
    async (
      connectionId: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!isElectron) {
        return {
          success: false,
          error: "Database operations are only available in the Electron app",
        };
      }

      try {
        setIsLoading(true);

        const result =
          await window.electronAPI.database.disconnect(connectionId);

        if (result.success) {
          // Reload connections lists
          await loadStoredConnections();
          await loadActiveConnections();
        }

        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown disconnection error";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [isElectron, loadStoredConnections, loadActiveConnections],
  );

  // Execute query
  const executeQuery = useCallback(
    async (
      connectionId: string,
      query: string,
      params: any[] = [],
    ): Promise<QueryResult> => {
      if (!isElectron) {
        return {
          success: false,
          error: "Query execution is only available in the Electron app",
          executionTime: 0,
        };
      }

      try {
        setError(null);

        const result = await window.electronAPI.database.executeQuery({
          connectionId,
          query,
          params,
        });

        if (!result.success) {
          setError(result.error || "Query execution failed");
        }

        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown query error";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          executionTime: 0,
        };
      }
    },
    [isElectron],
  );

  // Get database schema
  const getSchema = useCallback(
    async (connectionId: string): Promise<{ tables: TableInfo[] } | null> => {
      if (!isElectron) return null;

      try {
        const result =
          await window.electronAPI.database.getSchema(connectionId);

        if (result.success) {
          return result.data;
        } else {
          setError(result.error || "Failed to get schema");
          return null;
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Schema retrieval failed",
        );
        return null;
      }
    },
    [isElectron],
  );

  // Get tables list
  const getTables = useCallback(
    async (connectionId: string): Promise<TableInfo[] | null> => {
      if (!isElectron) return null;

      try {
        const result =
          await window.electronAPI.database.getTables(connectionId);

        if (result.success) {
          return result.data;
        } else {
          setError(result.error || "Failed to get tables");
          return null;
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Tables retrieval failed",
        );
        return null;
      }
    },
    [isElectron],
  );

  // Get table columns
  const getColumns = useCallback(
    async (
      connectionId: string,
      tableName: string,
    ): Promise<ColumnInfo[] | null> => {
      if (!isElectron) return null;

      try {
        const result = await window.electronAPI.database.getColumns({
          connectionId,
          tableName,
        });

        if (result.success) {
          return result.data;
        } else {
          setError(result.error || "Failed to get columns");
          return null;
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Columns retrieval failed",
        );
        return null;
      }
    },
    [isElectron],
  );

  // Test connection
  const testConnection = useCallback(
    async (
      config: DatabaseConfig,
    ): Promise<{ success: boolean; testTime?: number; error?: string }> => {
      if (!isElectron) {
        return {
          success: false,
          error: "Connection testing is only available in the Electron app",
        };
      }

      try {
        const result = await window.electronAPI.database.testConnection(config);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Connection test failed";
        return { success: false, error: errorMessage };
      }
    },
    [isElectron],
  );

  // Delete stored connection
  const deleteStoredConnection = useCallback(
    async (
      connectionId: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!isElectron) {
        return {
          success: false,
          error: "This operation is only available in the Electron app",
        };
      }

      try {
        const result =
          await window.electronAPI.database.deleteStoredConnection(
            connectionId,
          );

        if (result.success) {
          await loadStoredConnections();
          await loadActiveConnections();
        }

        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete connection";
        return { success: false, error: errorMessage };
      }
    },
    [isElectron, loadStoredConnections, loadActiveConnections],
  );

  // Get connection info
  const getConnectionInfo = useCallback(
    async (connectionId: string) => {
      if (!isElectron) return null;

      try {
        const result =
          await window.electronAPI.database.getConnectionInfo(connectionId);

        if (result.success) {
          return result.data;
        } else {
          setError(result.error || "Failed to get connection info");
          return null;
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Connection info retrieval failed",
        );
        return null;
      }
    },
    [isElectron],
  );

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialize on mount
  useEffect(() => {
    if (isElectron) {
      loadStoredConnections();
      loadActiveConnections();
    }
  }, [isElectron, loadStoredConnections, loadActiveConnections]);

  return {
    // State
    isElectron,
    connections,
    activeConnections,
    isLoading,
    error,

    // Actions
    connect,
    disconnect,
    executeQuery,
    getSchema,
    getTables,
    getColumns,
    testConnection,
    deleteStoredConnection,
    getConnectionInfo,
    loadStoredConnections,
    loadActiveConnections,
    clearError,
  };
};
