/**
 * Database type definitions for Questro
 */

export interface DatabaseConfig {
  maxConnections: number;
  connectionTimeout: number;
  queryTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableMetrics: boolean;
  enableCache: boolean;
  cacheTTL: number;
  slowQueryThreshold: number;
}

export interface QueryMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageQueryTime: number;
  slowQueries: number;
  cacheHits: number;
  cacheMisses: number;
  connectionsActive: number;
  connectionsTotal: number;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  latency: number;
  tablesAccessible?: boolean;
  error?: string;
  lastCheck: number;
  metrics?: QueryMetrics;
}

export interface RetryConfig {
  attempts: number;
  delay: number;
  backoffMultiplier: number;
}

export interface TransactionOptions {
  retryAttempts?: number;
  rollbackOnError?: boolean;
  enableMetrics?: boolean;
  timeout?: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  cleanupInterval: number;
}

export type Database = any; // Will be replaced with actual Drizzle type
