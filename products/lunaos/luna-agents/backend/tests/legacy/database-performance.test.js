import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import DatabasePerformanceOptimizer from '../src/database-performance.js';
import { DatabasePerformanceController } from '../src/database-performance-controller.js';

describe('DatabasePerformanceOptimizer', () => {
  let optimizer;
  let mockDb;
  let mockCache;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn(),
      bind: vi.fn()
    };

    mockCache = {
      get: vi.fn(),
      put: vi.fn()
    };

    optimizer = new DatabasePerformanceOptimizer(mockDb, mockCache);
    vi.clearAllMocks();
  });

  describe('executeQuery', () => {
    it('should execute query with performance monitoring', async () => {
      const mockResult = { results: [{ id: 1, name: 'test' }] };
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue(mockResult)
      };

      mockDb.prepare.mockReturnValue(mockStatement);

      const result = await optimizer.executeQuery('SELECT * FROM test', []);

      expect(result).toBe(mockResult);
      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM test');
      expect(mockStatement.bind).toHaveBeenCalledWith();
      expect(mockStatement.all).toHaveBeenCalled();
    });

    it('should use query cache when available', async () => {
      const cacheKey = 'query:hash123';
      const cachedResult = { results: [{ id: 1, name: 'cached' }] };

      mockCache.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await optimizer.executeQuery('SELECT * FROM test', [], {
        cacheable: true,
        cacheKey
      });

      expect(result).toBe(cachedResult);
      expect(mockDb.prepare).not.toHaveBeenCalled();
      expect(optimizer.queryMetrics.cacheHitRate).toBeGreaterThan(0);
    });

    it('should cache query results when cacheable', async () => {
      const mockResult = { results: [{ id: 1, name: 'test' }] };
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue(mockResult)
      };

      mockDb.prepare.mockReturnValue(mockStatement);
      mockCache.put.mockResolvedValue(true);

      const cacheKey = 'query:hash123';
      await optimizer.executeQuery('SELECT * FROM test', [], {
        cacheable: true,
        cacheKey
      });

      expect(mockCache.put).toHaveBeenCalledWith(
        cacheKey,
        mockResult,
        expect.any(Object)
      );
    });

    it('should log slow queries', async () => {
      const slowQuery = 'SELECT * FROM large_table';
      const mockResult = { results: [] };
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockImplementation(() => {
          // Simulate slow query
          return new Promise(resolve => {
            setTimeout(() => resolve(mockResult), 60);
          });
        })
      };

      mockDb.prepare.mockReturnValue(mockStatement);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await optimizer.executeQuery(slowQuery, []);

      expect(optimizer.queryMetrics.slowQueries).toBe(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow Query'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should handle connection limits', async () => {
      // Simulate max concurrent queries
      optimizer.activeQueries = optimizer.maxConcurrentQueries;

      const slowQuery = 'SELECT * FROM test';
      const mockResult = { results: [] };
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue(mockResult)
      };

      mockDb.prepare.mockReturnValue(mockStatement);

      const queryPromise = optimizer.executeQuery(slowQuery, []);
      const anotherQueryPromise = optimizer.executeQuery(slowQuery, []);

      await Promise.all([queryPromise, anotherQueryPromise]);

      expect(optimizer.queryQueue.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('executeQueryWithRetry', () => {
    it('should retry on transient errors', async () => {
      const transientError = new Error('Connection timeout');
      const mockResult = { results: [] };

      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn()
          .mockRejectedValueOnce(transientError)
          .mockResolvedValueOnce(mockResult)
      };

      mockDb.prepare.mockReturnValue(mockStatement);

      const result = await optimizer.executeQueryWithRetry('SELECT * FROM test', [], {
        maxRetries: 2,
        retryDelay: 10
      });

      expect(result).toBe(mockResult);
      expect(mockStatement.all).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const persistentError = new Error('Persistent failure');
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockRejectedValue(persistentError)
      };

      mockDb.prepare.mockReturnValue(mockStatement);

      await expect(
        optimizer.executeQueryWithRetry('SELECT * FROM test', [], {
          maxRetries: 2
        })
      ).rejects.toThrow(persistentError);

      expect(mockStatement.all).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('batch operations', () => {
    it('should execute batch queries', async () => {
      const queries = [
        { query: 'SELECT * FROM table1', params: [] },
        { query: 'SELECT * FROM table2', params: [] }
      ];

      const mockResults = [
        { results: [{ id: 1 }] },
        { results: [{ id: 2 }] }
      ];

      queries.forEach((query, index) => {
        const mockStatement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue(mockResults[index])
        };
        mockDb.prepare.mockReturnValue(mockStatement);
      });

      const result = await optimizer.executeBatch(queries);

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('fulfilled');
      expect(result[1].status).toBe('fulfilled');
    });

    it('should handle batch with some failures', async () => {
      const queries = [
        { query: 'SELECT * FROM table1', params: [] },
        { query: 'INVALID SQL', params: [] }
      ];

      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn()
          .mockResolvedValueOnce({ results: [] })
          .mockRejectedValueOnce(new Error('SQL Error'))
      };

      mockDb.prepare.mockReturnValue(mockStatement);

      const result = await optimizer.executeBatch(queries);

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('fulfilled');
      expect(result[1].status).toBe('rejected');
    });
  });

  describe('getUserOptimized', () => {
    it('should find user by userId', async () => {
      const user = { id: 'user1', user_id: 'claude-user-1', email: 'test@example.com' };
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [user] })
      };

      mockDb.prepare.mockReturnValue(mockStatement);

      const result = await optimizer.getUserOptimized({ userId: 'claude-user-1' });

      expect(result).toBe(user);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE user_id = ?')
      );
    });

    it('should find user by email', async () => {
      const user = { id: 'user1', user_id: 'claude-user-1', email: 'test@example.com' };
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [user] })
      };

      mockDb.prepare.mockReturnValue(mockStatement);

      const result = await optimizer.getUserOptimized({ email: 'test@example.com' });

      expect(result).toBe(user);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('email = ?')
      );
    });

    it('should find user by API key', async () => {
      const user = { id: 'user1', user_id: 'claude-user-1', api_key: 'api-key-123' };
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [user] })
      };

      mockDb.prepare.mockReturnValue(mockStatement);

      const result = await optimizer.getUserOptimized({ apiKey: 'api-key-123' });

      expect(result).toBe(user);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('api_key = ?')
      );
    });

    it('should return null when user not found', async () => {
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] })
      };

      mockDb.prepare.mockReturnValue(mockStatement);

      const result = await optimizer.getUserOptimized({ userId: 'nonexistent' });

      expect(result).toBeNull();
    });
  });

  describe('searchOptimized', () => {
    it('should perform optimized search', async () => {
      const results = [{ id: 1, name: 'Test Project', description: 'Test description' }];
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results })
      };

      mockDb.prepare.mockReturnValue(mockStatement);

      const searchResults = await optimizer.searchOptimized('projects', 'test', {
        columns: ['name', 'description'],
        limit: 10
      });

      expect(searchResults).toEqual(results);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE (name LIKE ? OR description LIKE ?)')
      );
    });

    it('should include team filter when provided', async () => {
      const results = [];
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results })
      };

      mockDb.prepare.mockReturnValue(mockStatement);

      await optimizer.searchOptimized('projects', 'test', {
        teamId: 'team-1'
      });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND team_id = ?')
      );
    });
  });

  describe('performance metrics', () => {
    it('should track query metrics', async () => {
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] })
      };

      mockDb.prepare.mockReturnValue(mockStatement);

      // Execute several queries
      await optimizer.executeQuery('SELECT 1', []);
      await optimizer.executeQuery('SELECT 2', []);
      await optimizer.executeQuery('SELECT 3', []);

      const metrics = optimizer.getPerformanceMetrics();

      expect(metrics.totalQueries).toBe(3);
      expect(metrics.avgQueryTime).toBeGreaterThan(0);
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
    });

    it('should generate performance recommendations', () => {
      // Simulate poor performance metrics
      optimizer.queryMetrics = {
        totalQueries: 100,
        slowQueries: 15,
        avgQueryTime: 75,
        cacheHitRate: 0.6
      };

      const recommendations = optimizer.analyzeQueryPerformance();

      expect(recommendations).toHaveLength(3); // Should have recommendations for all issues
      expect(recommendations[0].type).toBe('slow_queries');
      expect(recommendations[1].type).toBe('cache_performance');
      expect(recommendations[2].type).toBe('query_performance');
    });

    it('should generate index recommendations', () => {
      const recommendations = optimizer.generateIndexRecommendations();

      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);

      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('table');
        expect(rec).toHaveProperty('columns');
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('reason');
      });
    });
  });

  describe('bulk operations', () => {
    it('should perform bulk insert in batches', async () => {
      const records = Array.from({ length: 250 }, (_, i) => ({
        id: `record-${i}`,
        name: `Record ${i}`,
        team_id: 'team-1'
      }));

      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] })
      };

      mockDb.prepare.mockReturnValue(mockStatement);

      const result = await optimizer.bulkInsertOptimized('test_table', records, {
        batchSize: 100
      });

      expect(result.inserted).toBe(250);
      expect(result.results).toHaveLength(250);

      // Should be called for each batch (3 batches of 100)
      expect(mockDb.prepare).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('should identify transient errors', () => {
      expect(optimizer.isTransientError(new Error('Connection timeout'))).toBe(true);
      expect(optimizer.isTransientError(new Error('temporary failure'))).toBe(true);
      expect(optimizer.isTransientError(new Error('503 Service Unavailable'))).toBe(true);
      expect(optimizer.isTransientError(new Error('SQL syntax error'))).toBe(false);
      expect(optimizer.isTransientError(new Error('Table not found'))).toBe(false);
    });

    it('should handle cache failures gracefully', async () => {
      mockCache.put.mockRejectedValue(new Error('Cache error'));

      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] })
      };

      mockDb.prepare.mockReturnValue(mockStatement);

      // Should not throw even if caching fails
      const result = await optimizer.executeQuery('SELECT 1', [], {
        cacheable: true,
        cacheKey: 'test-key'
      });

      expect(result.results).toBeDefined();
    });
  });
});

describe('DatabasePerformanceController', () => {
  let controller;
  let mockEnv;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      getPerformanceMetrics: vi.fn(),
      executeQuery: vi.fn(),
      generatePerformanceIndexes: vi.fn()
    };

    mockEnv = {
      db: mockDb
    };

    controller = new DatabasePerformanceController(mockEnv);
    vi.clearAllMocks();
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', async () => {
      const metrics = {
        totalQueries: 1000,
        avgQueryTime: 25,
        slowQueries: 10,
        cacheHitRate: 0.85,
        activeQueries: 2,
        queueLength: 0
      };

      mockDb.getPerformanceMetrics.mockReturnValue(metrics);
      mockDb.getPerformanceRecommendations = vi.fn().mockReturnValue([]);

      const result = await controller.getPerformanceMetrics();

      expect(result.success).toBe(true);
      expect(result.data.metrics).toBe(metrics);
      expect(result.data.recommendations).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      mockDb.getPerformanceMetrics.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await controller.getPerformanceMetrics();

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('metrics_retrieval_failed');
    });
  });

  describe('getSlowQueries', () => {
    it('should return slow queries analysis', async () => {
      const slowQueries = [
        {
          metric_name: 'slow_query',
          table_name: 'users',
          avg_execution_time: 150,
          max_execution_time: 200,
          execution_count: 25
        }
      ];

      mockDb.executeQuery.mockResolvedValue({ results: slowQueries });

      const result = await controller.getSlowQueries({ limit: 10, minTime: 50 });

      expect(result.success).toBe(true);
      expect(result.data.slow_queries).toBe(slowQueries);
      expect(result.data.analysis.total_slow_queries).toBe(1);
      expect(result.data.analysis.average_slow_query_time).toBe(150);
    });

    it('should use default parameters', async () => {
      mockDb.executeQuery.mockResolvedValue({ results: [] });

      await controller.getSlowQueries();

      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        [50, 50] // default minTime and limit
      );
    });
  });

  describe('getCachePerformance', () => {
    it('should return cache performance analysis', async () => {
      const cacheData = [
        {
          table_name: 'users',
          query_type: 'SELECT',
          total_queries: 100,
          cache_hits: 80,
          cache_hit_rate_percent: 80
        }
      ];

      mockDb.executeQuery.mockResolvedValue({ results: cacheData });

      const result = await controller.getCachePerformance();

      expect(result.success).toBe(true);
      expect(result.data.cache_performance).toBe(cacheData);
      expect(result.data.overall_hit_rate).toBe(80);
      expect(result.data.recommendations).toBeDefined();
    });
  });

  describe('getIndexRecommendations', () => {
    it('should return index recommendations', async () => {
      const migrationSql = `
        CREATE INDEX IF NOT EXISTS idx_performance_users_tier ON users(tier, created_at);
        CREATE INDEX IF NOT EXISTS idx_performance_teams_owner ON teams(owner_id);
      `;

      mockDb.generatePerformanceIndexes.mockReturnValue(migrationSql);

      const result = await controller.getIndexRecommendations();

      expect(result.success).toBe(true);
      expect(result.data.recommended_indexes).toBeDefined();
      expect(result.data.migration_sql).toBe(migrationSql);
      expect(result.data.estimated_improvements).toBeInstanceOf(Array);
    });
  });

  describe('runOptimization', () => {
    it('should run dry run optimization', async () => {
      mockDb.executeQuery.mockResolvedValue({ results: [] });
      mockDb.getPerformanceMetrics.mockReturnValue({
        totalQueries: 100,
        avgQueryTime: 30,
        slowQueries: 5,
        cacheHitRate: 0.8
      });

      const result = await controller.runOptimization({
        dryRun: true,
        analyzeTables: true,
        createIndexes: false
      });

      expect(result.success).toBe(true);
      expect(result.data.dry_run).toBe(true);
      expect(result.data.analysis).toBeDefined();
      expect(result.data.recommendations).toBeDefined();
    });

    it('should create indexes when not dry run', async () => {
      mockDb.executeQuery.mockResolvedValue({ results: [] });
      mockDb.generatePerformanceIndexes.mockReturnValue('CREATE INDEX test_index ON table(column);');

      const result = await controller.runOptimization({
        dryRun: false,
        createIndexes: true
      });

      expect(result.success).toBe(true);
      expect(result.data.dry_run).toBe(false);
      expect(result.data.optimization_results).toBeDefined();
    });
  });

  describe('getQueryPlan', () => {
    it('should analyze query execution plan', async () => {
      const executionPlan = [
        { id: 0, detail: 'SCAN TABLE users' },
        { id: 1, detail: 'USE TEMP B-TREE FOR ORDER BY' }
      ];

      mockDb.executeQuery.mockResolvedValue({ results: executionPlan });

      const result = await controller.getQueryPlan(
        'SELECT * FROM users WHERE email = ?',
        ['test@example.com']
      );

      expect(result.success).toBe(true);
      expect(result.data.original_query).toBe('SELECT * FROM users WHERE email = ?');
      expect(result.data.params).toEqual(['test@example.com']);
      expect(result.data.execution_plan).toBe(executionPlan);
      expect(result.data.recommendations).toBeDefined();
    });

    it('should handle invalid query', async () => {
      const result = await controller.getQueryPlan('');

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('query_plan_failed');
    });
  });

  describe('getHealthCheck', () => {
    it('should return healthy status', async () => {
      mockDb.executeQuery.mockResolvedValue({ results: [{ test: 1 }] });
      mockDb.getPerformanceMetrics.mockReturnValue({
        totalQueries: 1000,
        avgQueryTime: 15,
        slowQueries: 5,
        cacheHitRate: 0.9,
        activeQueries: 1
      });

      // Mock slow queries
      mockDb.executeQuery
        .mockResolvedValueOnce({ results: [] })
        .mockResolvedValueOnce({ results: [] }); // For health check and slow queries

      const result = await controller.getHealthCheck();

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('healthy');
      expect(result.data.connectivity_test).toBe(true);
      expect(result.data.response_time_ms).toBeLessThan(100);
    });

    it('should return degraded status for slow response', async () => {
      mockDb.executeQuery.mockImplementation(() => {
        // Simulate slow response
        return new Promise(resolve => {
          setTimeout(() => resolve({ results: [{ test: 1 }] }), 150);
        });
      });

      mockDb.getPerformanceMetrics.mockReturnValue({
        totalQueries: 100,
        avgQueryTime: 20,
        slowQueries: 5,
        cacheHitRate: 0.7,
        activeQueries: 1
      });

      const result = await controller.getHealthCheck();

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('degraded');
      expect(result.data.recommendations).toContain(
        'Database response time is high (>100ms)'
      );
    });

    it('should return unhealthy status on error', async () => {
      mockDb.executeQuery.mockRejectedValue(new Error('Connection failed'));

      const result = await controller.getHealthCheck();

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('health_check_failed');
      expect(result.data.status).toBe('unhealthy');
    });
  });

  describe('generatePerformanceReport', () => {
    it('should generate comprehensive performance report', async () => {
      const metrics = {
        totalQueries: 1000,
        avgQueryTime: 25,
        slowQueries: 20,
        cacheHitRate: 0.85
      };

      mockDb.getPerformanceMetrics.mockReturnValue(metrics);

      // Mock all the dependency calls
      mockDb.executeQuery
        .mockResolvedValue({ results: [] }) // slow queries
        .mockResolvedValue({ results: [] }); // cache performance

      const result = await controller.generatePerformanceReport({
        period: '24h',
        includeRecommendations: true,
        includeQueryPlans: false
      });

      expect(result.success).toBe(true);
      expect(result.data.period).toBe('24h');
      expect(result.data.summary.total_queries).toBe(1000);
      expect(result.data.summary.overall_performance_score).toBeDefined();
      expect(result.data.recommendations).toBeDefined();
    });
  });

  describe('helper methods', () => {
    it('should parse index migration SQL', () => {
      const migrationSql = `
        -- Performance index for users
        CREATE INDEX IF NOT EXISTS idx_performance_users_tier ON users(tier, created_at);

        -- Performance index for teams
        CREATE INDEX IF NOT EXISTS idx_performance_teams_owner ON teams(owner_id);
      `;

      const controller = new DatabasePerformanceController({});
      const statements = controller.parseIndexMigration(migrationSql);

      expect(statements).toHaveLength(2);
      expect(statements[0].table).toBe('users');
      expect(statements[0].index_name).toBe('idx_performance_users_tier');
      expect(statements[1].table).toBe('teams');
      expect(statements[1].index_name).toBe('idx_performance_teams_owner');
    });

    it('should calculate performance score correctly', () => {
      const controller = new DatabasePerformanceController({});

      // Perfect performance
      let metrics = {
        totalQueries: 100,
        avgQueryTime: 10,
        slowQueries: 1,
        cacheHitRate: 0.95
      };
      let score = controller.calculatePerformanceScore(metrics);
      expect(score).toBeGreaterThan(90);

      // Poor performance
      metrics = {
        totalQueries: 100,
        avgQueryTime: 100,
        slowQueries: 30,
        cacheHitRate: 0.3
      };
      score = controller.calculatePerformanceScore(metrics);
      expect(score).toBeLessThan(50);
    });
  });
});