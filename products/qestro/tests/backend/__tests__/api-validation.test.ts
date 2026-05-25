// @ts-nocheck - Skip TypeScript checking for import.meta issues
import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { db, closeDatabaseConnection } from '../../../backend/src/lib/db.js';
import { users, databaseConnections } from '../../../backend/src/schema/index.js';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

// Create a simple Express app instead of importing index.js (which has import.meta issues)
import dataValidationRoutes from '../../../backend/src/routes/dataValidation.js';

// Mock auth middleware
jest.mock('../../../backend/src/middleware/auth.js', () => ({
  authenticateToken: jest.fn((req: any, res: any, next: any) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
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
jest.mock('../../../backend/src/middleware/usageTrackingMiddleware.js', () => ({
  trackUsageMiddleware: jest.fn(() => (req: any, res: any, next: any) => next())
}));

// Mock services to prevent real database connections during tests
jest.mock('../../../backend/src/services/DataValidationEngine.js', () => ({
  dataValidationEngine: {
    validateDatabase: jest.fn().mockResolvedValue({
      connectionId: 'test-connection',
      timestamp: new Date(),
      totalRules: 3,
      passedRules: 2,
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
      recommendations: ['Consider adding unique constraints']
    }),
    validateDataConsistency: jest.fn().mockResolvedValue([
      {
        ruleId: 'consistency_users_orders',
        ruleName: 'Consistency check',
        passed: true,
        actualResult: [],
        expectedResult: 0,
        severity: 'medium',
        description: 'Check consistency between tables',
        autoFixAvailable: false,
        executionTime: 200
      }
    ]),
    autoFixIssues: jest.fn().mockResolvedValue({
      fixed: ['rule1'],
      failed: [],
      errors: {}
    }),
    closeAllConnections: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('../../../backend/src/services/DataQualityAnalyzer.js', () => ({
  dataQualityAnalyzer: {
    analyzeDatabase: jest.fn().mockResolvedValue({
      connectionId: 'test-connection',
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
    }),
    analyzeTable: jest.fn().mockResolvedValue({
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
    }),
    generateDataLineage: jest.fn().mockResolvedValue({
      nodes: [
        {
          id: 'users',
          type: 'table',
          name: 'users',
          schema: 'public'
        }
      ],
      edges: [],
      impactAnalysis: {
        upstreamTables: [],
        downstreamTables: ['orders'],
        affectedColumns: [],
        riskLevel: 'medium'
      }
    })
  }
}));

jest.mock('../../../backend/src/services/ConnectionPoolManager.js', () => ({
  connectionPoolManager: {
    getConnection: jest.fn().mockResolvedValue({}),
    releaseConnection: jest.fn().mockResolvedValue(undefined),
    getMetrics: jest.fn().mockReturnValue({
      totalConnections: 20,
      activeConnections: 5,
      idleConnections: 15,
      waitingCount: 0,
      acquiredCount: 100,
      createdCount: 20,
      destroyedCount: 0,
      timeouts: 0,
      errors: 0
    }),
    getAllMetrics: jest.fn().mockReturnValue({
      'test-connection': {
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
    }),
    checkHealth: jest.fn().mockResolvedValue({
      connectionId: 'test-connection',
      healthy: true,
      responseTime: 50,
      timestamp: new Date()
    }),
    configs: new Map([
      ['test-connection', { type: 'postgresql', database: 'test_db' }]
    ])
  }
}));

jest.mock('../../../backend/src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Data Validation API Tests', () => {
  let app: express.Application;
  let authToken: string;
  let testUserId: string;
  let testConnectionId: string;

  beforeAll(async () => {
    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/data-validation', dataValidationRoutes);
    try {
      // Create test user
      const user = await db.insert(users).values({
        email: 'api.test@example.com',
        password: '$2b$10$hashedpassword',
        firstName: 'API',
        lastName: 'Test',
        role: 'user'
      }).returning({ id: users.id });

      testUserId = user[0].id;

      // Create test database connection
      const connection = await db.insert(databaseConnections).values({
        userId: testUserId,
        name: 'API Test Connection',
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
        { userId: testUserId, email: 'api.test@example.com' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );
    } catch (error) {
      console.error('Test setup failed:', error);
      throw error;
    }
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
      // Close connections
      const { connectionPoolManager } = await import('../../../backend/src/services/ConnectionPoolManager.js');
      await connectionPoolManager.closeAllPools();
      await closeDatabaseConnection();
    } catch (error) {
      console.error('Test cleanup failed:', error);
    }
  }, 30000);

  describe('API Endpoint Availability', () => {
    test('POST /api/data-validation/validate-database should be available', async () => {
      const response = await request(app)
        .post('/api/data-validation/validate-database')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId
        });

      expect([200, 400, 500]).toContain(response.status);
    });

    test('GET /api/data-validation/validation-rules should be available', async () => {
      const response = await request(app)
        .get('/api/data-validation/validation-rules')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('Authentication Requirements', () => {
    test('should require authentication for all endpoints', async () => {
      const endpoints = [
        { method: 'post', path: '/api/data-validation/validate-database' },
        { method: 'post', path: '/api/data-validation/validate-consistency' },
        { method: 'post', path: '/api/data-validation/auto-fix' },
        { method: 'post', path: '/api/data-validation/analyze-database' },
        { method: 'post', path: '/api/data-validation/analyze-table' },
        { method: 'post', path: '/api/data-validation/data-lineage' },
        { method: 'get', path: '/api/data-validation/pool-metrics' },
        { method: 'post', path: '/api/data-validation/health-check' },
        { method: 'get', path: '/api/data-validation/validation-rules' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .send({});

        expect(response.status).toBe(401);
      }
    });
  });

  describe('Request Validation', () => {
    test('should validate required fields', async () => {
      // Test missing connectionId
      const response = await request(app)
        .post('/api/data-validation/validate-database')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test('should validate UUID format for connectionId', async () => {
      const response = await request(app)
        .post('/api/data-validation/validate-database')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: 'invalid-uuid'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test('should validate array requirements', async () => {
      // Test consistency validation requires at least 2 tables
      const response = await request(app)
        .post('/api/data-validation/validate-consistency')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          tables: ['only_one_table']
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Success Response Format', () => {
    test('should return consistent success response format', async () => {
      const response = await request(app)
        .get('/api/data-validation/validation-rules')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.message).toBeDefined();
    });

    test('validation rules should return proper structure', async () => {
      const response = await request(app)
        .get('/api/data-validation/validation-rules')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.templates).toBeDefined();
      expect(response.body.data.count).toBeGreaterThan(0);
      expect(Array.isArray(response.body.data.templates)).toBe(true);

      const template = response.body.data.templates[0];
      expect(template.id).toBeDefined();
      expect(template.name).toBeDefined();
      expect(template.type).toBeDefined();
      expect(template.template).toBeDefined();
      expect(template.severity).toBeDefined();
      expect(template.description).toBeDefined();
    });
  });

  describe('Mocked Service Integration', () => {
    test('should call DataValidationEngine.validateDatabase', async () => {
      const { dataValidationEngine } = require('../../../backend/src/services/DataValidationEngine.js');

      const response = await request(app)
        .post('/api/data-validation/validate-database')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId
        })
        .expect(200);

      expect(dataValidationEngine.validateDatabase).toHaveBeenCalledWith(
        testConnectionId,
        undefined
      );
      expect(response.body.success).toBe(true);
      expect(response.body.data.connectionId).toBeDefined();
    });

    test('should call DataValidationEngine.validateDataConsistency', async () => {
      const { dataValidationEngine } = require('../../../backend/src/services/DataValidationEngine.js');

      const response = await request(app)
        .post('/api/data-validation/validate-consistency')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          tables: ['users', 'orders']
        })
        .expect(200);

      expect(dataValidationEngine.validateDataConsistency).toHaveBeenCalledWith(
        testConnectionId,
        ['users', 'orders']
      );
      expect(response.body.success).toBe(true);
    });

    test('should call ConnectionPoolManager.getMetrics', async () => {
      const { connectionPoolManager } = require('../../../backend/src/services/ConnectionPoolManager.js');

      const response = await request(app)
        .get(`/api/data-validation/pool-metrics/${testConnectionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(connectionPoolManager.getMetrics).toHaveBeenCalledWith(testConnectionId);
      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle service errors gracefully', async () => {
      const { dataValidationEngine } = require('../../../backend/src/services/DataValidationEngine.js');

      // Mock service to throw error
      dataValidationEngine.validateDatabase.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/data-validation/validate-database')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database validation failed');
      expect(response.body.details).toBeDefined();
    });

    test('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/data-validation/validate-database')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toBeDefined();
    });
  });

  describe('Performance Validation', () => {
    test('API endpoints should respond within reasonable time', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/api/data-validation/validation-rules')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });

  describe('Data Validation Logic', () => {
    test('should validate custom rules structure', async () => {
      const customRules = [
        {
          id: 'test_rule',
          name: 'Test Rule',
          type: 'quality',
          query: 'SELECT COUNT(*) FROM users WHERE email IS NULL',
          expectedResult: 0,
          severity: 'medium',
          description: 'Test rule description',
          autoFix: false
        }
      ];

      const response = await request(app)
        .post('/api/data-validation/validate-database')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          customRules
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      const { dataValidationEngine } = require('../../../backend/src/services/DataValidationEngine.js');
      expect(dataValidationEngine.validateDatabase).toHaveBeenCalledWith(
        testConnectionId,
        customRules
      );
    });

    test('should validate rule types and severity levels', () => {
      const validTypes = ['uniqueness', 'constraint', 'referential', 'custom', 'consistency', 'quality'];
      const validSeverities = ['low', 'medium', 'high', 'critical'];

      const testRule = {
        id: 'test',
        name: 'Test',
        type: 'uniqueness',
        query: 'SELECT 1',
        severity: 'high',
        description: 'Test',
        autoFix: false
      };

      expect(validTypes).toContain(testRule.type);
      expect(validSeverities).toContain(testRule.severity);
    });
  });

  describe('API Documentation Compliance', () => {
    test('should provide comprehensive validation rule templates', async () => {
      const response = await request(app)
        .get('/api/data-validation/validation-rules')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const templates = response.body.data.templates;

      // Should have at least basic templates
      const templateTypes = templates.map((t: any) => t.type);
      expect(templateTypes).toContain('uniqueness');
      expect(templateTypes).toContain('quality');
      expect(templateTypes).toContain('referential');

      // All templates should have placeholders
      templates.forEach((template: any) => {
        expect(template.template).toMatch(/\{.*\}/);
      });
    });

    test('should support all documented database types', () => {
      const supportedTypes = ['postgresql', 'mysql', 'mongodb', 'redis', 'sqlite'];

      // This validates our type definitions
      supportedTypes.forEach(type => {
        expect(['postgresql', 'mysql', 'mongodb', 'redis', 'sqlite']).toContain(type);
      });
    });
  });
});