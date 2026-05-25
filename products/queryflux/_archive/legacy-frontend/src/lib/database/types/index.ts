export interface DatabaseConfig {
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'sqlite' | 'sqlserver' | 'oracle' | 'cassandra';
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  connectionString?: string;
  options?: Record<string, any>;
}

export interface DatabaseConnection {
  id: string;
  config: DatabaseConfig;
  client: any;
  type: string;
  connected: boolean;
  connectedAt: Date;
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

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  version?: string;
  latency?: number;
}

export interface DatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  executeQuery(query: string, params?: any[]): Promise<QueryResult>;
  getSchema(): Promise<{ tables: TableInfo[] }>;
  testConnection(): Promise<ConnectionTestResult>;
  isConnected(): boolean;
  getConnectionId(): string;
}
