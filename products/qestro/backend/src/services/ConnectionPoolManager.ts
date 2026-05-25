import { Pool } from 'pg';
import type { PoolClient, PoolConfig } from 'pg';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import type { Db, MongoClientOptions } from 'mongodb';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

export interface ConnectionConfig {
  id: string;
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'sqlite';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  acquireTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  healthCheckInterval?: number;
  connectionString?: string;
  additionalConfig?: Record<string, any>;
}

export interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingCount: number;
  acquiredCount: number;
  createdCount: number;
  destroyedCount: number;
  timeouts: number;
  errors: number;
  lastError?: string;
  lastErrorTime?: Date;
}

export interface HealthCheckResult {
  connectionId: string;
  healthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: Date;
}

export class ConnectionPoolManager extends EventEmitter {
  private pools: Map<string, any> = new Map();
  public configs: Map<string, ConnectionConfig> = new Map();
  private metrics: Map<string, PoolMetrics> = new Map();
  private healthChecks: Map<string, NodeJS.Timeout> = new Map();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  async createPool(config: ConnectionConfig): Promise<void> {
    try {
      logger.info(`Creating connection pool for ${config.type} database: ${config.id}`);

      // Store configuration
      this.configs.set(config.id, config);

      // Initialize metrics
      this.initializeMetrics(config.id);

      let pool: any;

      switch (config.type) {
        case 'postgresql':
          pool = await this.createPostgreSQLPool(config);
          break;

        case 'mysql':
          pool = await this.createMySQLPool(config);
          break;

        case 'mongodb':
          pool = await this.createMongoDBPool(config);
          break;

        case 'redis':
          pool = await this.createRedisPool(config);
          break;

        case 'sqlite':
          pool = await this.createSQLitePool(config);
          break;

        default:
          throw new Error(`Unsupported database type: ${config.type}`);
      }

      // Store pool
      this.pools.set(config.id, pool);

      // Start health monitoring
      this.startHealthMonitoring(config.id);

      // Set up pool event listeners
      this.setupPoolEventListeners(config.id, pool);

      logger.info(`Connection pool created successfully for ${config.id}`);
      this.emit('poolCreated', { connectionId: config.id, type: config.type });

    } catch (error) {
      logger.error(`Failed to create connection pool for ${config.id}:`, error);
      this.updateMetrics(config.id, 'errors');
      this.emit('poolError', { connectionId: config.id, error: error.message });

      // Schedule retry if configured
      this.scheduleRetry(config);
      throw error;
    }
  }

  async getConnection(connectionId: string): Promise<any> {
    const pool = this.pools.get(connectionId);
    const config = this.configs.get(connectionId);

    if (!pool || !config) {
      throw new Error(`Connection pool ${connectionId} not found`);
    }

    const startTime = performance.now();

    try {
      let connection: any;

      switch (config.type) {
        case 'postgresql':
          connection = await pool.connect();
          break;

        case 'mysql':
          connection = await pool.getConnection();
          break;

        case 'mongodb':
          connection = pool; // MongoDB pool is the database instance
          break;

        case 'redis':
          connection = pool; // Redis client is the connection
          break;

        case 'sqlite':
          connection = pool; // SQLite pool manages connections internally
          break;

        default:
          throw new Error(`Unsupported database type: ${config.type}`);
      }

      this.updateMetrics(connectionId, 'acquiredCount');

      const responseTime = performance.now() - startTime;
      logger.debug(`Acquired connection for ${connectionId} in ${responseTime.toFixed(2)}ms`);

      return connection;

    } catch (error) {
      this.updateMetrics(connectionId, 'errors');

      if (error.message.includes('timeout') || error.message.includes('acquire timeout')) {
        this.updateMetrics(connectionId, 'timeouts');
      }

      logger.error(`Failed to acquire connection for ${connectionId}:`, error);
      this.emit('connectionError', { connectionId, error: error.message });
      throw error;
    }
  }

  async releaseConnection(connectionId: string, connection: any): Promise<void> {
    const config = this.configs.get(connectionId);

    if (!config) {
      logger.warn(`Configuration not found for connection ${connectionId}`);
      return;
    }

    try {
      switch (config.type) {
        case 'postgresql':
          if (connection && typeof connection.release === 'function') {
            connection.release();
          }
          break;

        case 'mysql':
          if (connection && typeof connection.release === 'function') {
            connection.release();
          }
          break;

        case 'mongodb':
        case 'redis':
        case 'sqlite':
          // These don't require explicit connection release
          break;
      }

      logger.debug(`Released connection for ${connectionId}`);

    } catch (error) {
      logger.error(`Failed to release connection for ${connectionId}:`, error);
      this.updateMetrics(connectionId, 'errors');
    }
  }

  async executeWithConnection<T>(
    connectionId: string,
    operation: (connection: any) => Promise<T>
  ): Promise<T> {
    const connection = await this.getConnection(connectionId);

    try {
      const result = await operation(connection);
      return result;
    } finally {
      await this.releaseConnection(connectionId, connection);
    }
  }

  async checkHealth(connectionId: string): Promise<HealthCheckResult> {
    const startTime = performance.now();
    const timestamp = new Date();

    try {
      const pool = this.pools.get(connectionId);
      const config = this.configs.get(connectionId);

      if (!pool || !config) {
        throw new Error(`Connection pool ${connectionId} not found`);
      }

      await this.performHealthCheck(pool, config);

      const responseTime = performance.now() - startTime;

      return {
        connectionId,
        healthy: true,
        responseTime,
        timestamp
      };

    } catch (error) {
      const responseTime = performance.now() - startTime;
      this.updateMetrics(connectionId, 'errors', error.message);

      return {
        connectionId,
        healthy: false,
        responseTime,
        error: error.message,
        timestamp
      };
    }
  }

  getMetrics(connectionId: string): PoolMetrics | undefined {
    return this.metrics.get(connectionId);
  }

  getAllMetrics(): Record<string, PoolMetrics> {
    const allMetrics: Record<string, PoolMetrics> = {};
    for (const [id, metrics] of this.metrics.entries()) {
      allMetrics[id] = { ...metrics };
    }
    return allMetrics;
  }

  async closePool(connectionId: string): Promise<void> {
    try {
      const pool = this.pools.get(connectionId);
      const config = this.configs.get(connectionId);

      if (!pool || !config) {
        logger.warn(`Pool ${connectionId} not found for closure`);
        return;
      }

      // Stop health monitoring
      this.stopHealthMonitoring(connectionId);

      // Close pool based on type
      switch (config.type) {
        case 'postgresql':
        case 'mysql':
          await pool.end();
          break;

        case 'mongodb':
          await pool.client.close();
          break;

        case 'redis':
          await pool.quit();
          break;

        case 'sqlite':
          await pool.close();
          break;
      }

      // Clean up
      this.pools.delete(connectionId);
      this.configs.delete(connectionId);
      this.metrics.delete(connectionId);

      logger.info(`Connection pool ${connectionId} closed successfully`);
      this.emit('poolClosed', { connectionId });

    } catch (error) {
      logger.error(`Failed to close pool ${connectionId}:`, error);
      this.emit('poolError', { connectionId, error: error.message });
      throw error;
    }
  }

  async closeAllPools(): Promise<void> {
    const connectionIds = Array.from(this.pools.keys());

    await Promise.allSettled(
      connectionIds.map(id => this.closePool(id))
    );

    // Clear any remaining retry timeouts
    for (const timeout of this.retryTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.retryTimeouts.clear();

    logger.info('All connection pools closed');
  }

  private async createPostgreSQLPool(config: ConnectionConfig): Promise<Pool> {
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl,
      max: config.maxConnections || 20,
      idleTimeoutMillis: config.idleTimeout || 30000,
      connectionTimeoutMillis: config.connectionTimeout || 30000,
      allowExitOnIdle: true,
      ...config.additionalConfig
    };

    if (config.connectionString) {
      return new Pool({ connectionString: config.connectionString, ...poolConfig });
    }

    return new Pool(poolConfig);
  }

  private async createMySQLPool(config: ConnectionConfig): Promise<mysql.Pool> {
    const poolConfig: any = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      connectionLimit: config.maxConnections || 20,
      acquireTimeout: config.acquireTimeout || 60000,
      timeout: config.connectionTimeout || 60000,
      idleTimeout: config.idleTimeout || 300000,
      ...config.additionalConfig
    };

    if (config.ssl) {
      poolConfig.ssl = {};
    }

    return mysql.createPool(poolConfig);
  }

  private async createMongoDBPool(config: ConnectionConfig): Promise<Db> {
    const options: MongoClientOptions = {
      maxPoolSize: config.maxConnections || 20,
      serverSelectionTimeoutMS: config.connectionTimeout || 30000,
      socketTimeoutMS: config.idleTimeout || 300000,
      ...config.additionalConfig
    };

    const connectionString = config.connectionString ||
      `mongodb://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;

    const client = new MongoClient(connectionString, options);
    await client.connect();

    return client.db(config.database);
  }

  private async createRedisPool(config: ConnectionConfig): Promise<any> {
    const client = createClient({
      socket: {
        host: config.host,
        port: config.port,
        connectTimeout: config.connectionTimeout || 30000,
      },
      password: config.password,
      database: parseInt(config.database) || 0,
      ...config.additionalConfig
    });

    await client.connect();
    return client;
  }

  private async createSQLitePool(config: ConnectionConfig): Promise<any> {
    // SQLite pool implementation would go here
    // For now, return a placeholder
    throw new Error('SQLite pool not implemented yet');
  }

  private initializeMetrics(connectionId: string): void {
    this.metrics.set(connectionId, {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingCount: 0,
      acquiredCount: 0,
      createdCount: 0,
      destroyedCount: 0,
      timeouts: 0,
      errors: 0
    });
  }

  private updateMetrics(connectionId: string, metric: keyof PoolMetrics, value?: any): void {
    const metrics = this.metrics.get(connectionId);
    if (!metrics) return;

    if (typeof metrics[metric] === 'number') {
      (metrics[metric] as number)++;
    }

    if (metric === 'errors' && value) {
      metrics.lastError = value;
      metrics.lastErrorTime = new Date();
    }

    this.metrics.set(connectionId, metrics);
  }

  private startHealthMonitoring(connectionId: string): void {
    const config = this.configs.get(connectionId);
    if (!config || !config.healthCheckInterval) return;

    const interval = setInterval(async () => {
      try {
        const result = await this.checkHealth(connectionId);
        this.emit('healthCheck', result);

        if (!result.healthy) {
          logger.warn(`Health check failed for ${connectionId}: ${result.error}`);
        }
      } catch (error) {
        logger.error(`Health check error for ${connectionId}:`, error);
      }
    }, config.healthCheckInterval);

    this.healthChecks.set(connectionId, interval);
  }

  private stopHealthMonitoring(connectionId: string): void {
    const interval = this.healthChecks.get(connectionId);
    if (interval) {
      clearInterval(interval);
      this.healthChecks.delete(connectionId);
    }
  }

  private async performHealthCheck(pool: any, config: ConnectionConfig): Promise<void> {
    switch (config.type) {
      case 'postgresql':
        const pgClient = await pool.connect();
        try {
          await pgClient.query('SELECT 1');
        } finally {
          pgClient.release();
        }
        break;

      case 'mysql':
        const [rows] = await pool.execute('SELECT 1');
        break;

      case 'mongodb':
        await pool.admin().ping();
        break;

      case 'redis':
        await pool.ping();
        break;

      case 'sqlite':
        // SQLite health check implementation
        break;

      default:
        throw new Error(`Health check not implemented for ${config.type}`);
    }
  }

  private setupPoolEventListeners(connectionId: string, pool: any): void {
    // PostgreSQL pool events
    if (pool.on) {
      pool.on('connect', () => {
        this.updateMetrics(connectionId, 'createdCount');
        logger.debug(`New connection created for pool ${connectionId}`);
      });

      pool.on('remove', () => {
        this.updateMetrics(connectionId, 'destroyedCount');
        logger.debug(`Connection removed from pool ${connectionId}`);
      });

      pool.on('error', (error: Error) => {
        this.updateMetrics(connectionId, 'errors', error.message);
        logger.error(`Pool error for ${connectionId}:`, error);
        this.emit('poolError', { connectionId, error: error.message });
      });
    }
  }

  private scheduleRetry(config: ConnectionConfig): void {
    if (!config.retryAttempts || config.retryAttempts <= 0) return;

    const delay = config.retryDelay || 5000;

    const timeout = setTimeout(async () => {
      try {
        logger.info(`Retrying connection pool creation for ${config.id}`);
        const updatedConfig = { ...config, retryAttempts: config.retryAttempts! - 1 };
        await this.createPool(updatedConfig);
      } catch (error) {
        logger.error(`Retry failed for ${config.id}:`, error);
      }
    }, delay);

    this.retryTimeouts.set(config.id, timeout);
  }
}

export const connectionPoolManager = new ConnectionPoolManager();
export default ConnectionPoolManager;