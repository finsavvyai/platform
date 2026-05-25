// @ts-nocheck - Skip TypeScript checking for import.meta issues
import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { db } from '../../../../backend/src/lib/db.js';
import { users, databaseConnections } from '../../../../backend/src/schema/index.js';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { connectionPoolManager } from '../../../../backend/src/services/ConnectionPoolManager.js';

// Create a simple Express app instead of importing index.js (which has import.meta issues)
import dataValidationRoutes from '../../../../backend/src/routes/dataValidation.js';

// Mock auth middleware
jest.mock('../../../../backend/src/middleware/auth.js', () => ({
  authenticateToken: jest.fn((req: any, res: any, next: any) => {
    req.user = {
      id: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000001',
      email: 'test@example.com',
      role: 'admin'
    };
    next();
  }),
  requireRole: jest.fn(() => (req: any, res: any, next: any) => next())
}));

// Mock usage tracking
jest.mock('../../../../backend/src/middleware/usageTrackingMiddleware.js', () => ({
  trackUsageMiddleware: jest.fn(() => (req: any, res: any, next: any) => next())
}));

// Mock the services
jest.mock('../../../../backend/src/services/DataValidationEngine.js', () => ({
  dataValidationEngine: {
    validateDatabase: jest.fn(),
    validateDataConsistency: jest.fn(),
    autoFixIssues: jest.fn(),
    closeAllConnections: jest.fn()
  }
}));

jest.mock('../../../../backend/src/services/DataQualityAnalyzer.js', () => ({
  dataQualityAnalyzer: {
    analyzeDatabase: jest.fn(),
    analyzeTable: jest.fn(),
    generateDataLineage: jest.fn()
  }
}));

jest.mock('../../../../backend/src/services/ConnectionPoolManager.js', () => ({
  connectionPoolManager: {
    getConnection: jest.fn(),
    releaseConnection: jest.fn(),
    getMetrics: jest.fn(),
    getAllMetrics: jest.fn(),
    checkHealth: jest.fn(),
    closeAllPools: jest.fn().mockResolvedValue(undefined),
    configs: new Map()
  }
}));

// Mock the logger
jest.mock('../../../../backend/src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('/api/data-validation', () => {
  let app: express.Application;
  let authToken: string;
  let testUserId: string;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/data-validation', dataValidationRoutes);
  });
  let testConnectionId: string;

  beforeAll(async () => {
    // Create test user with unique email to avoid conflicts across runs
    const uniqueEmail = `datavalidation-${Date.now()}@test.com`;
    const user = await db.insert(users).values({
      email: uniqueEmail,
      password: 'hashedpassword',
      firstName: 'Data',
      lastName: 'Validator',
      role: 'user'
    }).returning({ id: users.id });

    testUserId = user[0].id;

    // Create test database connection
    const connection = await db.insert(databaseConnections).values({
      userId: testUserId,
      name: 'Test Validation Connection',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      username: 'test_user',
      password: 'test_password',
      ssl: false,
      status: 'connected'
    }).returning({ id: databaseConnections.id });

    testConnectionId = connection[0].id;

    // Generate JWT token
    authToken = jwt.sign(
      { userId: testUserId, email: 'datavalidation@test.com' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    try {
      // Clean up test data
      if (testConnectionId) {
        await db.delete(databaseConnections).where(eq(databaseConnections.id, testConnectionId));
      }
      if (testUserId) {
        await db.delete(users).where(eq(users.id, testUserId));
      }
      // Skip closeDatabaseConnection in tests - process exit cleans up; avoids postgres end() hang
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }, 10000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /validate-database', () => {
    test('should validate database with default rules', async () => {
      const { dataValidationEngine } = require('../../../../backend/src/services/DataValidationEngine.js');

      const mockReport = {
        connectionId: testConnectionId,
        timestamp: new Date(),
        totalRules: 2,
        passedRules: 2,
        failedRules: 0,
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0,
        results: [
          {
            ruleId: 'uniqueness_check',
            ruleName: 'Uniqueness Validation',
            passed: true,
            actualResult: [],
            expectedResult: 0,
            severity: 'high',
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
        recommendations: []
      };

      dataValidationEngine.validateDatabase.mockResolvedValue(mockReport);

      const response = await request(app)
        .post('/api/data-validation/validate-database')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ connectionId: testConnectionId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        connectionId: testConnectionId,
        totalRules: expect.any(Number),
        passedRules: expect.any(Number),
        failedRules: expect.any(Number),
        timestamp: expect.any(String),
        results: expect.any(Array)
      });
      expect(dataValidationEngine.validateDatabase).toHaveBeenCalledWith(testConnectionId, undefined);
    });

    test('should validate database with custom rules', async () => {
      const { dataValidationEngine } = require('../../../../backend/src/services/DataValidationEngine.js');

      const customRules = [
        {
          id: 'custom_rule_1',
          name: 'Custom Validation',
          type: 'quality',
          query: 'SELECT COUNT(*) FROM users WHERE email IS NULL',
          expectedResult: 0,
          severity: 'medium',
          description: 'Check for null emails',
          autoFix: false
        }
      ];

      const mockReport = {
        connectionId: testConnectionId,
        timestamp: new Date(),
        totalRules: 1,
        passedRules: 1,
        failedRules: 0,
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0,
        results: [
          {
            ruleId: 'custom_rule_1',
            ruleName: 'Custom Validation',
            passed: true,
            actualResult: [{ count: 0 }],
            expectedResult: 0,
            severity: 'medium',
            description: 'Check for null emails',
            autoFixAvailable: false,
            executionTime: 100
          }
        ],
        qualityMetrics: {
          completeness: 100,
          uniqueness: 100,
          validity: 100,
          consistency: 100,
          accuracy: 100,
          timeliness: 100,
          overallScore: 100
        },
        executionTime: 500,
        recommendations: []
      };

      dataValidationEngine.validateDatabase.mockResolvedValue(mockReport);

      const response = await request(app)
        .post('/api/data-validation/validate-database')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          customRules
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(dataValidationEngine.validateDatabase).toHaveBeenCalledWith(testConnectionId, customRules);
    });

    test('should return 400 for invalid connection ID', async () => {
      const response = await request(app)
        .post('/api/data-validation/validate-database')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ connectionId: 'invalid-uuid' })
        .expect(400);

      // Validation middleware returns error without success field
      expect(response.body.error).toBeDefined();
    });

    test('should return 401 without authentication', async () => {
      // Temporarily mock auth to reject
      const { authenticateToken } = require('../../../../backend/src/middleware/auth.js');
      authenticateToken.mockImplementationOnce((req: any, res: any, next: any) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      await request(app)
        .post('/api/data-validation/validate-database')
        .send({ connectionId: testConnectionId })
        .expect(401);
    });

    test('should handle validation engine errors', async () => {
      const { dataValidationEngine } = require('../../../../backend/src/services/DataValidationEngine.js');

      dataValidationEngine.validateDatabase.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/data-validation/validate-database')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ connectionId: testConnectionId })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database validation failed');
    });
  });

  describe('POST /validate-consistency', () => {
    test('should validate data consistency between tables', async () => {
      const { dataValidationEngine } = require('../../../../backend/src/services/DataValidationEngine.js');

      const mockResults = [
        {
          ruleId: 'consistency_users_orders',
          ruleName: 'Consistency between users and orders',
          passed: true,
          actualResult: [],
          expectedResult: 0,
          severity: 'medium',
          description: 'Check for orphaned references between users and orders',
          autoFixAvailable: false,
          executionTime: 200
        }
      ];

      dataValidationEngine.validateDataConsistency.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/api/data-validation/validate-consistency')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          tables: ['users', 'orders']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toEqual(mockResults);
      expect(response.body.data.summary.totalRules).toBe(1);
      expect(response.body.data.summary.passedRules).toBe(1);
      expect(response.body.data.summary.failedRules).toBe(0);
    });

    test('should return 400 for insufficient tables', async () => {
      const response = await request(app)
        .post('/api/data-validation/validate-consistency')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          tables: ['users'] // Need at least 2 tables
        })
        .expect(400);

      // Validation middleware returns error without success field
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /auto-fix', () => {
    test('should auto-fix validation issues', async () => {
      const { dataValidationEngine } = require('../../../../backend/src/services/DataValidationEngine.js');

      const mockResult = {
        fixed: ['fixable_rule_1'],
        failed: [],
        errors: {}
      };

      dataValidationEngine.autoFixIssues.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/data-validation/auto-fix')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          ruleIds: ['fixable_rule_1']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fixed).toEqual(['fixable_rule_1']);
      expect(response.body.data.summary.successRate).toBe('100.00%');
    });

    test('should handle partial fix failures', async () => {
      const { dataValidationEngine } = require('../../../../backend/src/services/DataValidationEngine.js');

      const mockResult = {
        fixed: ['fixable_rule_1'],
        failed: ['unfixable_rule_1'],
        errors: {
          'unfixable_rule_1': 'Cannot auto-fix this rule'
        }
      };

      dataValidationEngine.autoFixIssues.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/data-validation/auto-fix')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          ruleIds: ['fixable_rule_1', 'unfixable_rule_1']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fixed).toEqual(['fixable_rule_1']);
      expect(response.body.data.failed).toEqual(['unfixable_rule_1']);
      expect(response.body.data.summary.successRate).toBe('50.00%');
    });
  });

  describe('POST /analyze-database', () => {
    test('should analyze database quality', async () => {
      const { dataQualityAnalyzer } = require('../../../../backend/src/services/DataQualityAnalyzer.js');

      const mockAnalysis = {
        connectionId: testConnectionId,
        databaseType: 'postgresql',
        databaseName: 'test_db',
        analysisTimestamp: new Date(),
        analysisVersion: '1.0.0',
        totalTables: 5,
        totalColumns: 25,
        totalRows: 10000,
        dataSize: 1048576,
        tables: [
          {
            tableName: 'users',
            totalRows: 1000,
            totalColumns: 5,
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
        recommendations: [],
        executionTime: 2500
      };

      dataQualityAnalyzer.analyzeDatabase.mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .post('/api/data-validation/analyze-database')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          options: {
            includeProfiling: true,
            sampleSize: 5000
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        connectionId: testConnectionId,
        databaseType: expect.any(String),
        analysisTimestamp: expect.any(String),
        overallQualityScore: expect.any(Number)
      });
    });
  });

  describe('POST /analyze-table', () => {
    test('should analyze specific table', async () => {
      const { dataQualityAnalyzer } = require('../../../../backend/src/services/DataQualityAnalyzer.js');
      const { connectionPoolManager } = require('../../../../backend/src/services/ConnectionPoolManager.js');

      const mockConnection = { query: jest.fn() };
      const mockConfig = { type: 'postgresql' };

      connectionPoolManager.getConnection.mockResolvedValue(mockConnection);
      connectionPoolManager.configs = new Map([[testConnectionId, mockConfig]]);
      connectionPoolManager.releaseConnection.mockResolvedValue();

      const mockTableAnalysis = {
        tableName: 'users',
        totalRows: 1000,
        totalColumns: 5,
        primaryKey: 'id',
        foreignKeys: [],
        indexes: [],
        constraints: [],
        dataProfiles: [
          {
            tableName: 'users',
            columnName: 'email',
            dataType: 'varchar',
            totalRows: 1000,
            nullCount: 0,
            uniqueCount: 1000,
            duplicateCount: 0,
            nullPercentage: 0,
            uniquenessPercentage: 100,
            dataQualityScore: 100,
            anomalies: [],
            recommendations: [],
            commonValues: []
          }
        ],
        relationships: [],
        qualityIssues: [],
        overallQualityScore: 98
      };

      dataQualityAnalyzer.analyzeTable.mockResolvedValue(mockTableAnalysis);

      const response = await request(app)
        .post('/api/data-validation/analyze-table')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          tableName: 'users',
          sampleSize: 5000,
          includeProfiling: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTableAnalysis);
    });
  });

  describe('POST /data-lineage', () => {
    test('should generate data lineage', async () => {
      const { dataQualityAnalyzer } = require('../../../../backend/src/services/DataQualityAnalyzer.js');

      const mockLineage = {
        nodes: [
          {
            id: 'users',
            type: 'table',
            name: 'users',
            schema: 'test_db'
          },
          {
            id: 'users.id',
            type: 'column',
            name: 'id',
            schema: 'users',
            dataType: 'uuid'
          }
        ],
        edges: [
          {
            from: 'orders.user_id',
            to: 'users.id',
            type: 'references',
            strength: 1.0,
            description: 'Foreign key reference'
          }
        ],
        impactAnalysis: {
          upstreamTables: [],
          downstreamTables: ['orders'],
          affectedColumns: ['orders.user_id'],
          riskLevel: 'medium'
        }
      };

      dataQualityAnalyzer.generateDataLineage.mockResolvedValue(mockLineage);

      const response = await request(app)
        .post('/api/data-validation/data-lineage')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          tableName: 'users',
          depth: 3
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockLineage);
    });
  });

  describe('GET /pool-metrics/:connectionId', () => {
    test('should get connection pool metrics', async () => {
      const { connectionPoolManager } = require('../../../../backend/src/services/ConnectionPoolManager.js');

      const mockMetrics = {
        totalConnections: 20,
        activeConnections: 5,
        idleConnections: 15,
        waitingCount: 0,
        acquiredCount: 100,
        createdCount: 20,
        destroyedCount: 0,
        timeouts: 0,
        errors: 0
      };

      connectionPoolManager.getMetrics.mockReturnValue(mockMetrics);

      const response = await request(app)
        .get(`/api/data-validation/pool-metrics/${testConnectionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics).toEqual(mockMetrics);
      expect(response.body.data.connectionId).toBe(testConnectionId);
    });

    test('should return 404 for non-existent connection', async () => {
      const { connectionPoolManager } = require('../../../../backend/src/services/ConnectionPoolManager.js');

      connectionPoolManager.getMetrics.mockReturnValue(null);

      const response = await request(app)
        .get('/api/data-validation/pool-metrics/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Connection pool metrics not found');
    });
  });

  describe('GET /pool-metrics', () => {
    test('should get all connection pool metrics', async () => {
      const { connectionPoolManager } = require('../../../../backend/src/services/ConnectionPoolManager.js');

      const mockAllMetrics = {
        [testConnectionId]: {
          totalConnections: 20,
          activeConnections: 5,
          idleConnections: 15,
          waitingCount: 0,
          acquiredCount: 100,
          createdCount: 20,
          destroyedCount: 0,
          timeouts: 0,
          errors: 0
        }
      };

      connectionPoolManager.getAllMetrics.mockReturnValue(mockAllMetrics);

      const response = await request(app)
        .get('/api/data-validation/pool-metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.connections).toBe(1);
      expect(response.body.data.metrics).toEqual(mockAllMetrics);
    });
  });

  describe('POST /health-check', () => {
    test('should perform health check on connection', async () => {
      const { connectionPoolManager } = require('../../../../backend/src/services/ConnectionPoolManager.js');

      const mockHealthResult = {
        connectionId: testConnectionId,
        healthy: true,
        responseTime: 50,
        timestamp: new Date()
      };

      connectionPoolManager.checkHealth.mockResolvedValue(mockHealthResult);

      const response = await request(app)
        .post('/api/data-validation/health-check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ connectionId: testConnectionId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        connectionId: testConnectionId,
        healthy: true,
        responseTime: expect.any(Number),
        timestamp: expect.any(String)
      });
    });

    test('should return 503 for unhealthy connection', async () => {
      const { connectionPoolManager } = require('../../../../backend/src/services/ConnectionPoolManager.js');

      const mockHealthResult = {
        connectionId: testConnectionId,
        healthy: false,
        responseTime: 0,
        error: 'Connection failed',
        timestamp: new Date()
      };

      connectionPoolManager.checkHealth.mockResolvedValue(mockHealthResult);

      const response = await request(app)
        .post('/api/data-validation/health-check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ connectionId: testConnectionId })
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.data).toMatchObject({
        connectionId: testConnectionId,
        healthy: false,
        responseTime: expect.any(Number),
        timestamp: expect.any(String)
      });
    });
  });

  describe('GET /validation-rules', () => {
    test('should get validation rule templates', async () => {
      const response = await request(app)
        .get('/api/data-validation/validation-rules')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.templates).toBeDefined();
      expect(response.body.data.count).toBeGreaterThan(0);
      expect(Array.isArray(response.body.data.templates)).toBe(true);

      // Check template structure
      const template = response.body.data.templates[0];
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('type');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('template');
      expect(template).toHaveProperty('severity');
    });
  });
});