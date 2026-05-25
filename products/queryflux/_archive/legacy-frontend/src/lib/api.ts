// API client for backend communication

import { databaseService } from "./database/databaseService";
import { supabase } from "./supabase";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8081/api/v1";

export interface DatabaseConnection {
  dbType: "postgresql" | "mysql" | "mongodb";
  name?: string;
  connectionConfig: {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    ssl?: boolean;
    uri?: string;
  };
}

export interface QueryResult {
  success: boolean;
  data: any[];
  columns: Array<{ name: string; type: string }>;
  rowCount: number;
  executionTime?: number;
  message: string;
  error?: string;
}

export interface DatabaseSchema {
  databaseName: string;
  version: string;
  tables: Array<{
    name: string;
    schema: string;
    type: "table" | "view";
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      defaultValue?: any;
    }>;
    primaryKeys: string[];
    foreignKeys: Record<string, { table: string; column: string }>;
    rowCount: number;
  }>;
}

/**
 * Legacy DatabaseAPI class for backward compatibility
 * @deprecated Use databaseService instead for new features
 */
export class DatabaseAPI {
  private static async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Test database connection - now uses the new database service
  static async testConnection(
    connection: DatabaseConnection,
  ): Promise<{ success: boolean; message: string; latency?: number }> {
    try {
      // Try the new database service first
      const result = await databaseService.testConnection(connection);
      return result;
    } catch (error) {
      // Fallback to backend API if available
      try {
        const result = await this.request("/database/connect", {
          method: "POST",
          body: JSON.stringify(connection),
        });
        return result;
      } catch (fallbackError) {
        return {
          success: false,
          message: error instanceof Error ? error.message : "Connection failed",
        };
      }
    }
  }

  // Execute SQL query - now uses the new database service
  static async executeQuery(
    connection: DatabaseConnection,
    query: string,
    connectionId?: string,
  ): Promise<QueryResult> {
    try {
      // If we have a connectionId, use the new database service
      if (connectionId) {
        const result = await databaseService.executeQuery({
          connectionId,
          query,
          options: {
            maxRows: 10000, // Prevent result overload
            timeout: 30000, // 30 second timeout
          },
        });

        return {
          success: result.success,
          data: result.data || [],
          columns: result.columns || [],
          rowCount: result.rowCount || 0,
          executionTime: result.executionTime,
          message: result.message,
          error: result.error,
        };
      }

      // Fallback to backend API for legacy connections
      const result = await this.request("/database/query", {
        method: "POST",
        body: JSON.stringify({
          ...connection,
          query,
        }),
      });

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      return {
        success: false,
        data: [],
        columns: [],
        rowCount: 0,
        message:
          error instanceof Error ? error.message : "Query execution failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Get database schema - now uses the new database service
  static async getSchema(
    connection: DatabaseConnection,
    connectionId?: string,
  ): Promise<DatabaseSchema> {
    try {
      // If we have a connectionId, use the new database service
      if (connectionId) {
        const result = await databaseService.getSchema(connectionId);
        if (result.success && result.schema) {
          return result.schema;
        }
        throw new Error(result.message);
      }

      // Fallback to backend API for legacy connections
      const result = await this.request("/database/schema", {
        method: "POST",
        body: JSON.stringify(connection),
      });

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Failed to retrieve schema",
      );
    }
  }

  // Create a new connection using the new database service
  static async createConnection(
    connection: DatabaseConnection,
  ): Promise<{ success: boolean; connectionId?: string; message: string }> {
    try {
      return await databaseService.createConnection(connection);
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to create connection",
      };
    }
  }

  // Get user's connections
  static async getUserConnections(): Promise<{
    success: boolean;
    connections?: any[];
    message: string;
  }> {
    try {
      return await databaseService.getUserConnections();
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to retrieve connections",
      };
    }
  }

  // Close a connection
  static async closeConnection(
    connectionId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      return await databaseService.closeConnection(connectionId);
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to close connection",
      };
    }
  }
}

// Export a simple wrapper for use in components
export const databaseAPI = {
  testConnection: DatabaseAPI.testConnection,
  executeQuery: DatabaseAPI.executeQuery,
  getSchema: DatabaseAPI.getSchema,
  createConnection: DatabaseAPI.createConnection,
  getUserConnections: DatabaseAPI.getUserConnections,
  closeConnection: DatabaseAPI.closeConnection,
};

// Export the new database service for advanced usage
export { databaseService };
