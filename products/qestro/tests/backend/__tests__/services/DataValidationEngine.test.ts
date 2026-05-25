// @ts-nocheck - Skip TypeScript checking for test mocks
import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { dataValidationEngine } from '../../../../backend/src/services/DataValidationEngine.js';
import { connectionPoolManager } from '../../../../backend/src/services/ConnectionPoolManager.js';
import { db, closeDatabaseConnection } from '../../../../backend/src/lib/db.js';
import { databaseConnections, databaseTestResults } from '../../../../backend/src/schema/index.js';
import { eq } from 'drizzle-orm';

// Mock the logger
jest.mock('../../../../backend/src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock database connection
const mockConnection = {
  query: jest.fn(),
  execute: jest.fn(),
  end: jest.fn(),
  connect: jest.fn(),
  release: jest.fn()
};

// Mock pool
const mockPool = {
  query: jest.fn(),
  execute: jest.fn(),
  connect: jest.fn().mockResolvedValue(mockConnection),
  end: jest.fn(),
  getConnection: jest.fn().mockResolvedValue(mockConnection)
};

describe('DataValidationEngine', () => {
  let testConnectionId: string;

  beforeAll(async () => {
    // Create test database connection
    const connection = await db.insert(databaseConnections).values({
      userId: '00000000-0000-0000-0000-000000000001',
      name: 'Test Validation Connection',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      username: 'test_user',
      password: 'test_password',
      ssl: false,
      maxConnections: 10,
      connectionTimeout: 30000,
      status: 'connected'
    }).returning({ id: databaseConnections.id });

    testConnectionId = connection[0].id;
  });

  afterAll(async () => {
    try {
      // Clean up test data
      if (testConnectionId) {
        await db.delete(databaseConnections).where(eq(databaseConnections.id, testConnectionId));
      }
      await dataValidationEngine.closeAllConnections();
      await connectionPoolManager.closeAllPools();
      await closeDatabaseConnection();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }, 30000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Database Validation', () => {
    test('should validate database with default rules', async () => {
      // Mock pool manager
      jest.spyOn(connectionPoolManager, 'getConnection').mockResolvedValue(mockPool);

      // Mock query results for validation rules
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // uniqueness check - no duplicates
        .mockResolvedValueOnce({ rows: [{ null_count: 0 }], rowCount: 1 }); // null check - no nulls

      const report = await dataValidationEngine.validateDatabase(testConnectionId);

      expect(report).toBeDefined();
      expect(report.connectionId).toBe(testConnectionId);
      expect(report.totalRules).toBeGreaterThan(0);
      expect(report.results).toBeDefined();
      expect(report.qualityMetrics).toBeDefined();
      expect(report.executionTime).toBeGreaterThan(0);
    });

    test('should validate database with custom rules', async () => {
      jest.spyOn(connectionPoolManager, 'getConnection').mockResolvedValue(mockPool);

      const customRules = [
        {
          id: 'custom_rule_1',
          name: 'Custom Validation Rule',
          type: 'quality' as const,
          query: 'SELECT COUNT(*) as count FROM test_table WHERE status IS NULL',
          expectedResult: 0,
          severity: 'medium' as const,
          description: 'Check for null status values',
          autoFix: false
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: [{ count: 0 }], rowCount: 1 });

      const report = await dataValidationEngine.validateDatabase(testConnectionId, customRules);

      expect(report).toBeDefined();
      expect(report.totalRules).toBe(1);
      expect(report.results[0].ruleId).toBe('custom_rule_1');
      expect(report.results[0].passed).toBe(true);
    });

    test('should handle validation failures correctly', async () => {
      jest.spyOn(connectionPoolManager, 'getConnection').mockResolvedValue(mockPool);

      const customRules = [
        {
          id: 'failing_rule',
          name: 'Failing Rule',
          type: 'uniqueness' as const,
          query: 'SELECT id FROM users GROUP BY id HAVING COUNT(*) > 1',
          severity: 'critical' as const,
          description: 'Check for duplicate IDs',
          autoFix: false
        }
      ];

      // Mock query result showing duplicates found
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1 }, { id: 2 }],
        rowCount: 2
      });

      const report = await dataValidationEngine.validateDatabase(testConnectionId, customRules);

      expect(report.failedRules).toBe(1);
      expect(report.criticalIssues).toBe(1);
      expect(report.results[0].passed).toBe(false);
      expect(report.results[0].severity).toBe('critical');
    });
  });

  describe('Data Consistency Validation', () => {
    test('should validate consistency between tables', async () => {
      jest.spyOn(connectionPoolManager, 'getConnection').mockResolvedValue(mockPool);

      // Mock query for consistency check - no orphaned records
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const results = await dataValidationEngine.validateDataConsistency(
        testConnectionId,
        ['users', 'orders']
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    test('should detect consistency issues', async () => {
      jest.spyOn(connectionPoolManager, 'getConnection').mockResolvedValue(mockPool);

      // Mock query showing orphaned records
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1 }, { id: 2 }],
        rowCount: 2
      });

      const results = await dataValidationEngine.validateDataConsistency(
        testConnectionId,
        ['orders', 'customers']
      );

      expect(results[0].passed).toBe(false);
      expect(results[0].severity).toBe('medium');
    });
  });

  describe('Auto-Fix Functionality', () => {
    test('should auto-fix fixable issues', async () => {
      jest.spyOn(connectionPoolManager, 'getConnection').mockResolvedValue(mockPool);

      // Mock successful fix query execution
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await dataValidationEngine.autoFixIssues(
        testConnectionId,
        ['fixable_rule_1']
      );

      expect(result.fixed).toContain('fixable_rule_1');
      expect(result.failed).toHaveLength(0);
    });

    test('should handle fix failures', async () => {
      jest.spyOn(connectionPoolManager, 'getConnection').mockResolvedValue(mockPool);

      // Mock failed fix query execution
      mockPool.query.mockRejectedValueOnce(new Error('Fix query failed'));

      const result = await dataValidationEngine.autoFixIssues(
        testConnectionId,
        ['unfixable_rule_1']
      );

      expect(result.failed).toContain('unfixable_rule_1');
      expect(result.errors['unfixable_rule_1']).toBeDefined();
    });
  });

  describe('Connection Pool Management', () => {
    test('should create and manage connection pools', async () => {
      const mockCreatePool = jest.spyOn(connectionPoolManager, 'createPool').mockResolvedValue();
      const mockGetConnection = jest.spyOn(connectionPoolManager, 'getConnection').mockResolvedValue(mockPool);

      await dataValidationEngine.validateDatabase(testConnectionId);

      expect(mockGetConnection).toHaveBeenCalledWith(testConnectionId);
    });

    test('should handle connection pool errors', async () => {
      jest.spyOn(connectionPoolManager, 'getConnection').mockRejectedValue(
        new Error('Connection pool error')
      );

      await expect(dataValidationEngine.validateDatabase(testConnectionId))
        .rejects.toThrow('Connection pool error');
    });
  });

  describe('Multi-Database Support', () => {
    test('should support PostgreSQL validation', async () => {
      const pgConnection = await db.insert(databaseConnections).values({
        userId: 'test-user-id',
        name: 'PostgreSQL Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test_pg',
        username: 'postgres',
        password: 'password',
        status: 'connected'
      }).returning({ id: databaseConnections.id });

      jest.spyOn(connectionPoolManager, 'getConnection').mockResolvedValue(mockPool);
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const report = await dataValidationEngine.validateDatabase(pgConnection[0].id);

      expect(report).toBeDefined();
      expect(report.connectionId).toBe(pgConnection[0].id);

      // Clean up
      await db.delete(databaseConnections).where(eq(databaseConnections.id, pgConnection[0].id));
    });

    test('should support MySQL validation', async () => {
      const mysqlConnection = await db.insert(databaseConnections).values({
        userId: 'test-user-id',
        name: 'MySQL Test Connection',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'test_mysql',
        username: 'root',
        password: 'password',
        status: 'connected'
      }).returning({ id: databaseConnections.id });

      const mockMysqlPool = {
        execute: jest.fn().mockResolvedValue([[], {}]),
        end: jest.fn()
      };

      jest.spyOn(connectionPoolManager, 'getConnection').mockResolvedValue(mockMysqlPool);

      const report = await dataValidationEngine.validateDatabase(mysqlConnection[0].id);

      expect(report).toBeDefined();
      expect(report.connectionId).toBe(mysqlConnection[0].id);

      // Clean up
      await db.delete(databaseConnections).where(eq(databaseConnections.id, mysqlConnection[0].id));
    });
  });

  describe('Quality Metrics Calculation', () => {
    test('should calculate data quality metrics', async () => {
      jest.spyOn(connectionPoolManager, 'getConnection').mockResolvedValue(mockPool);

      // Mock queries for quality metrics
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // validation rules
        .mockResolvedValueOnce({ rows: [{ completeness: 95 }], rowCount: 1 }); // completeness metric

      const report = await dataValidationEngine.validateDatabase(testConnectionId);

      expect(report.qualityMetrics).toBeDefined();
      expect(report.qualityMetrics.completeness).toBeGreaterThanOrEqual(0);
      expect(report.qualityMetrics.uniqueness).toBeGreaterThanOrEqual(0);
      expect(report.qualityMetrics.validity).toBeGreaterThanOrEqual(0);
      expect(report.qualityMetrics.overallScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Recommendations Generation', () => {
    test('should generate recommendations based on validation results', async () => {
      jest.spyOn(connectionPoolManager, 'getConnection').mockResolvedValue(mockPool);

      const customRules = [
        {
          id: 'critical_issue',
          name: 'Critical Data Issue',
          type: 'constraint' as const,
          query: 'SELECT COUNT(*) FROM users WHERE email IS NULL',
          expectedResult: 0,
          severity: 'critical' as const,
          description: 'Critical constraint violation',
          autoFix: true,
          fixQuery: 'UPDATE users SET email = \'unknown@example.com\' WHERE email IS NULL'
        }
      ];

      // Mock query showing critical issue
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: 5 }], rowCount: 1 });

      const report = await dataValidationEngine.validateDatabase(testConnectionId, customRules);

      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some(r =>
        r.includes('critical') || r.includes('automatically fixed')
      )).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      jest.spyOn(connectionPoolManager, 'getConnection').mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(dataValidationEngine.validateDatabase('invalid-connection-id'))
        .rejects.toThrow();
    });

    test('should handle malformed validation rules', async () => {
      jest.spyOn(connectionPoolManager, 'getConnection').mockResolvedValue(mockPool);

      const malformedRules = [
        {
          id: 'malformed_rule',
          name: 'Malformed Rule',
          type: 'invalid_type' as any,
          query: 'INVALID SQL QUERY',
          severity: 'medium' as const,
          description: 'This rule will fail',
          autoFix: false
        }
      ];

      mockPool.query.mockRejectedValue(new Error('SQL syntax error'));

      const report = await dataValidationEngine.validateDatabase(testConnectionId, malformedRules);

      expect(report.results[0].passed).toBe(false);
      expect(report.results[0].description).toContain('execution failed');
    });
  });

  describe('Performance', () => {
    test('should complete validation within reasonable time', async () => {
      jest.spyOn(connectionPoolManager, 'getConnection').mockResolvedValue(mockPool);
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const startTime = performance.now();
      const report = await dataValidationEngine.validateDatabase(testConnectionId);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(report.executionTime).toBeGreaterThan(0);
    });

    test('should handle large datasets efficiently', async () => {
      jest.spyOn(connectionPoolManager, 'getConnection').mockResolvedValue(mockPool);

      // Mock large dataset response
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      mockPool.query.mockResolvedValue({ rows: largeDataset, rowCount: 1000 });

      const report = await dataValidationEngine.validateDatabase(testConnectionId);

      expect(report).toBeDefined();
      expect(report.executionTime).toBeLessThan(10000); // Should handle large datasets efficiently
    });
  });
});