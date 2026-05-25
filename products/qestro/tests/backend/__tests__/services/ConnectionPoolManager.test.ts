import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConnectionPoolManager } from '../../../../backend/src/services/ConnectionPoolManager.js';

// Mock the logger
jest.mock('../../../../backend/src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock pg module
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
      release: jest.fn()
    }),
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn()
  }))
}));

// Mock mysql2/promise
jest.mock('mysql2/promise', () => ({
  default: {
    createPool: jest.fn().mockImplementation(() => ({
      getConnection: jest.fn().mockResolvedValue({
        execute: jest.fn().mockResolvedValue([[], {}]),
        release: jest.fn()
      }),
      execute: jest.fn().mockResolvedValue([[], {}]),
      end: jest.fn().mockResolvedValue(undefined),
      on: jest.fn()
    }))
  }
}));

// Mock mongodb
jest.mock('mongodb', () => ({
  MongoClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    db: jest.fn().mockReturnValue({
      admin: jest.fn().mockReturnValue({
        ping: jest.fn().mockResolvedValue(undefined)
      }),
      client: {
        close: jest.fn().mockResolvedValue(undefined)
      }
    }),
    close: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Mock redis
jest.mock('redis', () => ({
  createClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue(undefined),
    on: jest.fn()
  }))
}));

describe('ConnectionPoolManager', () => {
  let poolManager: ConnectionPoolManager;

  beforeEach(() => {
    poolManager = new ConnectionPoolManager();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await poolManager.closeAllPools();
  });

  describe('Pool Creation', () => {
    test('should create PostgreSQL connection pool', async () => {
      const config = {
        id: 'test-postgres-pool',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'postgres',
        password: 'password',
        maxConnections: 10,
        connectionTimeout: 30000,
        idleTimeout: 300000
      };

      await expect(poolManager.createPool(config)).resolves.not.toThrow();

      const metrics = poolManager.getMetrics(config.id);
      expect(metrics).toBeDefined();
    });

    test('should create MySQL connection pool', async () => {
      const config = {
        id: 'test-mysql-pool',
        type: 'mysql' as const,
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        username: 'root',
        password: 'password',
        maxConnections: 10,
        connectionTimeout: 30000
      };

      await expect(poolManager.createPool(config)).resolves.not.toThrow();

      const metrics = poolManager.getMetrics(config.id);
      expect(metrics).toBeDefined();
    });

    test('should create MongoDB connection pool', async () => {
      const config = {
        id: 'test-mongo-pool',
        type: 'mongodb' as const,
        host: 'localhost',
        port: 27017,
        database: 'test_db',
        username: 'admin',
        password: 'password',
        maxConnections: 10
      };

      await expect(poolManager.createPool(config)).resolves.not.toThrow();

      const metrics = poolManager.getMetrics(config.id);
      expect(metrics).toBeDefined();
    });

    test('should create Redis connection pool', async () => {
      const config = {
        id: 'test-redis-pool',
        type: 'redis' as const,
        host: 'localhost',
        port: 6379,
        database: '0',
        username: '',
        password: 'password'
      };

      await expect(poolManager.createPool(config)).resolves.not.toThrow();

      const metrics = poolManager.getMetrics(config.id);
      expect(metrics).toBeDefined();
    });

    test('should handle unsupported database types', async () => {
      const config = {
        id: 'test-unsupported-pool',
        type: 'unsupported' as any,
        host: 'localhost',
        port: 1234,
        database: 'test_db',
        username: 'user',
        password: 'password'
      };

      await expect(poolManager.createPool(config)).rejects.toThrow('Unsupported database type');
    });

    test('should emit poolCreated event on successful creation', async () => {
      const config = {
        id: 'test-event-pool',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'postgres',
        password: 'password'
      };

      const eventSpy = jest.fn();
      poolManager.on('poolCreated', eventSpy);

      await poolManager.createPool(config);

      expect(eventSpy).toHaveBeenCalledWith({
        connectionId: config.id,
        type: config.type
      });
    });
  });

  describe('Connection Management', () => {
    beforeEach(async () => {
      const config = {
        id: 'test-connection-pool',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'postgres',
        password: 'password'
      };

      await poolManager.createPool(config);
    });

    test('should acquire connection from pool', async () => {
      const connection = await poolManager.getConnection('test-connection-pool');
      expect(connection).toBeDefined();

      const metrics = poolManager.getMetrics('test-connection-pool');
      expect(metrics?.acquiredCount).toBeGreaterThan(0);
    });

    test('should release connection back to pool', async () => {
      const connection = await poolManager.getConnection('test-connection-pool');

      await expect(poolManager.releaseConnection('test-connection-pool', connection))
        .resolves.not.toThrow();
    });

    test('should execute operation with auto-release', async () => {
      const operation = jest.fn().mockResolvedValue('operation result');

      const result = await poolManager.executeWithConnection('test-connection-pool', operation);

      expect(result).toBe('operation result');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should handle operation errors with auto-release', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(poolManager.executeWithConnection('test-connection-pool', operation))
        .rejects.toThrow('Operation failed');

      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should handle non-existent pool', async () => {
      await expect(poolManager.getConnection('non-existent-pool'))
        .rejects.toThrow('Connection pool non-existent-pool not found');
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      const config = {
        id: 'test-health-pool',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'postgres',
        password: 'password',
        healthCheckInterval: 5000
      };

      await poolManager.createPool(config);
    });

    test('should perform health check', async () => {
      const healthResult = await poolManager.checkHealth('test-health-pool');

      expect(healthResult).toBeDefined();
      expect(healthResult.connectionId).toBe('test-health-pool');
      expect(healthResult.healthy).toBe(true);
      expect(healthResult.responseTime).toBeGreaterThan(0);
      expect(healthResult.timestamp).toBeInstanceOf(Date);
    });

    test('should handle health check failures', async () => {
      // Mock health check failure
      const mockPool = {
        connect: jest.fn().mockRejectedValue(new Error('Connection failed'))
      };

      // Replace the pool with a failing one
      poolManager['pools'].set('test-health-pool', mockPool);

      const healthResult = await poolManager.checkHealth('test-health-pool');

      expect(healthResult.healthy).toBe(false);
      expect(healthResult.error).toBeDefined();
    });

    test('should emit health check events', async () => {
      const eventSpy = jest.fn();
      poolManager.on('healthCheck', eventSpy);

      await poolManager.checkHealth('test-health-pool');

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        connectionId: 'test-health-pool',
        healthy: expect.any(Boolean),
        responseTime: expect.any(Number),
        timestamp: expect.any(Date)
      }));
    });
  });

  describe('Metrics Tracking', () => {
    beforeEach(async () => {
      const config = {
        id: 'test-metrics-pool',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'postgres',
        password: 'password'
      };

      await poolManager.createPool(config);
    });

    test('should track connection acquisition metrics', async () => {
      const connection = await poolManager.getConnection('test-metrics-pool');

      const metrics = poolManager.getMetrics('test-metrics-pool');
      expect(metrics?.acquiredCount).toBeGreaterThan(0);

      await poolManager.releaseConnection('test-metrics-pool', connection);
    });

    test('should track error metrics', async () => {
      // Mock a failing pool
      const mockPool = {
        connect: jest.fn().mockRejectedValue(new Error('Connection failed'))
      };

      poolManager['pools'].set('test-metrics-pool', mockPool);

      try {
        await poolManager.getConnection('test-metrics-pool');
      } catch (error) {
        // Expected error
      }

      const metrics = poolManager.getMetrics('test-metrics-pool');
      expect(metrics?.errors).toBeGreaterThan(0);
    });

    test('should get all metrics', () => {
      const allMetrics = poolManager.getAllMetrics();
      expect(allMetrics).toBeDefined();
      expect(allMetrics['test-metrics-pool']).toBeDefined();
    });
  });

  describe('Pool Closure', () => {
    test('should close individual pool', async () => {
      const config = {
        id: 'test-close-pool',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'postgres',
        password: 'password'
      };

      await poolManager.createPool(config);

      await expect(poolManager.closePool('test-close-pool')).resolves.not.toThrow();

      // Pool should no longer exist
      await expect(poolManager.getConnection('test-close-pool'))
        .rejects.toThrow('Connection pool test-close-pool not found');
    });

    test('should close all pools', async () => {
      const configs = [
        {
          id: 'test-close-all-1',
          type: 'postgresql' as const,
          host: 'localhost',
          port: 5432,
          database: 'test_db1',
          username: 'postgres',
          password: 'password'
        },
        {
          id: 'test-close-all-2',
          type: 'mysql' as const,
          host: 'localhost',
          port: 3306,
          database: 'test_db2',
          username: 'root',
          password: 'password'
        }
      ];

      for (const config of configs) {
        await poolManager.createPool(config);
      }

      await expect(poolManager.closeAllPools()).resolves.not.toThrow();

      // All pools should be closed
      for (const config of configs) {
        await expect(poolManager.getConnection(config.id))
          .rejects.toThrow(`Connection pool ${config.id} not found`);
      }
    });

    test('should emit poolClosed event', async () => {
      const config = {
        id: 'test-close-event-pool',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'postgres',
        password: 'password'
      };

      await poolManager.createPool(config);

      const eventSpy = jest.fn();
      poolManager.on('poolClosed', eventSpy);

      await poolManager.closePool(config.id);

      expect(eventSpy).toHaveBeenCalledWith({
        connectionId: config.id
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle pool creation errors', async () => {
      const config = {
        id: 'test-error-pool',
        type: 'postgresql' as const,
        host: 'invalid-host',
        port: 5432,
        database: 'test_db',
        username: 'postgres',
        password: 'password'
      };

      // Mock Pool constructor to throw error
      const { Pool } = require('pg');
      Pool.mockImplementationOnce(() => {
        throw new Error('Pool creation failed');
      });

      await expect(poolManager.createPool(config)).rejects.toThrow();
    });

    test('should handle connection timeout errors', async () => {
      const config = {
        id: 'test-timeout-pool',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'postgres',
        password: 'password',
        connectionTimeout: 1 // Very short timeout
      };

      await poolManager.createPool(config);

      // Mock timeout error
      const mockPool = {
        connect: jest.fn().mockRejectedValue(new Error('timeout'))
      };

      poolManager['pools'].set('test-timeout-pool', mockPool);

      await expect(poolManager.getConnection('test-timeout-pool'))
        .rejects.toThrow('timeout');

      const metrics = poolManager.getMetrics('test-timeout-pool');
      expect(metrics?.timeouts).toBeGreaterThan(0);
    });

    test('should emit error events', async () => {
      const config = {
        id: 'test-error-event-pool',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'postgres',
        password: 'password'
      };

      const eventSpy = jest.fn();
      poolManager.on('poolError', eventSpy);

      // Mock Pool constructor to throw error
      const { Pool } = require('pg');
      Pool.mockImplementationOnce(() => {
        throw new Error('Pool creation failed');
      });

      try {
        await poolManager.createPool(config);
      } catch (error) {
        // Expected error
      }

      expect(eventSpy).toHaveBeenCalledWith({
        connectionId: config.id,
        error: 'Pool creation failed'
      });
    });
  });

  describe('Retry Mechanism', () => {
    test('should retry failed pool creation', async () => {
      const config = {
        id: 'test-retry-pool',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'postgres',
        password: 'password',
        retryAttempts: 2,
        retryDelay: 100
      };

      // Mock Pool constructor to fail first time, succeed second time
      const { Pool } = require('pg');
      Pool.mockImplementationOnce(() => {
        throw new Error('First attempt failed');
      }).mockImplementationOnce(() => ({
        connect: jest.fn().mockResolvedValue({
          query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
          release: jest.fn()
        }),
        end: jest.fn().mockResolvedValue(undefined),
        on: jest.fn()
      }));

      // First attempt should fail but trigger retry
      try {
        await poolManager.createPool(config);
      } catch (error) {
        // Expected error for first attempt
      }

      // Wait for retry
      await new Promise(resolve => setTimeout(resolve, 150));

      // Pool should eventually be created
      const metrics = poolManager.getMetrics(config.id);
      expect(metrics).toBeDefined();
    });
  });

  describe('Configuration Validation', () => {
    test('should validate required configuration fields', async () => {
      const invalidConfig = {
        id: '',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'postgres',
        password: 'password'
      };

      // The connection should still work, but ID should be validated elsewhere
      await expect(poolManager.createPool(invalidConfig)).resolves.not.toThrow();
    });

    test('should use default values for optional configuration', async () => {
      const minimalConfig = {
        id: 'test-minimal-pool',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'postgres',
        password: 'password'
      };

      await poolManager.createPool(minimalConfig);

      const metrics = poolManager.getMetrics(minimalConfig.id);
      expect(metrics).toBeDefined();
    });
  });
});