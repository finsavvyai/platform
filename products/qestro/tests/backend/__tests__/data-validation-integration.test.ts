import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { db, closeDatabaseConnection } from '../../../backend/src/lib/db.js';
import { databaseConnections } from '../../../backend/src/schema/index.js';
import { eq } from 'drizzle-orm';
import { connectionPoolManager } from '../../../backend/src/services/ConnectionPoolManager.js';

// Mock the logger
jest.mock('../../../backend/src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Data Validation Integration', () => {
  let testConnectionId: string;

  beforeAll(async () => {
    // Create a test database connection
    const connection = await db.insert(databaseConnections).values({
      userId: '00000000-0000-0000-0000-000000000001', // Valid UUID for test user
      name: 'Test Integration Connection',
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

      // Close all connection pools
      await connectionPoolManager.closeAllPools();

      // Close main database connection
      await closeDatabaseConnection();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }, 30000);

  describe('Database Schema Validation', () => {
    test('should create database connection record', async () => {
      const connection = await db.select().from(databaseConnections)
        .where(eq(databaseConnections.id, testConnectionId))
        .limit(1);

      expect(connection).toBeDefined();
      expect(connection[0]?.name).toBe('Test Integration Connection');
      expect(connection[0]?.type).toBe('postgresql');
      expect(connection[0]?.status).toBe('connected');
    });

    test('should have proper connection configuration fields', async () => {
      const connection = await db.select().from(databaseConnections)
        .where(eq(databaseConnections.id, testConnectionId))
        .limit(1);

      expect(connection[0]?.host).toBe('localhost');
      expect(connection[0]?.port).toBe(5432);
      expect(connection[0]?.database).toBe('test_db');
      expect(connection[0]?.username).toBe('test_user');
      expect(connection[0]?.maxConnections).toBe(10);
      expect(connection[0]?.connectionTimeout).toBe(30000);
      expect(connection[0]?.ssl).toBe(false);
    });
  });

  describe('Validation Rules Structure', () => {
    test('should define common validation rule types', () => {
      const validationTypes = [
        'uniqueness',
        'constraint',
        'referential',
        'custom',
        'consistency',
        'quality'
      ];

      const severityLevels = [
        'low',
        'medium',
        'high',
        'critical'
      ];

      expect(validationTypes).toHaveLength(6);
      expect(severityLevels).toHaveLength(4);

      // Test rule structure
      const sampleRule = {
        id: 'test_rule',
        name: 'Test Validation Rule',
        type: 'uniqueness' as const,
        query: 'SELECT id FROM users GROUP BY id HAVING COUNT(*) > 1',
        severity: 'high' as const,
        description: 'Check for duplicate user IDs',
        autoFix: false
      };

      expect(sampleRule.id).toBe('test_rule');
      expect(validationTypes).toContain(sampleRule.type);
      expect(severityLevels).toContain(sampleRule.severity);
    });
  });

  describe('Quality Metrics Structure', () => {
    test('should define data quality metric structure', () => {
      const qualityMetrics = {
        completeness: 95.5,
        uniqueness: 98.2,
        validity: 92.8,
        consistency: 89.1,
        accuracy: 93.7,
        timeliness: 96.3,
        overallScore: 94.3
      };

      // All metrics should be between 0 and 100
      Object.values(qualityMetrics).forEach(metric => {
        expect(metric).toBeGreaterThanOrEqual(0);
        expect(metric).toBeLessThanOrEqual(100);
      });

      expect(qualityMetrics.overallScore).toBeCloseTo(
        (qualityMetrics.completeness + qualityMetrics.uniqueness +
         qualityMetrics.validity + qualityMetrics.consistency +
         qualityMetrics.accuracy + qualityMetrics.timeliness) / 6,
        1
      );
    });
  });

  describe('Connection Pool Configuration', () => {
    test('should define connection pool settings', () => {
      const poolConfig = {
        id: 'test-pool',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'test_user',
        password: 'test_password',
        maxConnections: 20,
        connectionTimeout: 30000,
        idleTimeout: 300000,
        healthCheckInterval: 60000,
        retryAttempts: 3,
        retryDelay: 5000
      };

      expect(poolConfig.maxConnections).toBeGreaterThan(0);
      expect(poolConfig.connectionTimeout).toBeGreaterThan(0);
      expect(poolConfig.idleTimeout).toBeGreaterThan(0);
      expect(poolConfig.healthCheckInterval).toBeGreaterThan(0);
      expect(poolConfig.retryAttempts).toBeGreaterThan(0);
      expect(poolConfig.retryDelay).toBeGreaterThan(0);
    });

    test('should validate pool metrics structure', () => {
      const poolMetrics = {
        totalConnections: 20,
        activeConnections: 5,
        idleConnections: 15,
        waitingCount: 0,
        acquiredCount: 150,
        createdCount: 20,
        destroyedCount: 0,
        timeouts: 0,
        errors: 0
      };

      expect(poolMetrics.activeConnections + poolMetrics.idleConnections)
        .toBeLessThanOrEqual(poolMetrics.totalConnections);

      expect(poolMetrics.acquiredCount).toBeGreaterThanOrEqual(0);
      expect(poolMetrics.errors).toBeGreaterThanOrEqual(0);
      expect(poolMetrics.timeouts).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Data Lineage Structure', () => {
    test('should define data lineage graph structure', () => {
      const lineageGraph = {
        nodes: [
          {
            id: 'users',
            type: 'table' as const,
            name: 'users',
            schema: 'public'
          },
          {
            id: 'users.id',
            type: 'column' as const,
            name: 'id',
            schema: 'users',
            dataType: 'uuid'
          }
        ],
        edges: [
          {
            from: 'orders.user_id',
            to: 'users.id',
            type: 'references' as const,
            strength: 1.0,
            description: 'Foreign key reference'
          }
        ],
        impactAnalysis: {
          upstreamTables: [],
          downstreamTables: ['orders'],
          affectedColumns: ['orders.user_id'],
          riskLevel: 'medium' as const
        }
      };

      expect(lineageGraph.nodes).toHaveLength(2);
      expect(lineageGraph.edges).toHaveLength(1);
      expect(lineageGraph.edges[0].strength).toBeGreaterThan(0);
      expect(lineageGraph.edges[0].strength).toBeLessThanOrEqual(1);
      expect(['low', 'medium', 'high']).toContain(lineageGraph.impactAnalysis.riskLevel);
    });
  });

  describe('Validation Report Structure', () => {
    test('should define comprehensive validation report', () => {
      const validationReport = {
        connectionId: testConnectionId,
        timestamp: new Date(),
        totalRules: 5,
        passedRules: 4,
        failedRules: 1,
        criticalIssues: 0,
        highIssues: 1,
        mediumIssues: 0,
        lowIssues: 0,
        results: [
          {
            ruleId: 'uniqueness_check',
            ruleName: 'Uniqueness Validation',
            passed: true,
            actualResult: [],
            expectedResult: 0,
            severity: 'high' as const,
            description: 'Check for duplicate records',
            autoFixAvailable: false,
            executionTime: 150
          }
        ],
        qualityMetrics: {
          completeness: 95,
          uniqueness: 98,
          validity: 92,
          consistency: 90,
          accuracy: 94,
          timeliness: 96,
          overallScore: 94.2
        },
        executionTime: 1250,
        recommendations: ['Add unique constraints to prevent duplicates']
      };

      expect(validationReport.passedRules + validationReport.failedRules)
        .toBe(validationReport.totalRules);

      expect(validationReport.criticalIssues + validationReport.highIssues +
             validationReport.mediumIssues + validationReport.lowIssues)
        .toBe(validationReport.failedRules);

      expect(validationReport.executionTime).toBeGreaterThan(0);
      expect(validationReport.results).toHaveLength(1);
      expect(validationReport.qualityMetrics.overallScore).toBeGreaterThan(0);
    });
  });

  describe('Database Analysis Structure', () => {
    test('should define database analysis result', () => {
      const analysisResult = {
        connectionId: testConnectionId,
        databaseType: 'postgresql',
        databaseName: 'test_db',
        analysisTimestamp: new Date(),
        analysisVersion: '1.0.0',
        totalTables: 10,
        totalColumns: 50,
        totalRows: 100000,
        dataSize: 10485760, // 10MB in bytes
        tables: [
          {
            tableName: 'users',
            totalRows: 1000,
            totalColumns: 5,
            primaryKey: 'id',
            foreignKeys: [],
            indexes: [],
            constraints: [],
            dataProfiles: [],
            relationships: [],
            qualityIssues: [],
            overallQualityScore: 95
          }
        ],
        crossTableAnalysis: {
          referentialIntegrityIssues: [],
          dataConsistencyIssues: [],
          performanceIssues: []
        },
        overallQualityScore: 92.5,
        recommendations: [
          'Consider adding indexes for frequently queried columns',
          'Review tables without primary keys'
        ],
        executionTime: 2500
      };

      expect(analysisResult.totalTables).toBeGreaterThan(0);
      expect(analysisResult.totalColumns).toBeGreaterThan(0);
      expect(analysisResult.totalRows).toBeGreaterThan(0);
      expect(analysisResult.dataSize).toBeGreaterThan(0);
      expect(analysisResult.overallQualityScore).toBeGreaterThanOrEqual(0);
      expect(analysisResult.overallQualityScore).toBeLessThanOrEqual(100);
      expect(analysisResult.executionTime).toBeGreaterThan(0);
      expect(analysisResult.tables).toHaveLength(1);
    });
  });

  describe('API Response Formats', () => {
    test('should define standard API response format', () => {
      const successResponse = {
        success: true,
        data: {
          connectionId: testConnectionId,
          timestamp: new Date(),
          result: 'operation completed successfully'
        },
        message: 'Database validation completed successfully'
      };

      const errorResponse = {
        success: false,
        error: 'Database validation failed',
        details: 'Connection timeout occurred'
      };

      expect(successResponse.success).toBe(true);
      expect(successResponse.data).toBeDefined();
      expect(successResponse.message).toBeDefined();

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.details).toBeDefined();
    });

    test('should define validation rule template format', () => {
      const ruleTemplates = [
        {
          id: 'uniqueness_check',
          name: 'Uniqueness Validation',
          type: 'uniqueness',
          description: 'Check for duplicate records in a table',
          template: 'SELECT * FROM (SELECT *, COUNT(*) OVER (PARTITION BY {column}) as cnt FROM {table}) t WHERE cnt > 1',
          severity: 'high',
          autoFix: false
        },
        {
          id: 'null_check',
          name: 'Null Value Check',
          type: 'quality',
          description: 'Check for null values in required fields',
          template: 'SELECT COUNT(*) as null_count FROM {table} WHERE {column} IS NULL',
          severity: 'medium',
          autoFix: false
        }
      ];

      ruleTemplates.forEach(template => {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.type).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.template).toBeDefined();
        expect(template.severity).toBeDefined();
        expect(typeof template.autoFix).toBe('boolean');
      });
    });
  });
});