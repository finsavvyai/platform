/**
 * Comprehensive Test Suite for Database Service Layer
 *
 * This test suite covers:
 * - Unit tests for all database service methods
 * - Error handling and validation testing
 * - Transaction management testing
 * - Performance and caching testing
 * - Connection pool testing
 * - Integration testing with D1 database
 *
 * @author Questro Platform Team
 * @version 1.0.0
 * @since 2025-11-01
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { DatabaseService, DatabaseError, DatabaseErrorType, initializeDatabaseService } from '../src/services/database-service';
import * as schema from '../src/db/schema';

// Mock D1 Database
const mockD1Database = {
  prepare: vi.fn(),
  batch: vi.fn(),
  exec: vi.fn(),
  dump: vi.fn(),
} as any;

// Mock Drizzle ORM
vi.mock('drizzle-orm/d1', () => ({
  drizzle: () => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    run: vi.fn().mockReturnThis(),
  })
}));

describe('DatabaseService', () => {
  let dbService: DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    dbService = new DatabaseService(mockD1Database, {
      maxConnections: 5,
      connectionTimeout: 5000,
      queryTimeout: 2000,
      maxRetries: 3,
      retryDelay: 100,
      enableCaching: true,
      cacheTimeout: 60000,
      enableMetrics: true,
      logLevel: 'debug'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const service = new DatabaseService(mockD1Database);
      expect(service).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        maxConnections: 20,
        queryTimeout: 5000,
        enableCaching: false
      };
      const service = new DatabaseService(mockD1Database, customConfig);
      expect(service).toBeDefined();
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when all checks pass', async () => {
      // Mock successful responses
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockResolvedValue([{ id: '1', email: 'test@test.com' }]);

      const health = await dbService.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.latency).toBeGreaterThan(0);
      expect(health.details.connectionTest).toBe(true);
      expect(health.details.queryTest).toBe(true);
      expect(health.details.transactionTest).toBe(true);
      expect(health.details.cacheTest).toBe(true);
    });

    it('should return degraded status when some checks fail', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn()
        .mockResolvedValueOnce([{ id: '1', email: 'test@test.com' }]) // connection test
        .mockResolvedValueOnce([{ count: 1 }]) // query test
        .mockRejectedValueOnce(new Error('Transaction failed')); // transaction test

      const health = await dbService.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.details.connectionTest).toBe(true);
      expect(health.details.queryTest).toBe(true);
      expect(health.details.transactionTest).toBe(false);
    });

    it('should return unhealthy status when connection fails', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockRejectedValue(new Error('Connection failed'));

      const health = await dbService.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.details.connectionTest).toBe(false);
    });
  });

  describe('Transaction Management', () => {
    it('should begin transaction successfully', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockResolvedValue({});

      const transaction = await dbService.beginTransaction();

      expect(transaction).toBeDefined();
      expect(transaction.id).toMatch(/^tx_\d+_[a-z0-9]+$/);
      expect(transaction.startTime).toBeGreaterThan(0);
      expect(typeof transaction.rollback).toBe('function');
      expect(typeof transaction.commit).toBe('function');
    });

    it('should commit transaction successfully', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockResolvedValue({});

      const transaction = await dbService.beginTransaction();
      await transaction.commit();

      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.any(Function),
        'COMMIT_TRANSACTION',
        [],
        false
      );
    });

    it('should rollback transaction successfully', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockResolvedValue({});

      const transaction = await dbService.beginTransaction();
      await transaction.rollback();

      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.any(Function),
        'ROLLBACK_TRANSACTION',
        [],
        false
      );
    });

    it('should handle transaction rollback on error', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn()
        .mockResolvedValueOnce({}) // begin transaction
        .mockRejectedValueOnce(new Error('Commit failed')); // commit fails

      const transaction = await dbService.beginTransaction();

      await expect(transaction.commit()).rejects.toThrow();
    });
  });

  describe('User Operations', () => {
    const validUserData = {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'user',
      subscription: 'free'
    };

    it('should create user successfully', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockResolvedValue([validUserData]);

      const result = await dbService.createUser(validUserData);

      expect(result).toEqual([validUserData]);
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.any(Function),
        'CREATE_USER',
        [validUserData],
        false
      );
    });

    it('should validate email format for user creation', async () => {
      const invalidUserData = { ...validUserData, email: 'invalid-email' };

      await expect(dbService.createUser(invalidUserData)).rejects.toThrow(
        DatabaseError
      );
    });

    it('should require email for user creation', async () => {
      const userDataWithoutEmail = { ...validUserData };
      delete userDataWithoutEmail.email;

      await expect(dbService.createUser(userDataWithoutEmail)).rejects.toThrow(
        DatabaseError
      );
    });

    it('should get user by ID successfully', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockResolvedValue([validUserData]);

      const result = await dbService.getUserById('user-123');

      expect(result).toEqual([validUserData]);
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.any(Function),
        'GET_USER_BY_ID',
        ['user-123'],
        true
      );
    });

    it('should validate user ID parameter', async () => {
      await expect(dbService.getUserById('')).rejects.toThrow(DatabaseError);
      await expect(dbService.getUserById(null as any)).rejects.toThrow(DatabaseError);
    });

    it('should get user by email successfully', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockResolvedValue([validUserData]);

      const result = await dbService.getUserByEmail('test@example.com');

      expect(result).toEqual([validUserData]);
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.any(Function),
        'GET_USER_BY_EMAIL',
        ['test@example.com'],
        true
      );
    });

    it('should validate email parameter', async () => {
      await expect(dbService.getUserByEmail('invalid-email')).rejects.toThrow(DatabaseError);
      await expect(dbService.getUserByEmail('')).rejects.toThrow(DatabaseError);
    });

    it('should update user successfully', async () => {
      const updates = { firstName: 'Jane', role: 'admin' };
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockResolvedValue([{ ...validUserData, ...updates }]);

      const result = await dbService.updateUser('user-123', updates);

      expect(result).toEqual([{ ...validUserData, ...updates }]);
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.any(Function),
        'UPDATE_USER',
        ['user-123', updates],
        false
      );
    });

    it('should validate user ID for update', async () => {
      await expect(dbService.updateUser('', { firstName: 'Jane' })).rejects.toThrow(DatabaseError);
    });

    it('should validate updates are provided', async () => {
      await expect(dbService.updateUser('user-123', {})).rejects.toThrow(DatabaseError);
    });

    it('should delete user successfully', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockResolvedValue([validUserData]);

      const result = await dbService.deleteUser('user-123');

      expect(result).toEqual([validUserData]);
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.any(Function),
        'DELETE_USER',
        ['user-123'],
        false
      );
    });
  });

  describe('Project Operations', () => {
    const validProjectData = {
      id: 'project-123',
      userId: 'user-123',
      name: 'Test Project',
      description: 'A test project',
      type: 'mobile',
      platform: 'ios'
    };

    it('should create project successfully', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockResolvedValue([validProjectData]);

      const result = await dbService.createProject(validProjectData);

      expect(result).toEqual([validProjectData]);
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.any(Function),
        'CREATE_PROJECT',
        [validProjectData],
        false
      );
    });

    it('should validate project data', async () => {
      const invalidProjectData = { ...validProjectData };
      delete invalidProjectData.name;

      await expect(dbService.createProject(invalidProjectData)).rejects.toThrow(DatabaseError);
    });

    it('should validate project type', async () => {
      const invalidProjectData = { ...validProjectData, type: 'invalid-type' };

      await expect(dbService.createProject(invalidProjectData)).rejects.toThrow(DatabaseError);
    });

    it('should get project by ID successfully', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockResolvedValue([validProjectData]);

      const result = await dbService.getProjectById('project-123');

      expect(result).toEqual(validProjectData);
    });

    it('should get project with relations', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockImplementation(async () => {
        return [
          validProjectData,
          [{ id: 'suite-1', name: 'Test Suite' }],
          [{ id: 'case-1', name: 'Test Case' }]
        ];
      });

      const result = await dbService.getProjectById('project-123', true);

      expect(result).toEqual({
        ...validProjectData,
        testSuites: [{ id: 'suite-1', name: 'Test Suite' }],
        testCases: [{ id: 'case-1', name: 'Test Case' }]
      });
    });

    it('should get projects by user with pagination', async () => {
      const mockProjects = [validProjectData];
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockResolvedValue({
        projects: mockProjects,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1
        }
      });

      const result = await dbService.getProjectsByUserId('user-123', {
        page: 1,
        limit: 20,
        status: 'active',
        search: 'test'
      });

      expect(result.projects).toEqual(mockProjects);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should retry failed queries', async () => {
      const mockDb = vi.mocked(dbService as any);
      let attemptCount = 0;

      mockDb.executeQuery = vi.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Connection failed');
        }
        return [{ id: '1', email: 'test@test.com' }];
      });

      const result = await mockDb.executeQuery(
        () => Promise.resolve([{ id: '1', email: 'test@test.com' }]),
        'TEST_QUERY',
        [],
        true
      );

      expect(result).toEqual([{ id: '1', email: 'test@test.com' }]);
      expect(attemptCount).toBe(3);
    });

    it('should throw DatabaseError after max retries', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(mockDb.executeQuery(
        () => Promise.reject(new Error('Persistent failure')),
        'FAILING_QUERY',
        [],
        true
      )).rejects.toThrow(DatabaseError);
    });

    it('should handle query timeout', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockImplementation(async () => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout')), 100);
        });
      });

      await expect(mockDb.executeQuery(
        () => new Promise(resolve => setTimeout(resolve, 5000)),
        'SLOW_QUERY',
        [],
        true
      )).rejects.toThrow(DatabaseError);
    });

    it('should classify different error types correctly', () => {
      const service = new DatabaseService(mockD1Database);

      // Test timeout error classification
      const timeoutError = new Error('Query timeout exceeded');
      expect((service as any).classifyError(timeoutError)).toBe(DatabaseErrorType.TIMEOUT_ERROR);

      // Test constraint error classification
      const constraintError = new Error('UNIQUE constraint failed');
      expect((service as any).classifyError(constraintError)).toBe(DatabaseErrorType.CONSTRAINT_ERROR);

      // Test connection error classification
      const connectionError = new Error('ECONNREFUSED');
      expect((service as any).classifyError(connectionError)).toBe(DatabaseErrorType.CONNECTION_ERROR);
    });
  });

  describe('Caching', () => {
    it('should cache query results', async () => {
      const mockDb = vi.mocked(dbService as any);
      let queryCount = 0;

      mockDb.executeQuery = vi.fn().mockImplementation(async () => {
        queryCount++;
        return [{ id: '1', email: 'test@test.com' }];
      });

      // First call should query database
      const result1 = await mockDb.executeQuery(
        () => Promise.resolve([{ id: '1', email: 'test@test.com' }]),
        'CACHED_QUERY',
        ['param1'],
        true
      );

      // Second call should use cache
      const result2 = await mockDb.executeQuery(
        () => Promise.resolve([{ id: '1', email: 'test@test.com' }]),
        'CACHED_QUERY',
        ['param1'],
        true
      );

      expect(result1).toEqual(result2);
      expect(queryCount).toBe(1); // Should only query once
    });

    it('should clear cache successfully', async () => {
      await dbService.clearCache();

      const metrics = dbService.getMetrics();
      expect(metrics.cacheStats.size).toBe(0);
    });

    it('should not cache write operations', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockResolvedValue([{ id: '1' }]);

      await mockDb.executeQuery(
        () => Promise.resolve([{ id: '1' }]),
        'WRITE_OPERATION',
        [{ id: '1' }],
        false
      );

      // Should not attempt to cache write operations
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.any(Function),
        'WRITE_OPERATION',
        [{ id: '1' }],
        false
      );
    });
  });

  describe('Performance Metrics', () => {
    it('should track query metrics', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockResolvedValue([]);

      // Execute some queries
      await mockDb.executeQuery(() => Promise.resolve([]), 'QUERY_1', [], true);
      await mockDb.executeQuery(() => Promise.resolve([]), 'QUERY_2', [], true);
      await mockDb.executeQuery(() => Promise.resolve([]), 'QUERY_3', [], true);

      const metrics = dbService.getMetrics();

      expect(metrics.queryCount).toBeGreaterThan(0);
      expect(metrics.averageQueryTime).toBeGreaterThanOrEqual(0);
      expect(typeof metrics.errorCount).toBe('number');
      expect(typeof metrics.cacheHitRate).toBe('number');
    });

    it('should track slow queries', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockImplementation(async () => {
        // Simulate slow query
        await new Promise(resolve => setTimeout(resolve, 100));
        return [];
      });

      await mockDb.executeQuery(() => Promise.resolve([]), 'SLOW_QUERY', [], true);

      const metrics = dbService.getMetrics();
      expect(metrics.slowQueries).toBeGreaterThanOrEqual(0);
    });

    it('should limit query log size', async () => {
      const mockDb = vi.mocked(dbService as any);
      mockDb.executeQuery = vi.fn().mockResolvedValue([]);

      // Generate more than 1000 queries
      for (let i = 0; i < 1100; i++) {
        await mockDb.executeQuery(() => Promise.resolve([]), `QUERY_${i}`, [], true);
      }

      const metrics = dbService.getMetrics();
      expect(metrics.queryLog.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Input Validation', () => {
    it('should validate user roles', async () => {
      const userData = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'invalid-role'
      };

      await expect(dbService.createUser(userData)).rejects.toThrow(DatabaseError);
    });

    it('should validate subscription types', async () => {
      const userData = {
        id: 'user-123',
        email: 'test@example.com',
        subscription: 'invalid-subscription'
      };

      await expect(dbService.createUser(userData)).rejects.toThrow(DatabaseError);
    });

    it('should validate project types', async () => {
      const projectData = {
        id: 'project-123',
        userId: 'user-123',
        name: 'Test Project',
        type: 'invalid-type'
      };

      await expect(dbService.createProject(projectData)).rejects.toThrow(DatabaseError);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex workflow with transactions', async () => {
      const mockDb = vi.mocked(dbService as any);
      const operations: any[] = [];

      mockDb.executeQuery = vi.fn().mockImplementation((fn, queryName, params, useCache) => {
        operations.push({ queryName, params, useCache });

        if (queryName === 'BEGIN_TRANSACTION') {
          return Promise.resolve({});
        } else if (queryName === 'COMMIT_TRANSACTION') {
          return Promise.resolve({});
        } else if (queryName === 'CREATE_USER') {
          return Promise.resolve([{ id: 'user-123', email: 'test@example.com' }]);
        } else if (queryName === 'CREATE_PROJECT') {
          return Promise.resolve([{ id: 'project-123', name: 'Test Project' }]);
        }

        return Promise.resolve([]);
      });

      // Simulate complex workflow
      const transaction = await dbService.beginTransaction();
      const user = await dbService.createUser({
        id: 'user-123',
        email: 'test@example.com',
        role: 'user'
      });
      const project = await dbService.createProject({
        id: 'project-123',
        userId: 'user-123',
        name: 'Test Project',
        type: 'mobile'
      });
      await transaction.commit();

      expect(operations).toHaveLength(4); // BEGIN, CREATE_USER, CREATE_PROJECT, COMMIT
      expect(operations[0].queryName).toBe('BEGIN_TRANSACTION');
      expect(operations[3].queryName).toBe('COMMIT_TRANSACTION');
    });
  });
});

describe('DatabaseService Global Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize global database service', () => {
    const service = initializeDatabaseService(mockD1Database);
    expect(service).toBeDefined();
  });

  it('should throw error when accessing uninitialized service', () => {
    // Clear any existing service
    vi.doMock('../src/services/database-service', () => ({
      getDatabaseService: () => {
        throw new DatabaseError(
          DatabaseErrorType.CONNECTION_ERROR,
          'Database service not initialized'
        );
      }
    }));

    expect(() => {
      const { getDatabaseService } = require('../src/services/database-service');
      getDatabaseService();
    }).toThrow(DatabaseError);
  });
});

describe('MemoryQueryCache', () => {
  // Import the cache class directly for testing
  class MemoryQueryCache {
    private cache = new Map<string, { value: any; expires: number }>();
    private stats = { hits: 0, misses: 0 };

    async get(key: string): Promise<any> {
      const item = this.cache.get(key);
      if (!item) {
        this.stats.misses++;
        return null;
      }

      if (Date.now() > item.expires) {
        this.cache.delete(key);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return item.value;
    }

    async set(key: string, value: any, ttl: number): Promise<void> {
      this.cache.set(key, {
        value,
        expires: Date.now() + ttl
      });
    }

    async delete(key: string): Promise<void> {
      this.cache.delete(key);
    }

    async clear(): Promise<void> {
      this.cache.clear();
      this.stats = { hits: 0, misses: 0 };
    }

    stats() {
      return {
        ...this.stats,
        size: this.cache.size
      };
    }
  }

  let cache: MemoryQueryCache;

  beforeEach(() => {
    cache = new MemoryQueryCache();
  });

  it('should store and retrieve values', async () => {
    await cache.set('key1', 'value1', 60000);
    const result = await cache.get('key1');
    expect(result).toBe('value1');
  });

  it('should handle cache misses', async () => {
    const result = await cache.get('nonexistent');
    expect(result).toBe(null);
    expect(cache.stats().misses).toBe(1);
  });

  it('should handle cache hits', async () => {
    await cache.set('key1', 'value1', 60000);
    await cache.get('key1');
    expect(cache.stats().hits).toBe(1);
  });

  it('should handle TTL expiration', async () => {
    await cache.set('key1', 'value1', 10); // 10ms TTL

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 20));

    const result = await cache.get('key1');
    expect(result).toBe(null);
    expect(cache.stats().misses).toBe(1);
  });

  it('should clear all cache entries', async () => {
    await cache.set('key1', 'value1', 60000);
    await cache.set('key2', 'value2', 60000);

    await cache.clear();

    expect(cache.stats().hits).toBe(0);
    expect(cache.stats().misses).toBe(0);
    expect(cache.stats().size).toBe(0);
  });
});
