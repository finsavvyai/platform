/**
 * Database Optimization Service Unit Tests
 * Test query optimization, indexing, and performance monitoring
 */

import { DatabaseOptimizationService } from '../../services/DatabaseOptimizationService.js';
import { DatabaseService } from '../../services/DatabaseService.js';

// Mock DatabaseService
jest.mock('../../services/DatabaseService.js', () => {
  return {
    DatabaseService: jest.fn().mockImplementation(() => ({
      query: jest.fn(),
    })),
  };
});

describe('DatabaseOptimizationService', () => {
  let dbOptimizationService: DatabaseOptimizationService;
  let mockDbService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockDbService = DatabaseService.getInstance() as jest.Mocked<DatabaseService>;
    dbOptimizationService = new DatabaseOptimizationService(mockDbService, {
      slowQueryThreshold: 100,
      enableAutoAnalysis: true,
    });

    // Clear any stored metrics
    (dbOptimizationService as any).queryMetrics.clear();
    jest.clearAllMocks();
  });

  describe('Query Execution with Metrics', () => {
    test('should execute query and collect metrics', async () => {
      const query = 'SELECT * FROM users WHERE id = $1';
      const params = [1];
      const mockData = { rows: [{ id: 1, name: 'test' }], rowCount: 1 };

      mockDbService.query.mockResolvedValue(mockData);

      const result = await dbOptimizationService.executeQueryWithMetrics(query, params);

      expect(result.data).toEqual(mockData);
      expect(result.metrics).toBeDefined();
      expect(result.metrics!.query).toBe(query);
      expect(result.metrics!.rowsReturned).toBe(1);
      expect(result.metrics!.executionTime).toBeGreaterThan(0);
      expect(mockDbService.query).toHaveBeenCalledWith(query, params);
    });

    test('should execute query without metrics collection', async () => {
      const query = 'SELECT 1';
      const mockData = { rows: [{ result: 1 }], rowCount: 1 };

      mockDbService.query.mockResolvedValue(mockData);

      const result = await dbOptimizationService.executeQueryWithMetrics(query, [], {
        collectMetrics: false,
      });

      expect(result.data).toEqual(mockData);
      expect(result.metrics).toBeNull();
    });

    test('should handle query errors', async () => {
      const query = 'SELECT * FROM non_existent_table';
      const error = new Error('Table does not exist');

      mockDbService.query.mockRejectedValue(error);

      await expect(dbOptimizationService.executeQueryWithMetrics(query))
        .rejects.toThrow(error);

      expect(mockDbService.query).toHaveBeenCalledWith(query, []);
    });

    test('should log slow queries', async () => {
      const query = 'SELECT * FROM large_table';
      const mockData = { rows: [], rowCount: 0 };

      // Simulate slow query
      mockDbService.query.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 150)); // 150ms delay
        return mockData;
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await dbOptimizationService.executeQueryWithMetrics(query, [], {
        analyzeIfSlow: false, // Disable auto-analysis to avoid additional calls
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow query detected'),
        expect.objectContaining({
          executionTime: expect.any(Number),
        })
      );

      consoleSpy.mockRestore();
    });

    test('should normalize query when requested', async () => {
      const query = 'SELECT * FROM users WHERE id = 1';
      const mockData = { rows: [{ id: 1 }], rowCount: 1 };

      mockDbService.query.mockResolvedValue(mockData);

      const result = await dbOptimizationService.executeQueryWithMetrics(query, [], {
        normalize: true,
      });

      expect(result.metrics!.query).toBe('select * from users where id = 1');
    });
  });

  describe('Query Analysis', () => {
    test('should explain query successfully', async () => {
      const query = 'SELECT * FROM users WHERE id = $1';
      const explainPlan = {
        'QUERY PLAN': [
          {
            Plan: {
              'Node Type': 'Index Scan',
              'Plan Rows': 1,
              'Total Cost': 8.28,
            },
          },
        ],
      };

      mockDbService.query.mockResolvedValue({
        rows: [{ 'QUERY PLAN': JSON.stringify(explainPlan) }],
      });

      const analysis = await dbOptimizationService.explainQuery(query, [1]);

      expect(analysis.query).toBe(query);
      expect(analysis.normalizedQuery).toBe('select * from users where id = $1');
      expect(analysis.estimatedCost).toBe(8.28);
      expect(analysis.estimatedRows).toBe(1);
      expect(analysis.performanceIssues).toHaveLength(0);
    });

    test('should detect performance issues in execution plan', async () => {
      const query = 'SELECT * FROM large_table';
      const explainPlan = {
        'QUERY PLAN': [
          {
            Plan: {
              'Node Type': 'Seq Scan',
              'Plan Rows': 50000,
              'Total Cost': 15000,
            },
          },
        ],
      };

      mockDbService.query.mockResolvedValue({
        rows: [{ 'QUERY PLAN': JSON.stringify(explainPlan) }],
      });

      const analysis = await dbOptimizationService.explainQuery(query);

      expect(analysis.performanceIssues).toContain(
        'Sequential scan on large table (estimated 50000 rows)'
      );
      expect(analysis.recommendations).toContain(
        'Consider adding indexes for frequently queried columns'
      );
    });

    test('should handle explain query errors', async () => {
      const query = 'INVALID QUERY';
      mockDbService.query.mockRejectedValue(new Error('Syntax error'));

      const analysis = await dbOptimizationService.explainQuery(query);

      expect(analysis.performanceIssues).toContain('Failed to analyze query');
      expect(analysis.recommendations).toContain('Check query syntax and try again');
    });
  });

  describe('Table Statistics', () => {
    test('should get table statistics for all tables', async () => {
      const mockStats = [
        {
          table_name: 'users',
          total_rows: 1000,
          estimated_size: 1000000,
          index_count: 3,
          last_vacuum: '2023-01-01T00:00:00Z',
          last_analyze: '2023-01-01T00:00:00Z',
          bloat_percentage: 5.0,
        },
        {
          table_name: 'orders',
          total_rows: 5000,
          estimated_size: 5000000,
          index_count: 5,
          last_vacuum: null,
          last_analyze: null,
          bloat_percentage: 10.0,
        },
      ];

      mockDbService.query.mockResolvedValue({ rows: mockStats });

      const stats = await dbOptimizationService.getTableStats();

      expect(stats).toHaveLength(2);
      expect(stats[0].tableName).toBe('users');
      expect(stats[0].totalRows).toBe(1000);
      expect(stats[0].indexCount).toBe(3);
      expect(stats[1].vacuumStatus).toBe('pending');
      expect(stats[1].analyzeStatus).toBe('pending');
    });

    test('should get statistics for specific table', async () => {
      const mockStats = [
        {
          table_name: 'users',
          total_rows: 1000,
          estimated_size: 1000000,
          index_count: 3,
          vacuum_status: 'completed',
          analyze_status: 'completed',
        },
      ];

      mockDbService.query.mockResolvedValue({ rows: mockStats });

      const stats = await dbOptimizationService.getTableStats('users');

      expect(stats).toHaveLength(1);
      expect(stats[0].tableName).toBe('users');
    });

    test('should handle empty table statistics', async () => {
      mockDbService.query.mockResolvedValue({ rows: [] });

      const stats = await dbOptimizationService.getTableStats();

      expect(stats).toHaveLength(0);
    });
  });

  describe('Index Management', () => {
    test('should create index successfully', async () => {
      mockDbService.query.mockResolvedValue({});

      const success = await dbOptimizationService.createIndex('users', ['email'], 'btree');

      expect(success).toBe(true);
      expect(mockDbService.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX CONCURRENTLY idx_users_email')
      );
    });

    test('should handle index creation failure', async () => {
      mockDbService.query.mockRejectedValue(new Error('Index already exists'));

      const success = await dbOptimizationService.createIndex('users', ['email'], 'btree');

      expect(success).toBe(false);
    });

    test('should get index recommendations', async () => {
      // Set up slow query history
      const slowQuery = {
        query: 'select * from users where email = $1',
        executionTime: 200,
        rowsReturned: 1,
        memoryUsage: 0,
        indexHits: 0,
        indexMisses: 10,
        cacheHitRatio: 0,
        timestamp: new Date(),
      };

      (dbOptimizationService as any).queryMetrics.set(
        'select * from users where email = $1',
        [slowQuery, slowQuery, slowQuery, slowQuery, slowQuery, slowQuery] // 6 executions
      );

      // Mock explain analysis to return suggestion
      const originalExplain = dbOptimizationService.explainQuery;
      const mockExplain = jest.fn().mockResolvedValue({
        query: 'select * from users where email = $1',
        normalizedQuery: 'select * from users where email = $1',
        executionPlan: { Plan: { 'Node Type': 'Seq Scan', 'Plan Rows': 10000 } },
        estimatedCost: 1000,
        estimatedRows: 10000,
        performanceIssues: ['Sequential scan on large table'],
        recommendations: ['Consider adding indexes'],
        suggestedIndex: {
          tableName: 'users',
          columns: ['email'],
          indexType: 'btree',
          estimatedPerformanceGain: 80,
          priority: 'high',
          existingIndexes: [],
        },
      });

      (dbOptimizationService as any).explainQuery = mockExplain;

      mockDbService.query.mockResolvedValue({ rows: [] }); // For missing indexes query

      const recommendations = await dbOptimizationService.getIndexRecommendations();

      expect(recommendations).toContainEqual(
        expect.objectContaining({
          tableName: 'users',
          columns: ['email'],
          priority: 'high',
        })
      );

      // Restore original method
      (dbOptimizationService as any).explainQuery = originalExplain;
    });
  });

  describe('Database Maintenance', () => {
    test('should perform vacuum and analyze', async () => {
      mockDbService.query.mockResolvedValue({});

      const success = await dbOptimizationService.vacuumAnalyze('users', {
        full: true,
        analyze: true,
        verbose: true,
      });

      expect(success).toBe(true);
      expect(mockDbService.query).toHaveBeenCalledWith(
        expect.stringContaining('VACUUM (FULL, ANALYZE, VERBOSE) users')
      );
    });

    test('should perform simple vacuum', async () => {
      mockDbService.query.mockResolvedValue({});

      const success = await dbOptimizationService.vacuumAnalyze('orders');

      expect(success).toBe(true);
      expect(mockDbService.query).toHaveBeenCalledWith(
        expect.stringContaining('VACUUM (ANALYZE) orders')
      );
    });

    test('should handle vacuum failures', async () => {
      mockDbService.query.mockRejectedValue(new Error('Permission denied'));

      const success = await dbOptimizationService.vacuumAnalyze('users');

      expect(success).toBe(false);
    });
  });

  describe('Query Metrics', () => {
    test('should track query metrics summary', async () => {
      // Add some query metrics
      const metrics1 = [
        { executionTime: 50, rowsReturned: 1, cacheHitRatio: 90 },
        { executionTime: 60, rowsReturned: 1, cacheHitRatio: 95 },
      ];

      const metrics2 = [
        { executionTime: 150, rowsReturned: 10, cacheHitRatio: 80 }, // Slow query
        { executionTime: 160, rowsReturned: 10, cacheHitRatio: 85 }, // Slow query
      ];

      (dbOptimizationService as any).queryMetrics.set('query1', metrics1);
      (dbOptimizationService as any).queryMetrics.set('query2', metrics2);

      const summary = dbOptimizationService.getQueryMetricsSummary();

      expect(summary.totalQueries).toBe(4);
      expect(summary.averageExecutionTime).toBe(105); // (50+60+150+160)/4
      expect(summary.slowQueries).toBe(2);
      expect(summary.cacheHitRatio).toBeGreaterThan(85);
      expect(summary.topSlowQueries).toHaveLength(2);
    });

    test('should handle empty query metrics', () => {
      const summary = dbOptimizationService.getQueryMetricsSummary();

      expect(summary.totalQueries).toBe(0);
      expect(summary.averageExecutionTime).toBe(0);
      expect(summary.slowQueries).toBe(0);
      expect(summary.topSlowQueries).toHaveLength(0);
    });

    test('should clear query metrics', () => {
      (dbOptimizationService as any).queryMetrics.set('test', [
        { executionTime: 100, rowsReturned: 1 },
      ]);

      dbOptimizationService.clearMetrics();

      const summary = dbOptimizationService.getQueryMetricsSummary();
      expect(summary.totalQueries).toBe(0);
    });
  });

  describe('Performance Analysis', () => {
    test('should identify frequent slow queries', () => {
      const frequentSlowQuery = [
        { executionTime: 200, rowsReturned: 1 },
        { executionTime: 210, rowsReturned: 1 },
        { executionTime: 190, rowsReturned: 1 },
        { executionTime: 220, rowsReturned: 1 },
        { executionTime: 180, rowsReturned: 1 },
        { executionTime: 230, rowsReturned: 1 },
      ];

      const fastQuery = [
        { executionTime: 50, rowsReturned: 1 },
      ];

      (dbOptimizationService as any).queryMetrics.set('slow_query', frequentSlowQuery);
      (dbOptimizationService as any).queryMetrics.set('fast_query', fastQuery);

      const slowQueries = (dbOptimizationService as any).getFrequentSlowQueries();

      expect(slowQueries).toHaveLength(1);
      expect(slowQueries[0].executionTime).toBeGreaterThan(100);
    });

    test('should not include queries with insufficient executions', () => {
      const infrequentSlowQuery = [
        { executionTime: 200, rowsReturned: 1 },
        { executionTime: 210, rowsReturned: 1 },
      ]; // Only 2 executions

      (dbOptimizationService as any).queryMetrics.set('infrequent', infrequentSlowQuery);

      const slowQueries = (dbOptimizationService as any).getFrequentSlowQueries();

      expect(slowQueries).toHaveLength(0);
    });

    test('should analyze execution plan for performance issues', () => {
      const expensivePlan = {
        'Node Type': 'Hash Join',
        'Plan Rows': 50000,
        'Total Cost': 15000,
        Plans: [
          {
            'Node Type': 'Seq Scan',
            'Plan Rows': 10000,
            'Filter': 'id > 100',
          },
        ],
      };

      const issues = (dbOptimizationService as any).analyzeExecutionPlan(expensivePlan);

      expect(issues).toContain('Sequential scan on large table (estimated 10000 rows)');
      expect(issues).toContain('Expensive hash join operation');
      expect(issues).toContain('High execution cost detected');
    });

    test('should generate recommendations from execution plan', () => {
      const joinPlan = {
        'Node Type': 'Hash Join',
        'Plan Rows': 1000,
        Plans: [],
      };

      const recommendations = (dbOptimizationService as any).generateRecommendations(joinPlan);

      expect(recommendations).toContain('Ensure join columns are properly indexed');
    });
  });

  describe('Configuration', () => {
    test('should use custom slow query threshold', async () => {
      const service = new DatabaseOptimizationService(mockDbService, {
        slowQueryThreshold: 200,
        enableAutoAnalysis: false,
      });

      // Execute a query that would be slow with default threshold but not custom
      const query = 'SELECT * FROM users';
      const mockData = { rows: [], rowCount: 0 };

      mockDbService.query.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 150)); // 150ms delay
        return mockData;
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await service.executeQueryWithMetrics(query, [], {
        analyzeIfSlow: false,
      });

      // Should not log as slow query since 150 < 200
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should disable auto analysis when configured', async () => {
      const service = new DatabaseOptimizationService(mockDbService, {
        slowQueryThreshold: 100,
        enableAutoAnalysis: false,
      });

      const explainSpy = jest.spyOn(service, 'explainQuery').mockResolvedValue({
        query: 'SELECT 1',
        normalizedQuery: 'select 1',
        executionPlan: null,
        estimatedCost: 0,
        estimatedRows: 0,
        performanceIssues: [],
        recommendations: [],
      });

      const query = 'SELECT 1';
      const mockData = { rows: [{ result: 1 }], rowCount: 1 };

      mockDbService.query.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 150)); // Slow query
        return mockData;
      });

      await service.executeQueryWithMetrics(query, [], {
        analyzeIfSlow: true,
      });

      // Should not call explainQuery since auto-analysis is disabled
      expect(explainSpy).not.toHaveBeenCalled();

      explainSpy.mockRestore();
    });
  });

  describe('Memory Management', () => {
    test('should limit query metrics history', async () => {
      const query = 'SELECT 1';
      const mockData = { rows: [{ result: 1 }], rowCount: 1 };

      mockDbService.query.mockResolvedValue(mockData);

      // Execute 110 queries to exceed the 100 limit
      for (let i = 0; i < 110; i++) {
        await dbOptimizationService.executeQueryWithMetrics(query);
      }

      const metrics = (dbOptimizationService as any).queryMetrics.get(query);
      expect(metrics).toHaveLength(100); // Should be limited to 100
    });

    test('should track memory usage in metrics', async () => {
      const query = 'SELECT 1';
      const mockData = { rows: [{ result: 1 }], rowCount: 1 };

      mockDbService.query.mockResolvedValue(mockData);

      const result = await dbOptimizationService.executeQueryWithMetrics(query, [], {
        collectMetrics: true,
      });

      expect(result.metrics!.memoryUsage).toBeGreaterThanOrEqual(0);
    });
  });
});