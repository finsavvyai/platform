/**
 * Database Service Module for Claude Agent Platform
 *
 * Provides comprehensive database management with:
 * - Prisma ORM integration
 * - Migration management
 * - Connection pooling and health monitoring
 * - Seed data management
 * - Transaction support
 */

export { DatabaseService } from './database-service';
export { SeedDataManager } from './migrations/seed-data';
export { MigrationManager } from './migrations/migration-manager';
export {
  DatabaseConfig,
  ConnectionConfig,
  HealthCheckResult,
  QueryMetrics,
  TransactionOptions
} from './interfaces';

/**
 * Default database configuration
 */
export const DEFAULT_DATABASE_CONFIG = {
  url: process.env.DATABASE_URL || 'postgresql://claude_user:claude_password@localhost:5432/claude_agent',
  connectionLimit: parseInt(process.env.DATABASE_POOL_SIZE || '20'),
  connectionTimeoutMillis: parseInt(process.env.DATABASE_TIMEOUT || '30000'),
  idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000'),
  maxLifetimeMillis: parseInt(process.env.DATABASE_MAX_LIFETIME || '1800000'),
  healthCheckInterval: parseInt(process.env.DATABASE_HEALTH_CHECK_INTERVAL || '30000'),
  ssl: process.env.DATABASE_SSL === 'true' ? {
    rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
  } : false,
  logging: process.env.NODE_ENV === 'development' ? {
    level: 'query',
    emit: 'event',
  } : false,
} as const;

/**
 * Database health check thresholds
 */
export const HEALTH_CHECK_THRESHOLDS = {
  responseTime: 1000, // milliseconds
  connectionPoolUtilization: 0.8, // 80%
  errorRate: 0.05, // 5%
  slowQueryThreshold: 5000, // milliseconds
} as const;
