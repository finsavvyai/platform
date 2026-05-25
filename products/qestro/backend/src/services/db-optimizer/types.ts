/**
 * Database Optimization Types and Interfaces
 *
 * Defines types for query profiling, performance analysis,
 * and connection pool monitoring.
 */

/**
 * Profile data for a single database query
 */
export interface QueryProfile {
  queryId: string;
  sql: string;
  parameters: unknown[];
  durationMs: number;
  rowsAffected: number;
  rowsScanned?: number;
  indexUsed?: string;
  executedAt: number;
  user?: string;
  connectionId?: string;
  planAnalysis?: QueryPlanAnalysis;
}

/**
 * Slow query tracking and analysis
 */
export interface SlowQuery {
  queryHash: string;
  sql: string;
  count: number;
  totalDurationMs: number;
  averageDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
  lastExecutedAt: number;
  examples: QueryProfile[];
  isN1Query?: boolean;
  fullTableScan?: boolean;
  suggestedFixes?: string[];
}

/**
 * Index optimization suggestion
 */
export interface IndexSuggestion {
  table: string;
  columns: string[];
  type: 'composite' | 'simple' | 'partial';
  estimatedImpact: number; // 0-100, improvement potential
  reason: string;
  frequency: number; // how many slow queries would benefit
  estimatedSizeMB: number;
  createStatement: string;
}

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  min: number;
  max: number;
  idleTimeoutMs: number;
  acquireTimeoutMs: number;
  validationQuery: string;
}

/**
 * Query execution plan analysis
 */
export interface QueryPlanAnalysis {
  planType: string;
  estimatedRows: number;
  actualRows: number;
  indexUsage: Array<{ indexName: string; used: boolean }>;
  warnings: string[];
  recommendations: string[];
  sequentialScanDetected: boolean;
}

/**
 * Query statistics and trends
 */
export interface QueryStats {
  totalQueries: number;
  uniqueQueries: number;
  totalDurationMs: number;
  averageDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  slowQueriesCount: number;
  slowQueriesThresholdMs: number;
  n1QueriesDetected: number;
  fullTableScans: number;
  topQueries: Array<{ sql: string; count: number; totalDurationMs: number }>;
}

/**
 * Connection pool metrics
 */
export interface PoolMetrics {
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalSize: number;
  utilizationPercent: number;
  avgWaitTimeMs: number;
  maxWaitTimeMs: number;
  timeoutCount: number;
  timeoutRate: number;
  createdConnections: number;
  failedConnections: number;
}

/**
 * Pool health status
 */
export interface PoolHealth {
  isHealthy: boolean;
  utilizationPercent: number;
  avgWaitTimeMs: number;
  timeoutRate: number;
  alerts: PoolAlert[];
  recommendations: string[];
}

/**
 * Health check alert
 */
export interface PoolAlert {
  severity: 'warning' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  suggestedAction: string;
}

/**
 * Cache invalidation pattern
 */
export interface CacheInvalidationRule {
  table: string;
  relatedTables?: string[];
  invalidatePattern: 'exact' | 'prefix' | 'regex';
}
