import { DatabaseConnectionManager, validateDatabaseConfig } from '../connection';
import { logger } from '../utils/logger';

// Mock logger to avoid noise during tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('DatabaseConnectionManager', () => {
  let manager: DatabaseConnectionManager;
  const mockConfig = {
    postgres: {
      url: 'postgresql://test:test@localhost:5432/testdb',
      maxConnections: 20,
      connectionTimeout: 10000,
      idleTimeout: 30000,
    },
    redis: {
      url: 'redis://localhost:6379',
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
      keepAlive: 30000,
    },
    qdrant: {
      url: 'http://localhost:6333',
      apiKey: 'test-key',
      timeout: 30000,
      maxRetries: 3,
    },
    elasticsearch: {
      node: 'http://localhost:9200',
      auth: {
        username: 'elastic',
        password: 'changeme',
      },
      maxRetries: 3,
      requestTimeout: 30000,
      pingTimeout: 3000,
    },
  };

  beforeEach(() => {
    manager = DatabaseConnectionManager.getInstance();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await manager.cleanup();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Configuration Validation', () => {
    it('should validate correct configuration', () => {
      const config = validateDatabaseConfig(mockConfig);

      expect(config.postgres.url).toBe(mockConfig.postgres.url);
      expect(config.redis.url).toBe(mockConfig.redis.url);
      expect(config.qdrant.url).toBe(mockConfig.qdrant.url);
      expect(config.elasticsearch.node).toBe(mockConfig.elasticsearch.node);
    });

    it('should throw error for missing PostgreSQL URL', () => {
      const invalidConfig = { ...mockConfig };
      delete invalidConfig.postgres.url;

      expect(() => validateDatabaseConfig(invalidConfig)).toThrow(
        'PostgreSQL URL is required'
      );
    });

    it('should throw error for missing Redis URL', () => {
      const invalidConfig = { ...mockConfig };
      delete invalidConfig.redis.url;

      expect(() => validateDatabaseConfig(invalidConfig)).toThrow(
        'Redis URL is required'
      );
    });

    it('should throw error for missing Qdrant URL', () => {
      const invalidConfig = { ...mockConfig };
      delete invalidConfig.qdrant.url;

      expect(() => validateDatabaseConfig(invalidConfig)).toThrow(
        'Qdrant URL is required'
      );
    });

    it('should throw error for missing Elasticsearch node', () => {
      const invalidConfig = { ...mockConfig };
      delete invalidConfig.elasticsearch.node;

      expect(() => validateDatabaseConfig(invalidConfig)).toThrow(
        'Elasticsearch node is required'
      );
    });

    it('should apply default values for optional configuration', () => {
      const minimalConfig = {
        postgres: { url: 'postgresql://test:test@localhost:5432/testdb' },
        redis: { url: 'redis://localhost:6379' },
        qdrant: { url: 'http://localhost:6333' },
        elasticsearch: { node: 'http://localhost:9200' },
      };

      const config = validateDatabaseConfig(minimalConfig);

      expect(config.postgres.maxConnections).toBe(20);
      expect(config.redis.maxRetriesPerRequest).toBe(3);
      expect(config.qdrant.timeout).toBe(30000);
      expect(config.elasticsearch.maxRetries).toBe(3);
    });
  });

  describe('Connection Management', () => {
    it('should be a singleton', () => {
      const manager1 = DatabaseConnectionManager.getInstance();
      const manager2 = DatabaseConnectionManager.getInstance();

      expect(manager1).toBe(manager2);
    });

    it('should initialize without errors', async () => {
      // Mock the actual connection methods to avoid requiring real services
      const mockPrismaClient = {
        $connect: jest.fn().mockResolvedValue(undefined),
        $queryRaw: jest.fn().mockResolvedValue([{ exists: true }]),
        $on: jest.fn(),
        $disconnect: jest.fn().mockResolvedValue(undefined),
      };

      const mockRedisClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        quit: jest.fn().mockResolvedValue(undefined),
        isOpen: true,
      };

      const mockQdrantClient = {
        health: jest.fn().mockResolvedValue({ status: 'ok' }),
      };

      const mockElasticsearchClient = {
        cluster: {
          health: jest.fn().mockResolvedValue({ status: 'green' }),
        },
      };

      // Mock the dependencies
      const originalPrisma = require('@prisma/client').PrismaClient;
      const originalRedis = require('redis').createClient;
      const originalQdrant = require('@qdrant/js-client-rest').QdrantClient;
      const originalElasticsearch = require('@elastic/elasticsearch').Client;

      try {
        require('@prisma/client').PrismaClient = jest.fn().mockImplementation(() => mockPrismaClient);
        require('redis').createClient = jest.fn().mockReturnValue(mockRedisClient);
        require('@qdrant/js-client-rest').QdrantClient = jest.fn().mockImplementation(() => mockQdrantClient);
        require('@elastic/elasticsearch').Client = jest.fn().mockImplementation(() => mockElasticsearchClient);

        await manager.initialize(mockConfig);

        expect(mockPrismaClient.$connect).toHaveBeenCalled();
        expect(mockRedisClient.connect).toHaveBeenCalled();
        expect(mockQdrantClient.health).toHaveBeenCalled();
        expect(mockElasticsearchClient.cluster.health).toHaveBeenCalled();

        expect(manager.getConnectionStats().isInitialized).toBe(true);
      } finally {
        // Restore original constructors
        require('@prisma/client').PrismaClient = originalPrisma;
        require('redis').createClient = originalRedis;
        require('@qdrant/js-client-rest').QdrantClient = originalQdrant;
        require('@elastic/elasticsearch').Client = originalElasticsearch;
      }
    });

    it('should handle initialization errors', async () => {
      const invalidConfig = { ...mockConfig };
      invalidConfig.postgres.url = 'invalid-connection-string';

      await expect(manager.initialize(invalidConfig)).rejects.toThrow();

      expect(manager.getConnectionStats().isInitialized).toBe(false);
    });

    it('should throw error when getting clients before initialization', () => {
      expect(() => manager.getPrismaClient()).toThrow(
        'Database connection manager not initialized or PostgreSQL not available'
      );
      expect(() => manager.getRedisClient()).toThrow(
        'Database connection manager not initialized or Redis not available'
      );
      expect(() => manager.getQdrantClient()).toThrow(
        'Database connection manager not initialized or Qdrant not available'
      );
      expect(() => manager.getElasticsearchClient()).toThrow(
        'Database connection manager not initialized or Elasticsearch not available'
      );
    });

    it('should test connections successfully', async () => {
      // Mock test methods
      manager['prismaClient'] = {
        $queryRaw: jest.fn().mockResolvedValue([{ exists: true }]),
      } as any;
      manager['redisClient'] = {
        ping: jest.fn().mockResolvedValue('PONG'),
      } as any;
      manager['qdrantClient'] = {
        health: jest.fn().mockResolvedValue({ status: 'ok' }),
      } as any;
      manager['elasticsearchClient'] = {
        cluster: {
          health: jest.fn().mockResolvedValue({ status: 'green' }),
        },
      } as any;
      manager['isInitialized'] = true;

      const results = await manager.testConnections();

      expect(results.postgres).toBe(true);
      expect(results.redis).toBe(true);
      expect(results.qdrant).toBe(true);
      expect(results.elasticsearch).toBe(true);
    });

    it('should handle connection test failures', async () => {
      manager['prismaClient'] = {
        $queryRaw: jest.fn().mockRejectedValue(new Error('Connection failed')),
      } as any;
      manager['redisClient'] = {
        ping: jest.fn().mockRejectedValue(new Error('Connection failed')),
      } as any;
      manager['qdrantClient'] = {
        health: jest.fn().mockRejectedValue(new Error('Connection failed')),
      } as any;
      manager['elasticsearchClient'] = {
        cluster: {
          health: jest.fn().mockRejectedValue(new Error('Connection failed')),
        },
      } as any;
      manager['isInitialized'] = true;

      const results = await manager.testConnections();

      expect(results.postgres).toBe(false);
      expect(results.redis).toBe(false);
      expect(results.qdrant).toBe(false);
      expect(results.elasticsearch).toBe(false);
    });

    it('should perform health check', async () => {
      manager['prismaClient'] = {
        $queryRaw: jest.fn().mockResolvedValue([{ exists: true }]),
      } as any;
      manager['redisClient'] = {
        ping: jest.fn().mockResolvedValue('PONG'),
      } as any;
      manager['qdrantClient'] = {
        health: jest.fn().mockResolvedValue({ status: 'ok' }),
      } as any;
      manager['elasticsearchClient'] = {
        cluster: {
          health: jest.fn().mockResolvedValue({ status: 'green' }),
        },
      } as any;
      manager['isInitialized'] = true;

      const health = await manager.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.services.postgres).toBe('connected');
      expect(health.services.redis).toBe('connected');
      expect(health.services.qdrant).toBe('connected');
      expect(health.services.elasticsearch).toBe('connected');
      expect(health.timestamp).toBeDefined();
    });

    it('should report degraded health when some services are down', async () => {
      manager['prismaClient'] = {
        $queryRaw: jest.fn().mockResolvedValue([{ exists: true }]),
      } as any;
      manager['redisClient'] = {
        ping: jest.fn().mockRejectedValue(new Error('Connection failed')),
      } as any;
      manager['qdrantClient'] = {
        health: jest.fn().mockResolvedValue({ status: 'ok' }),
      } as any;
      manager['elasticsearchClient'] = {
        cluster: {
          health: jest.fn().mockResolvedValue({ status: 'green' }),
        },
      } as any;
      manager['isInitialized'] = true;

      const health = await manager.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.services.postgres).toBe('connected');
      expect(health.services.redis).toBe('disconnected');
      expect(health.services.qdrant).toBe('connected');
      expect(health.services.elasticsearch).toBe('connected');
    });

    it('should report unhealthy when all services are down', async () => {
      manager['isInitialized'] = false;

      const health = await manager.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.services.postgres).toBe('disconnected');
      expect(health.services.redis).toBe('disconnected');
      expect(health.services.qdrant).toBe('disconnected');
      expect(health.services.elasticsearch).toBe('disconnected');
    });

    it('should provide connection statistics', () => {
      const stats = manager.getConnectionStats();

      expect(stats).toHaveProperty('postgresConnected');
      expect(stats).toHaveProperty('redisConnected');
      expect(stats).toHaveProperty('qdrantConnected');
      expect(stats).toHaveProperty('elasticsearchConnected');
      expect(stats).toHaveProperty('isInitialized');
      expect(stats).toHaveProperty('connectionRetries');
      expect(typeof stats.isInitialized).toBe('boolean');
      expect(typeof stats.connectionRetries).toBe('number');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle cleanup errors gracefully', async () => {
      manager['prismaClient'] = {
        $disconnect: jest.fn().mockRejectedValue(new Error('Disconnect failed')),
      } as any;
      manager['redisClient'] = {
        quit: jest.fn().mockRejectedValue(new Error('Disconnect failed')),
      } as any;
      manager['isInitialized'] = true;

      // Should not throw error even if cleanup fails
      await expect(manager.cleanup()).resolves.toBeUndefined();
    });

    it('should handle retry mechanism', async () => {
      manager['connectionRetries'] = 0;
      manager['maxRetries'] = 2;

      const mockInitialize = jest.fn().mockRejectedValueOnce(new Error('Connection failed'));
      manager.initialize = mockInitialize;

      await expect(manager.retryConnections()).rejects.toThrow();
      expect(mockInitialize).toHaveBeenCalledTimes(2);
    });

    it('should stop retrying after max retries', async () => {
      manager['connectionRetries'] = 3;
      manager['maxRetries'] = 3;

      await expect(manager.retryConnections()).rejects.toThrow(
        'Maximum database connection retry attempts reached'
      );
    });
  });
});
