/**
 * Base Database Adapter Interface
 *
 * Defines the standard interface that all database adapters must implement.
 * This allows for consistent API across different database types.
 */

export interface QueryResult {
  success: boolean;
  data: any[];
  columns: Array<{
    name: string;
    type: string | number;
    nullable?: boolean;
    defaultValue?: any;
    maxLength?: number;
    precision?: number;
    scale?: number;
  }>;
  rowCount: number;
  executionTime: number;
  affectedRows: number;
  message: string;
  error?: string;
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  maxLength?: number;
  precision?: number;
  scale?: number;
}

export interface TableSchema {
  name: string;
  schema: string;
  type: 'table' | 'view';
  columns: ColumnSchema[];
  primaryKeys: string[];
  foreignKeys: Record<string, { table: string; column: string }>;
  rowCount: number;
}

export interface DatabaseSchema {
  databaseName: string;
  version: string;
  tables: TableSchema[];
  views: TableSchema[];
}

export interface DatabaseAdapter {
  /**
   * Establish connection to the database
   */
  connect(): Promise<void>;

  /**
   * Close database connection
   */
  disconnect(): Promise<void>;

  /**
   * Check if adapter is connected
   */
  isConnectionActive(): boolean;

  /**
   * Execute a query with parameters
   */
  executeQuery(query: string, params?: any[]): Promise<QueryResult>;

  /**
   * Test database connection
   */
  testConnection(): Promise<{ success: boolean; message: string; latency?: number }>;

  /**
   * Get database schema information
   */
  getSchema(): Promise<DatabaseSchema>;
}

export interface ConnectionConfig {
  type: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  connectionString?: string;
  [key: string]: any;
}
