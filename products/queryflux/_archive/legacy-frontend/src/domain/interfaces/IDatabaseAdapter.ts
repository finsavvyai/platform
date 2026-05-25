import { QueryResult, TableInfo, ColumnInfo } from '../entities/Query';
import { DatabaseType } from '../../types/database';

/**
 * Interface: Database Adapter
 * Defines contract for all database adapters
 */
export interface IDatabaseAdapter {
  // Adapter metadata
  readonly type: DatabaseType;
  readonly version: string;
  readonly capabilities: AdapterCapabilities;

  // Lifecycle
  initialize(config: AdapterConfig): void;
  connect(connectionConfig: DatabaseConnectionConfig): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  testConnection(connectionConfig: DatabaseConnectionConfig): Promise<TestResult>;

  // Query operations
  executeQuery(sql: string, params?: any[]): Promise<QueryResult>;
  executeBatch(queries: BatchQuery[]): Promise<BatchResult>;
  prepareStatement(sql: string): Promise<PreparedStatement>;

  // Transaction operations
  beginTransaction(): Promise<Transaction>;
  commitTransaction(transaction: Transaction): Promise<void>;
  rollbackTransaction(transaction: Transaction): Promise<void>;

  // Schema operations
  getSchema(): Promise<DatabaseSchema>;
  getTables(filter?: string): Promise<TableInfo[]>;
  getColumns(table: string): Promise<ColumnInfo[]>;
  getIndexes(table: string): Promise<IndexInfo[]>;
  getConstraints(table: string): Promise<ConstraintInfo[]>;
  getViews(): Promise<ViewInfo[]>;
  getProcedures(): Promise<ProcedureInfo[]>;
  getFunctions(): Promise<FunctionInfo[]>;

  // Utility operations
  escapeIdentifier(identifier: string): string;
  escapeLiteral(literal: string): string;
  buildLimitClause(limit: number, offset?: number): string;
  parseConnectionString(connectionString: string): DatabaseConnectionConfig;

  // Event handling
  on(event: AdapterEvent, listener: AdapterEventListener): void;
  off(event: AdapterEvent, listener: AdapterEventListener): void;
  emit(event: AdapterEvent, data: any): void;

  // Health and monitoring
  healthCheck(): Promise<HealthCheckResult>;
  getConnectionInfo(): Promise<ConnectionInfo>;
  getServerVersion(): Promise<string>;
  getStatistics(): Promise<AdapterStatistics>;
}

/**
 * DTO: Adapter Capabilities
 */
export interface AdapterCapabilities {
  supportsTransactions: boolean;
  supportsSavepoints: boolean;
  supportsPreparedStatements: boolean;
  supportsBatchQueries: boolean;
  supportsMultipleResultSets: boolean;
  supportsStreaming: boolean;
  supportsAsync: boolean;
  supportsSSL: boolean;
  supportsConnectionPooling: boolean;
  supportsCursor: boolean;
  supportsLargeObjects: boolean;
  maxConnections: number;
  maxQueryLength: number;
  maxParameters: number;
  supportedDataTypes: string[];
  reservedWords: string[];
}

/**
 * DTO: Adapter Configuration
 */
export interface AdapterConfig {
  type: DatabaseType;
  features: string[];
  limitations: string[];
  defaultOptions: Record<string, any>;
}

/**
 * DTO: Database Connection Configuration
 */
export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: SSLConfig;
  connectionString?: string;
  options?: Record<string, any>;
}

/**
 * DTO: SSL Configuration
 */
export interface SSLConfig {
  enabled: boolean;
  cert?: string;
  key?: string;
  ca?: string;
  rejectUnauthorized?: boolean;
  checkServerIdentity?: boolean;
}

/**
 * DTO: Connection Result
 */
export interface ConnectionResult {
  success: boolean;
  connectionId?: string;
  serverVersion?: string;
  capabilities?: string[];
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * DTO: Test Result
 */
export interface TestResult {
  success: boolean;
  latency: number;
  serverVersion?: string;
  error?: string;
  warnings?: string[];
}

/**
 * DTO: Batch Query
 */
export interface BatchQuery {
  sql: string;
  params?: any[];
  name?: string;
}

/**
 * DTO: Batch Result
 */
export interface BatchResult {
  success: boolean;
  results: QueryResult[];
  totalAffectedRows: number;
  executionTime: number;
  errors?: string[];
}

/**
 * DTO: Prepared Statement
 */
export interface PreparedStatement {
  execute(params?: any[]): Promise<QueryResult>;
  close(): Promise<void>;
  name?: string;
  parameterCount: number;
}

/**
 * DTO: Transaction
 */
export interface Transaction {
  id: string;
  isActive: boolean;
  savepoint(name: string): Promise<void>;
  rollbackToSavepoint(name: string): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/**
 * DTO: Database Schema
 */
export interface DatabaseSchema {
  name: string;
  version?: string;
  tables: TableInfo[];
  views: ViewInfo[];
  procedures: ProcedureInfo[];
  functions: FunctionInfo[];
  triggers: TriggerInfo[];
  sequences: SequenceInfo[];
}

/**
 * DTO: Index Information
 */
export interface IndexInfo {
  name: string;
  tableName: string;
  columns: string[];
  unique: boolean;
  primary: boolean;
  type: string;
  filter?: string;
  definition?: string;
}

/**
 * DTO: Constraint Information
 */
export interface ConstraintInfo {
  name: string;
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK' | 'NOT NULL';
  tableName: string;
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
  checkExpression?: string;
  deferrable?: boolean;
  initiallyDeferred?: boolean;
}

/**
 * DTO: View Information
 */
export interface ViewInfo {
  name: string;
  schema: string;
  definition: string;
  columns: ColumnInfo[];
  checkOption?: 'CASCADED' | 'LOCAL';
  isUpdatable: boolean;
  isInsertableInto: boolean;
  isTriggerUpdatable: boolean;
  isTriggerDeletable: boolean;
  isTriggerInsertableInto: boolean;
}

/**
 * DTO: Procedure Information
 */
export interface ProcedureInfo {
  name: string;
  schema: string;
  parameters: ProcedureParameter[];
  returnType?: string;
  language?: string;
  securityType?: string;
  definition?: string;
}

/**
 * DTO: Function Information
 */
export interface FunctionInfo {
  name: string;
  schema: string;
  parameters: ProcedureParameter[];
  returnType: string;
  language?: string;
  volatility?: 'IMMUTABLE' | 'STABLE' | 'VOLATILE';
  strict?: boolean;
  securityDefiner?: boolean;
  definition?: string;
}

/**
 * DTO: Procedure Parameter
 */
export interface ProcedureParameter {
  name: string;
  type: string;
  mode: 'IN' | 'OUT' | 'INOUT';
  defaultValue?: any;
}

/**
 * DTO: Trigger Information
 */
export interface TriggerInfo {
  name: string;
  tableName: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
  functionName: string;
  enabled: boolean;
  definition?: string;
}

/**
 * DTO: Sequence Information
 */
export interface SequenceInfo {
  name: string;
  schema: string;
  startValue: number;
  increment: number;
  minValue?: number;
  maxValue?: number;
  currentValue?: number;
  isCycled: boolean;
}

/**
 * DTO: Adapter Events
 */
export type AdapterEvent =
  | 'connected'
  | 'disconnected'
  | 'query-started'
  | 'query-completed'
  | 'query-error'
  | 'transaction-started'
  | 'transaction-completed'
  | 'transaction-failed'
  | 'connection-pool-created'
  | 'connection-pool-destroyed'
  | 'connection-acquired'
  | 'connection-released'
  | 'error';

/**
 * Type: Event Listener
 */
export type AdapterEventListener = (data: any) => void;

/**
 * DTO: Health Check Result
 */
export interface HealthCheckResult {
  healthy: boolean;
  latency: number;
  connections: {
    active: number;
    idle: number;
    total: number;
  };
  serverInfo: {
    version?: string;
    uptime?: number;
    memoryUsage?: number;
  };
  errors?: string[];
  warnings?: string[];
}

/**
 * DTO: Connection Information
 */
export interface ConnectionInfo {
  connectionId: string;
  connectedAt: Date;
  serverVersion: string;
  databaseName: string;
  userName: string;
  clientInfo: Record<string, any>;
  sessionParameters: Record<string, any>;
}

/**
 * DTO: Adapter Statistics
 */
export interface AdapterStatistics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  totalTransactions: number;
  averageQueryTime: number;
  slowQueries: number;
  connectionsCreated: number;
  connectionsClosed: number;
  peakConnections: number;
  bytesReceived: number;
  bytesSent: number;
  uptime: number;
  memoryUsage: number;
}

/**
 * Strategy Pattern: Query Builder Strategy
 */
export interface IQueryBuilder {
  select(columns: string[]): IQueryBuilder;
  from(table: string): IQueryBuilder;
  where(condition: string, params?: any[]): IQueryBuilder;
  join(table: string, condition: string): IQueryBuilder;
  groupBy(columns: string[]): IQueryBuilder;
  having(condition: string, params?: any[]): IQueryBuilder;
  orderBy(columns: string[], direction?: 'ASC' | 'DESC'): IQueryBuilder;
  limit(count: number, offset?: number): IQueryBuilder;
  build(): string;
  getParameters(): any[];
}

/**
 * Abstract Database Adapter (Base implementation)
 */
export abstract class BaseDatabaseAdapter implements IDatabaseAdapter {
  public abstract readonly type: DatabaseType;
  public abstract readonly version: string;
  public abstract capabilities: AdapterCapabilities;

  protected config: AdapterConfig;
  protected eventListeners = new Map<AdapterEvent, Set<AdapterEventListener>>();
  protected connection?: any;

  initialize(config: AdapterConfig): void {
    this.config = config;
  }

  abstract connect(connectionConfig: DatabaseConnectionConfig): Promise<ConnectionResult>;
  abstract disconnect(): Promise<void>;
  abstract testConnection(connectionConfig: DatabaseConnectionConfig): Promise<TestResult>;
  abstract executeQuery(sql: string, params?: any[]): Promise<QueryResult>;
  abstract executeBatch(queries: BatchQuery[]): Promise<BatchResult>;
  abstract prepareStatement(sql: string): Promise<PreparedStatement>;
  abstract beginTransaction(): Promise<Transaction>;
  abstract commitTransaction(transaction: Transaction): Promise<void>;
  abstract rollbackTransaction(transaction: Transaction): Promise<void>;
  abstract getSchema(): Promise<DatabaseSchema>;
  abstract getTables(filter?: string): Promise<TableInfo[]>;
  abstract getColumns(table: string): Promise<ColumnInfo[]>;
  abstract getIndexes(table: string): Promise<IndexInfo[]>;
  abstract getConstraints(table: string): Promise<ConstraintInfo[]>;
  abstract getViews(): Promise<ViewInfo[]>;
  abstract getProcedures(): Promise<ProcedureInfo[]>;
  abstract getFunctions(): Promise<FunctionInfo[]>;
  abstract escapeIdentifier(identifier: string): string;
  abstract escapeLiteral(literal: string): string;
  abstract parseConnectionString(connectionString: string): DatabaseConnectionConfig;

  // Default implementations
  buildLimitClause(limit: number, offset?: number): string {
    let clause = `LIMIT ${limit}`;
    if (offset !== undefined) {
      clause += ` OFFSET ${offset}`;
    }
    return clause;
  }

  on(event: AdapterEvent, listener: AdapterEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  off(event: AdapterEvent, listener: AdapterEventListener): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  emit(event: AdapterEvent, data: any): void {
    this.eventListeners.get(event)?.forEach(listener => listener(data));
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      await this.executeQuery('SELECT 1');
      return {
        healthy: true,
        latency: Date.now() - startTime,
        connections: {
          active: 1,
          idle: 0,
          total: 1
        },
        serverInfo: {
          version: await this.getServerVersion(),
          uptime: 0
        }
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        connections: {
          active: 0,
          idle: 0,
          total: 0
        },
        serverInfo: {},
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async getConnectionInfo(): Promise<ConnectionInfo> {
    return {
      connectionId: 'unknown',
      connectedAt: new Date(),
      serverVersion: await this.getServerVersion(),
      databaseName: 'unknown',
      userName: 'unknown',
      clientInfo: {},
      sessionParameters: {}
    };
  }

  async getServerVersion(): Promise<string> {
    return this.version;
  }

  async getStatistics(): Promise<AdapterStatistics> {
    return {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      totalTransactions: 0,
      averageQueryTime: 0,
      slowQueries: 0,
      connectionsCreated: 0,
      connectionsClosed: 0,
      peakConnections: 0,
      bytesReceived: 0,
      bytesSent: 0,
      uptime: 0,
      memoryUsage: 0
    };
  }
}
