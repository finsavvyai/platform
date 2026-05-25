/**
 * Database adapter types for QueryFlux Electron
 * Based on postgres-docker adapter patterns
 */

export enum DatabaseType {
  // SQL Databases
  POSTGRESQL = "postgresql",
  MYSQL = "mysql",
  MARIADB = "mariadb",
  SQLITE = "sqlite",
  SQLSERVER = "sqlserver",
  ORACLE = "oracle",
  COCKROACHDB = "cockroachdb",

  // NoSQL Databases
  MONGODB = "mongodb",
  CASSANDRA = "cassandra",
  COUCHDB = "couchdb",
  NEO4J = "neo4j",
  ARANGODB = "arangodb",
  SCYLLADB = "scylladb",

  // Cache & In-Memory
  REDIS = "redis",
  MEMCACHED = "memcached",

  // Time Series
  INFLUXDB = "influxdb",
  TIMESCALEDB = "timescaledb",
  QUESTDB = "questdb",

  // Cloud Services
  SUPABASE = "supabase",
  PLANETSCALE = "planetscale",
  NEON = "neon",
  SNOWFLAKE = "snowflake",
  BIGQUERY = "bigquery",
  FIREBOLT = "firebolt",

  // AWS Services
  RDS = "rds",
  AURORA = "aurora",
  REDSHIFT = "redshift",
  DYNAMODB = "dynamodb",
  DOCUMENTDB = "documentdb",
  ELASTICACHE = "elasticache",
  NEPTUNE = "neptune",
  KEYSPACES = "keyspaces",
  TIMESTREAM = "timestream",
  ATHENA = "athena",
  OPENSEARCH = "opensearch",

  // Search Engines
  ELASTICSEARCH = "elasticsearch",
  SOLR = "solr",
  TYPESENSE = "typesense",

  // NewSQL
  YUGABYTEDB = "yugabytedb",
  TIDB = "tidb"
}

export enum QueryType {
  FIND = "find",
  INSERT = "insert",
  UPDATE = "update",
  DELETE = "delete",
  AGGREGATE = "aggregate",
  INDEX = "index",
  SELECT = "select",
  CREATE = "create",
  DROP = "drop",
  ALTER = "alter",
  CUSTOM = "custom",
}

export interface ConnectionParams {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: string;
  authDatabase?: string;
  ssl?: boolean;
  additionalParams?: Record<string, any>;
  connectionString?: string;
}

export interface DatabaseInfo {
  name: string;
  dbType: DatabaseType;
  host: string;
  port: number;
  version?: string;
  sizeBytes?: number;
  collectionsCount?: number;
  documentsCount?: number;
  tablesCount?: number;
  metadata: Record<string, any>;
}

export interface CollectionInfo {
  name: string;
  documentCount?: number;
  rowCount?: number;
  sizeBytes: number;
  indexes: Array<Record<string, any>>;
  schemaSample?: Record<string, any>;
  columns?: Array<Record<string, any>>;
  metadata: Record<string, any>;
}

export interface QueryResult {
  success: boolean;
  data: Array<Record<string, any>>;
  totalCount?: number;
  executionTime: number;
  queryType?: QueryType;
  errorMessage?: string;
  metadata: Record<string, any>;
  affectedRows?: number;
  fields?: Array<Record<string, any>>;
}

export interface PerformanceStats {
  connected: boolean;
  connectionTime?: Date;
  adapterType: string;
  responseTime?: number;
  memoryUsage?: number;
  activeConnections?: number;
}

export interface QuerySuggestion {
  text: string;
  description?: string;
  type: "keyword" | "table" | "column" | "function" | "snippet";
}

export interface HealthMetrics {
  status: "connected" | "disconnected" | "error" | "warning";
  responseTime: number;
  memoryUsage?: number;
  diskUsage?: number;
  cpuUsage?: number;
  connections?: number;
  errorRate?: number;
}

export interface IndexInfo {
  name: string;
  type: string;
  fields: string[];
  unique: boolean;
  size?: number;
  metadata?: Record<string, any>;
}

export interface FieldAnalysis {
  name: string;
  type: string;
  nullRatio: number;
  presenceRatio: number;
  distinctCount?: number;
  averageLength?: number;
  minValue?: any;
  maxValue?: any;
}

export interface CollectionAnalysis {
  collection: string;
  sampleSize: number;
  totalFields: number;
  fieldAnalysis: Record<string, FieldAnalysis>;
  mostCommonFields: Array<{ name: string; count: number }>;
  dataPatterns: Record<string, any>;
}

// Error types
export class DatabaseError extends Error {
  constructor(
    message: string,
    public dbType: DatabaseType,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class ConnectionError extends DatabaseError {
  constructor(message: string, dbType: DatabaseType, originalError?: Error) {
    super(`Connection failed: ${message}`, dbType, originalError);
    this.name = "ConnectionError";
  }
}

export class QueryError extends DatabaseError {
  constructor(
    message: string,
    dbType: DatabaseType,
    public query?: string,
    originalError?: Error,
  ) {
    super(`Query failed: ${message}`, dbType, originalError);
    this.name = "QueryError";
    this.query = query;
  }
}

// Base adapter interface
export interface IDatabaseAdapter {
  readonly dbType: DatabaseType;
  readonly connected: boolean;
  readonly connectionInfo: ConnectionParams;

  // Core connection methods
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  testConnection(): Promise<Record<string, any>>;

  // Database information methods
  getDatabaseInfo(): Promise<DatabaseInfo>;
  listCollections(): Promise<CollectionInfo[]>;
  getCollectionInfo(collectionName: string): Promise<CollectionInfo>;

  // Query execution methods
  executeQuery(
    query: string,
    collection?: string,
    limit?: number,
  ): Promise<QueryResult>;
  executeQuerySafe(
    query: string,
    collection?: string,
    limit?: number,
  ): Promise<QueryResult>;

  // Data sampling methods
  getSampleDocuments(
    collection: string,
    limit?: number,
  ): Promise<Array<Record<string, any>>>;
  getSampleRows(
    table: string,
    limit?: number,
  ): Promise<Array<Record<string, any>>>;

  // Optional methods with default implementations
  getPerformanceStats(): Promise<PerformanceStats>;
  validateQuery(
    query: string,
  ): Promise<{ valid: boolean; warnings: string[]; suggestions: string[] }>;
  explainQuery(
    query: string,
    collection?: string,
  ): Promise<Record<string, any>>;
  getQuerySuggestions(
    partialQuery: string,
    context?: Record<string, any>,
  ): Promise<QuerySuggestion[]>;
  getHealthMetrics(): Promise<HealthMetrics>;
  analyzeCollection(
    collection: string,
    sampleSize?: number,
  ): Promise<CollectionAnalysis>;

  // Index management (optional)
  createIndex(
    collection: string,
    fields: string[],
    options?: Record<string, any>,
  ): Promise<boolean>;
  dropIndex(collection: string, indexName: string): Promise<boolean>;
  listIndexes(collection: string): Promise<IndexInfo[]>;

  // Utility methods
  formatError(error: Error): string;
  measureExecutionTime<T>(
    fn: () => Promise<T>,
  ): Promise<{ result: T; executionTime: number }>;
}

// Event types for real-time updates
export interface DatabaseEvent {
  type: "connected" | "disconnected" | "query" | "error" | "warning";
  timestamp: Date;
  data?: any;
  error?: Error;
}

export interface IEventEmitter {
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

// Connection pool interface
export interface IConnectionPool {
  readonly size: number;
  readonly available: number;
  readonly active: number;

  getConnection(): Promise<IDatabaseAdapter>;
  releaseConnection(adapter: IDatabaseAdapter): Promise<void>;
  healthCheck(): Promise<boolean>;
  close(): Promise<void>;
}

// Export types for external modules
export type {
  ConnectionParams as DatabaseConnectionConfig,
  QueryResult as DatabaseQueryResult,
  DatabaseInfo as DatabaseMetadata,
  CollectionInfo as CollectionMetadata,
};
