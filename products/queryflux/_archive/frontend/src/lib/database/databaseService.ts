/**
 * Database Service
 *
 * High-level service that provides a secure API for database operations.
 * Handles authentication, authorization, and security concerns.
 */

import { connectionManager } from './connectionManager';
import { supabase } from '../lib/supabase';
import { DatabaseConnection, QueryResult } from '../lib/api';

export interface SecureQueryRequest {
  connectionId: string;
  query: string;
  params?: any[];
  options?: {
    timeout?: number;
    maxRows?: number;
    readOnly?: boolean;
  };
}

export interface QueryExecutionResult {
  success: boolean;
  data?: any[];
  columns?: Array<{ name: string; type: string }>;
  rowCount?: number;
  executionTime?: number;
  message: string;
  error?: string;
}

export class DatabaseService {
  private static instance: DatabaseService;
  private queryTimeout: number = 30000; // 30 seconds
  private maxQueryRows: number = 10000; // Prevent result set overload

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Test a new database connection without persisting it
   */
  async testConnection(connectionData: Partial<DatabaseConnection>): Promise<{ success: boolean; message: string; latency?: number }> {
    try {
      // Validate connection data
      const validation = this.validateConnectionData(connectionData);
      if (!validation.valid) {
        return {
          success: false,
          message: validation.error || 'Invalid connection data',
        };
      }

      // Create a temporary connection object for testing
      const tempConnection = {
        id: 'test-' + Date.now(),
        user_id: '', // Will be filled by auth
        name: 'Test Connection',
        database_type: connectionData.dbType!,
        host: connectionData.connectionConfig?.host,
        port: connectionData.connectionConfig?.port,
        database_name: connectionData.connectionConfig?.database,
        username: connectionData.connectionConfig?.user,
        password: connectionData.connectionConfig?.password,
        ssl_enabled: connectionData.connectionConfig?.ssl || false,
        connection_url: connectionData.connectionConfig?.uri,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return await connectionManager.testConnection(tempConnection);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Create and persist a new database connection
   */
  async createConnection(connectionData: Partial<DatabaseConnection>): Promise<{ success: boolean; connectionId?: string; message: string }> {
    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          message: 'Authentication required to create connections',
        };
      }

      // Validate connection data
      const validation = this.validateConnectionData(connectionData);
      if (!validation.valid) {
        return {
          success: false,
          message: validation.error || 'Invalid connection data',
        };
      }

      // Store connection in Supabase
      const connectionRecord = {
        user_id: user.id,
        name: connectionData.name || 'New Connection',
        database_type: connectionData.dbType!,
        host: connectionData.connectionConfig?.host,
        port: connectionData.connectionConfig?.port,
        database_name: connectionData.connectionConfig?.database,
        username: connectionData.connectionConfig?.user,
        password: connectionData.connectionConfig?.password, // Note: In production, encrypt this
        ssl_enabled: connectionData.connectionConfig?.ssl || false,
        connection_url: connectionData.connectionConfig?.uri,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: savedConnection, error: saveError } = await supabase
        .from('connections')
        .insert(connectionRecord)
        .select()
        .single();

      if (saveError) {
        return {
          success: false,
          message: `Failed to save connection: ${saveError.message}`,
        };
      }

      // Create active connection
      await connectionManager.createConnection(savedConnection);

      return {
        success: true,
        connectionId: savedConnection.id,
        message: 'Connection created successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create connection',
      };
    }
  }

  /**
   * Execute a SQL query securely
   */
  async executeQuery(request: SecureQueryRequest): Promise<QueryExecutionResult> {
    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          message: 'Authentication required',
        };
      }

      // Validate connection ownership
      const connection = await this.validateConnectionOwnership(request.connectionId, user.id);
      if (!connection) {
        return {
          success: false,
          message: 'Connection not found or access denied',
        };
      }

      // Security checks
      const securityCheck = this.performSecurityChecks(request.query, request.options);
      if (!securityCheck.passed) {
        return {
          success: false,
          message: securityCheck.error || 'Query blocked by security policy',
        };
      }

      // Execute query with timeout
      const result = await Promise.race([
        connectionManager.executeQuery(request.connectionId, request.query, request.params),
        this.createTimeoutPromise(request.options?.timeout || this.queryTimeout),
      ]);

      // Limit result rows if specified
      if (request.options?.maxRows && result.data && result.data.length > request.options.maxRows) {
        result.data = result.data.slice(0, request.options.maxRows);
        result.rowCount = result.data.length;
        result.message = `Query executed successfully (results limited to ${request.options.maxRows} rows)`;
      }

      // Log query execution for audit
      await this.logQueryExecution(user.id, request.connectionId, request.query, result.success);

      return {
        success: result.success,
        data: result.data,
        columns: result.columns?.map(col => ({ name: col.name, type: String(col.type) })),
        rowCount: result.rowCount,
        executionTime: result.executionTime,
        message: result.message,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Query execution failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get database schema information
   */
  async getSchema(connectionId: string): Promise<{ success: boolean; schema?: any; message: string }> {
    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          message: 'Authentication required',
        };
      }

      // Validate connection ownership
      const connection = await this.validateConnectionOwnership(connectionId, user.id);
      if (!connection) {
        return {
          success: false,
          message: 'Connection not found or access denied',
        };
      }

      const schema = await connectionManager.getSchema(connectionId);

      return {
        success: true,
        schema,
        message: 'Schema retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve schema',
      };
    }
  }

  /**
   * Get user's connections
   */
  async getUserConnections(): Promise<{ success: boolean; connections?: any[]; message: string }> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          message: 'Authentication required',
        };
      }

      const { data: connections, error } = await supabase
        .from('connections')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        return {
          success: false,
          message: `Failed to fetch connections: ${error.message}`,
        };
      }

      // Mark which connections are currently active
      const activeConnections = connectionManager.getActiveConnections();
      const connectionsWithStatus = connections?.map(conn => ({
        ...conn,
        isActive: activeConnections.some(active => active.id === conn.id),
      })) || [];

      return {
        success: true,
        connections: connectionsWithStatus,
        message: 'Connections retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve connections',
      };
    }
  }

  /**
   * Validate connection data
   */
  private validateConnectionData(connectionData: Partial<DatabaseConnection>): { valid: boolean; error?: string } {
    if (!connectionData.dbType) {
      return { valid: false, error: 'Database type is required' };
    }

    if (!connectionData.name || connectionData.name.trim().length === 0) {
      return { valid: false, error: 'Connection name is required' };
    }

    const config = connectionData.connectionConfig;

    // If using connection URL, validate it
    if (config?.uri) {
      try {
        new URL(config.uri);
      } catch {
        return { valid: false, error: 'Invalid connection URL' };
      }
    } else {
      // Validate individual connection parameters
      if (!config?.host) {
        return { valid: false, error: 'Host is required' };
      }

      if (!config?.database) {
        return { valid: false, error: 'Database name is required' };
      }

      if (!config?.user) {
        return { valid: false, error: 'Username is required' };
      }

      if (!config?.password) {
        return { valid: false, error: 'Password is required' };
      }
    }

    return { valid: true };
  }

  /**
   * Validate that user owns the connection
   */
  private async validateConnectionOwnership(connectionId: string, userId: string): Promise<any> {
    const { data: connection, error } = await supabase
      .from('connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    return error ? null : connection;
  }

  /**
   * Perform security checks on queries
   */
  private performSecurityChecks(query: string, options?: any): { passed: boolean; error?: string } {
    const normalizedQuery = query.toLowerCase().trim();

    // Block dangerous operations unless explicitly allowed
    const dangerousPatterns = [
      /\bdrop\s+(database|table|schema|index|trigger|function|procedure)\b/i,
      /\btruncate\b/i,
      /\balter\s+(database|table|schema|user|role)\b/i,
      /\bcreate\s+(database|table|schema|user|role)\b/i,
      /\bgrant\b/i,
      /\brevoke\b/i,
      /\b(insert\s+into\s+.*\bselect\s+.*\bfrom\s+.*\bunion\b)/i, // UNION-based injection
    ];

    // Allow DDL if not in read-only mode
    if (!options?.readOnly) {
      // Remove DDL from dangerous patterns when not read-only
      dangerousPatterns.splice(0, 4);
    }

    for (const pattern of dangerousPatterns) {
      if (pattern.test(normalizedQuery)) {
        return {
          passed: false,
          error: 'Query contains potentially dangerous operations and has been blocked',
        };
      }
    }

    // Check for common SQL injection patterns
    const injectionPatterns = [
      /(\bor\s+1\s*=\s*1\b)|(\band\s+1\s*=\s*1\b)/i,
      /(\bor\s+true\b)|(\band\s+true\b)/i,
      /(\bxor\s+1\b)/i,
      /(\bwaitfor\s+delay\b)/i,
      /(\bsleep\s*\()/i,
      /(\bbenchmark\s*\()/i,
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(normalizedQuery)) {
        return {
          passed: false,
          error: 'Query contains suspicious patterns and has been blocked',
        };
      }
    }

    return { passed: true };
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs);
    });
  }

  /**
   * Log query execution for audit purposes
   */
  private async logQueryExecution(
    userId: string,
    connectionId: string,
    query: string,
    success: boolean
  ): Promise<void> {
    try {
      await supabase.from('query_history').insert({
        user_id: userId,
        connection_id: connectionId,
        query_text: query.substring(0, 1000), // Limit query length
        executed_at: new Date().toISOString(),
        success,
        execution_time_ms: 0, // Will be updated by the caller
      });
    } catch (error) {
      console.error('Failed to log query execution:', error);
    }
  }

  /**
   * Close a specific connection
   */
  async closeConnection(connectionId: string): Promise<{ success: boolean; message: string }> {
    try {
      await connectionManager.removeConnection(connectionId);
      return {
        success: true,
        message: 'Connection closed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to close connection',
      };
    }
  }

  /**
   * Get connection manager statistics
   */
  getStats(): any {
    return connectionManager.getStats();
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();
