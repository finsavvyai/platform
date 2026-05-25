// Database adapter types and interfaces

export interface ConnectionConfig {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  passwordEncrypted?: boolean;
  ssl?: boolean;
  sslOptions?: any;
  timeout?: number;
  idleTimeout?: number;
  maxConnections?: number;
  minConnections?: number;
  sslKey?: string;
  sslKeyEncrypted?: boolean;
  options?: any;
}

export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields: FieldInfo[];
  duration: number;
  success: boolean;
  error?: string;
}

export interface FieldInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  length?: number;
  precision?: number;
  scale?: number;
}

export interface SchemaInfo {
  database: string;
  tables: TableInfo[];
  views: ViewInfo[];
  functions: FunctionInfo[];
  procedures: ProcedureInfo[];
}

export interface TableInfo {
  name: string;
  type: 'table' | 'view';
  columns: ColumnInfo[];
  primaryKey: string[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  length?: number;
  precision?: number;
  scale?: number;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

export interface ForeignKeyInfo {
  name: string;
  column: string;
  referencesTable: string;
  referencesColumn: string;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  type?: string;
  definition?: string;
}

export interface ViewInfo {
  name: string;
  definition: string;
  columns: ColumnInfo[];
}

export interface FunctionInfo {
  name: string;
  parameters: any[];
  returnType: string;
  language: string;
  definition: string;
}

export interface ProcedureInfo {
  name: string;
  parameters: any[];
  definition: string;
}

export interface DatabaseAdapter {
  connect(config: ConnectionConfig): Promise<any>;
  disconnect(): Promise<void>;
  executeQuery(query: string, params?: any[]): Promise<QueryResult>;
  testConnection(config: ConnectionConfig): Promise<boolean>;
  getSchema(): Promise<SchemaInfo>;
}

export interface AdapterFactory {
  create(type: string): DatabaseAdapter;
  getSupportedTypes(): string[];
}
