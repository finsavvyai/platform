import { PrismaClient } from '@prisma/client';
import { createClient, RedisClientType } from 'redis';
import { QdrantClient } from '@qdrant/js-client-rest';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { logger } from './utils/logger';

export interface DatabaseConfig {
  postgres: {
    url: string;
    maxConnections?: number;
    connectionTimeout?: number;
    idleTimeout?: number;
  };
  redis: {
    url: string;
    maxRetriesPerRequest?: number;
    retryDelayOnFailover?: number;
    lazyConnect?: boolean;
    keepAlive?: number;
  };
  qdrant: {
    url: string;
    apiKey?: string;
    timeout?: number;
    maxRetries?: number;
  };
  elasticsearch: {
    node: string;
    auth?: {
      username: string;
      password: string;
    };
    maxRetries?: number;
    requestTimeout?: number;
    pingTimeout?: number;
  };
}

export class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager;
  private prismaClient: PrismaClient;
  private redisClient: RedisClientType;
  private qdrantClient: QdrantClient;
  private elasticsearchClient: ElasticsearchClient;
  private config: DatabaseConfig;
  private isInitialized = false;
  private connectionRetries = 0;
  private readonly maxRetries = 5;

  private constructor() {}

  public static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager();
    }
    return DatabaseConnectionManager.instance;
  }

  public async initialize(config: DatabaseConfig): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Database connection manager already initialized');
      return;
    }

    this.config = config;
    logger.info('Initializing database connections...');

    try {
      await this.initializePostgres();
      await this.initializeRedis();
      await this.initializeQdrant();
      await this.initializeElasticsearch();

      this.isInitialized = true;
      logger.info('All database connections initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database connections:', error);
      await this.cleanup();
      throw error;
    }
  }

  private async initializePostgres(): Promise<void> {
    logger.info('Initializing PostgreSQL connection...');

    this.prismaClient = new PrismaClient({
      datasources: {
        db: {
          url: this.config.postgres.url,
        },
      },
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
      errorFormat: 'pretty',
    });

    // Set up logging events
    this.prismaClient.$on('query', (e) => {
      logger.debug('Prisma Query:', {
        query: e.query,
        params: e.params,
        duration: e.duration,
        target: e.target,
      });
    });

    this.prismaClient.$on('error', (e) => {
      logger.error('Prisma Error:', e);
    });

    this.prismaClient.$on('info', (e) => {
      logger.info('Prisma Info:', e);
    });

    this.prismaClient.$on('warn', (e) => {
      logger.warn('Prisma Warning:', e);
    });

    // Test connection
    await this.prismaClient.$connect();
    logger.info('PostgreSQL connection established');
  }

  private async initializeRedis(): Promise<void> {
    logger.info('Initializing Redis connection...');

    this.redisClient = createClient({
      url: this.config.redis.url,
      maxRetriesPerRequest: this.config.redis.maxRetriesPerRequest || 3,
      retryDelayOnFailover: this.config.redis.retryDelayOnFailover || 100,
      lazyConnect: this.config.redis.lazyConnect ?? true,
      socket: {
        keepAlive: this.config.redis.keepAlive ?? 30000,
        connectTimeout: this.config.redis.connectionTimeout || 10000,
      },
    });

    this.redisClient.on('error', (err) => {
      logger.error('Redis Error:', err);
    });

    this.redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    this.redisClient.on('end', () => {
      logger.warn('Redis client connection ended');
    });

    this.redisClient.on('reconnecting', () => {
      logger.info('Redis client reconnecting');
    });

    await this.redisClient.connect();
    logger.info('Redis connection established');
  }

  private async initializeQdrant(): Promise<void> {
    logger.info('Initializing Qdrant connection...');

    this.qdrantClient = new QdrantClient({
      url: this.config.qdrant.url,
      apiKey: this.config.qdrant.apiKey,
      timeout: this.config.qdrant.timeout || 30000,
    });

    // Test connection
    try {
      const health = await this.qdrantClient.health();
      logger.info('Qdrant connection established:', health);
    } catch (error) {
      logger.error('Failed to connect to Qdrant:', error);
      throw error;
    }
  }

  private async initializeElasticsearch(): Promise<void> {
    logger.info('Initializing Elasticsearch connection...');

    const esConfig: any = {
      node: this.config.elasticsearch.node,
      maxRetries: this.config.elasticsearch.maxRetries || 3,
      requestTimeout: this.config.elasticsearch.requestTimeout || 30000,
      pingTimeout: this.config.elasticsearch.pingTimeout || 3000,
    };

    if (this.config.elasticsearch.auth) {
      esConfig.auth = {
        username: this.config.elasticsearch.auth.username,
        password: this.config.elasticsearch.auth.password,
      };
    }

    this.elasticsearchClient = new ElasticsearchClient(esConfig);

    // Test connection
    try {
      const health = await this.elasticsearchClient.cluster.health();
      logger.info('Elasticsearch connection established:', health.status);
    } catch (error) {
      logger.error('Failed to connect to Elasticsearch:', error);
      throw error;
    }
  }

  public getPrismaClient(): PrismaClient {
    if (!this.isInitialized || !this.prismaClient) {
      throw new Error('Database connection manager not initialized or PostgreSQL not available');
    }
    return this.prismaClient;
  }

  public getRedisClient(): RedisClientType {
    if (!this.isInitialized || !this.redisClient) {
      throw new Error('Database connection manager not initialized or Redis not available');
    }
    return this.redisClient;
  }

  public getQdrantClient(): QdrantClient {
    if (!this.isInitialized || !this.qdrantClient) {
      throw new Error('Database connection manager not initialized or Qdrant not available');
    }
    return this.qdrantClient;
  }

  public getElasticsearchClient(): ElasticsearchClient {
    if (!this.isInitialized || !this.elasticsearchClient) {
      throw new Error('Database connection manager not initialized or Elasticsearch not available');
    }
    return this.elasticsearchClient;
  }

  public async testConnections(): Promise<{
    postgres: boolean;
    redis: boolean;
    qdrant: boolean;
    elasticsearch: boolean;
  }> {
    const results = {
      postgres: false,
      redis: false,
      qdrant: false,
      elasticsearch: false,
    };

    if (!this.isInitialized) {
      logger.warn('Database connection manager not initialized');
      return results;
    }

    // Test PostgreSQL
    try {
      await this.prismaClient.$queryRaw`SELECT 1`;
      results.postgres = true;
      logger.debug('PostgreSQL connection test: PASSED');
    } catch (error) {
      logger.error('PostgreSQL connection test: FAILED', error);
    }

    // Test Redis
    try {
      await this.redisClient.ping();
      results.redis = true;
      logger.debug('Redis connection test: PASSED');
    } catch (error) {
      logger.error('Redis connection test: FAILED', error);
    }

    // Test Qdrant
    try {
      await this.qdrantClient.health();
      results.qdrant = true;
      logger.debug('Qdrant connection test: PASSED');
    } catch (error) {
      logger.error('Qdrant connection test: FAILED', error);
    }

    // Test Elasticsearch
    try {
      await this.elasticsearchClient.cluster.health();
      results.elasticsearch = true;
      logger.debug('Elasticsearch connection test: PASSED');
    } catch (error) {
      logger.error('Elasticsearch connection test: FAILED', error);
    }

    return results;
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      postgres: 'connected' | 'disconnected' | 'error';
      redis: 'connected' | 'disconnected' | 'error';
      qdrant: 'connected' | 'disconnected' | 'error';
      elasticsearch: 'connected' | 'disconnected' | 'error';
    };
    timestamp: string;
  }> {
    const results = await this.testConnections();
    const connectedCount = Object.values(results).filter(Boolean).length;
    const totalServices = Object.keys(results).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (connectedCount === totalServices) {
      status = 'healthy';
    } else if (connectedCount > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      services: {
        postgres: results.postgres ? 'connected' : 'disconnected',
        redis: results.redis ? 'connected' : 'disconnected',
        qdrant: results.qdrant ? 'connected' : 'disconnected',
        elasticsearch: results.elasticsearch ? 'connected' : 'disconnected',
      },
      timestamp: new Date().toISOString(),
    };
  }

  public async retryConnections(): Promise<void> {
    if (this.connectionRetries >= this.maxRetries) {
      logger.error(`Maximum retry attempts (${this.maxRetries}) reached`);
      throw new Error('Maximum database connection retry attempts reached');
    }

    this.connectionRetries++;
    logger.info(`Retrying database connections (attempt ${this.connectionRetries}/${this.maxRetries})`);

    try {
      await this.cleanup();
      await this.initialize(this.config);
      this.connectionRetries = 0; // Reset on success
      logger.info('Database connections successfully re-established');
    } catch (error) {
      logger.error(`Database connection retry ${this.connectionRetries} failed:`, error);
      if (this.connectionRetries < this.maxRetries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, this.connectionRetries), 30000);
        setTimeout(() => this.retryConnections(), delay);
      } else {
        throw error;
      }
    }
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up database connections...');

    const cleanupPromises: Promise<void>[] = [];

    if (this.prismaClient) {
      cleanupPromises.push(
        this.prismaClient.$disconnect().catch((error) => {
          logger.error('Error disconnecting from PostgreSQL:', error);
        })
      );
    }

    if (this.redisClient) {
      cleanupPromises.push(
        this.redisClient.quit().catch((error) => {
          logger.error('Error disconnecting from Redis:', error);
        })
      );
    }

    // Qdrant and Elasticsearch clients don't need explicit disconnection

    await Promise.all(cleanupPromises);
    this.isInitialized = false;
    logger.info('Database connections cleaned up');
  }

  public getConnectionStats(): {
    postgresConnected: boolean;
    redisConnected: boolean;
    qdrantConnected: boolean;
    elasticsearchConnected: boolean;
    isInitialized: boolean;
    connectionRetries: number;
  } {
    return {
      postgresConnected: !!this.prismaClient,
      redisConnected: !!this.redisClient && this.redisClient.isOpen,
      qdrantConnected: !!this.qdrantClient,
      elasticsearchConnected: !!this.elasticsearchClient,
      isInitialized: this.isInitialized,
      connectionRetries: this.connectionRetries,
    };
  }
}

// Export singleton instance
export const dbConnectionManager = DatabaseConnectionManager.getInstance();

// Export configuration validator
export function validateDatabaseConfig(config: any): DatabaseConfig {
  if (!config.postgres?.url) {
    throw new Error('PostgreSQL URL is required');
  }
  if (!config.redis?.url) {
    throw new Error('Redis URL is required');
  }
  if (!config.qdrant?.url) {
    throw new Error('Qdrant URL is required');
  }
  if (!config.elasticsearch?.node) {
    throw new Error('Elasticsearch node is required');
  }

  return {
    postgres: {
      url: config.postgres.url,
      maxConnections: config.postgres.maxConnections || 20,
      connectionTimeout: config.postgres.connectionTimeout || 10000,
      idleTimeout: config.postgres.idleTimeout || 30000,
      ...config.postgres,
    },
    redis: {
      url: config.redis.url,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest || 3,
      retryDelayOnFailover: config.redis.retryDelayOnFailover || 100,
      lazyConnect: config.redis.lazyConnect ?? true,
      keepAlive: config.redis.keepAlive ?? 30000,
      ...config.redis,
    },
    qdrant: {
      url: config.qdrant.url,
      apiKey: config.qdrant.apiKey,
      timeout: config.qdrant.timeout || 30000,
      maxRetries: config.qdrant.maxRetries || 3,
      ...config.qdrant,
    },
    elasticsearch: {
      node: config.elasticsearch.node,
      auth: config.elasticsearch.auth,
      maxRetries: config.elasticsearch.maxRetries || 3,
      requestTimeout: config.elasticsearch.requestTimeout || 30000,
      pingTimeout: config.elasticsearch.pingTimeout || 3000,
      ...config.elasticsearch,
    },
  };
}
