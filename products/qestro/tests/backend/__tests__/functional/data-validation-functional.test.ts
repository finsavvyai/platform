// @ts-nocheck - Skip TypeScript checking for import.meta issues
import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { db } from '../../../../backend/src/lib/db.js';
import { users, databaseConnections } from '../../../../backend/src/schema/index.js';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

// Create a simple Express app instead of importing index.js (which has import.meta issues)
import dataValidationRoutes from '../../../../backend/src/routes/dataValidation.js';

// Mock auth middleware
jest.mock('../../../../backend/src/middleware/auth.js', () => ({
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
jest.mock('../../../../backend/src/middleware/usageTrackingMiddleware.js', () => ({
  trackUsageMiddleware: jest.fn(() => (req: any, res: any, next: any) => next())
}));

// Mock external services but allow internal logic to run
jest.mock('../../../../backend/src/services/ConnectionPoolManager.js', () => {
  const mockPoolManager = {
    createPool: jest.fn().mockResolvedValue(undefined),
    getConnection: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      execute: jest.fn().mockResolvedValue([[], {}]),
      end: jest.fn().mockResolvedValue(undefined)
    }),
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
    closeAllPools: jest.fn().mockResolvedValue(undefined),
    configs: new Map([
      ['test-connection', { type: 'postgresql', database: 'test_db' }]
    ])
  };

  return {
    connectionPoolManager: mockPoolManager,
    ConnectionPoolManager: jest.fn().mockImplementation(() => mockPoolManager)
  };
});

// Mock the logger
jest.mock('../../../../backend/src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Data Validation Functional Tests', () => {
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
      const uniqueEmail = `datavalidation-functional-${Date.now()}@test.com`;
      const user = await db.insert(users).values({
        email: uniqueEmail,
        password: '$2b$10$hashedpassword',
        firstName: 'Data',
        lastName: 'Validator',
        role: 'user'
      }).returning({ id: users.id });

      testUserId = user[0].id;

      // Create test database connection
      const connection = await db.insert(databaseConnections).values({
        userId: testUserId,
        name: 'Functional Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'test_user',
        password: 'test_password',
        ssl: false,
        status: 'connected',
        maxConnections: 20,
        connectionTimeout: 30000
      }).returning({ id: databaseConnections.id });

      testConnectionId = connection[0].id;

      // Generate JWT token
      authToken = jwt.sign(
        { userId: testUserId, email: uniqueEmail },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );
    } catch (error) {
      console.error('Setup failed:', error);
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
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }, 30000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Database Validation API', () => {
    test('POST /api/data-validation/validate-database - should validate database successfully', async () => {
      const response = await request(app)
        .post('/api/data-validation/validate-database')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.connectionId).toBe(testConnectionId);
      expect(response.body.data.totalRules).toBeGreaterThan(0);
      expect(response.body.data.results).toBeDefined();
      expect(response.body.data.qualityMetrics).toBeDefined();
      expect(response.body.data.executionTime).toBeGreaterThan(0);
      expect(response.body.message).toContain('completed successfully');
    });

    test('POST /api/data-validation/validate-database - should validate with custom rules', async () => {
      const customRules = [
        {
          id: 'custom_test_rule',
          name: 'Custom Test Rule',
          type: 'quality',
          query: 'SELECT COUNT(*) as count FROM users WHERE email IS NULL',
          expectedResult: 0,
          severity: 'medium',
          description: 'Check for null email addresses',
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
      expect(response.body.data.totalRules).toBeGreaterThan(0);
      expect(response.body.data.results).toHaveLength(response.body.data.totalRules);
    });

    test('POST /api/data-validation/validate-database - should handle invalid connection ID', async () => {
      const response = await request(app)
        .post('/api/data-validation/validate-database')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: 'invalid-uuid-format'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    test('POST /api/data-validation/validate-database - should require authentication', async () => {
      await request(app)
        .post('/api/data-validation/validate-database')
        .send({
          connectionId: testConnectionId
        })
        .expect(401);
    });
  });

  describe('Data Consistency Validation API', () => {
    test('POST /api/data-validation/validate-consistency - should validate consistency', async () => {
      const response = await request(app)
        .post('/api/data-validation/validate-consistency')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          tables: ['users', 'orders']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toBeDefined();
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.summary.totalRules).toBeGreaterThanOrEqual(0);
      expect(response.body.data.summary.passedRules).toBeGreaterThanOrEqual(0);
      expect(response.body.data.summary.failedRules).toBeGreaterThanOrEqual(0);
    });

    test('POST /api/data-validation/validate-consistency - should require at least 2 tables', async () => {
      const response = await request(app)
        .post('/api/data-validation/validate-consistency')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          tables: ['users'] // Only one table
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Auto-Fix API', () => {
    test('POST /api/data-validation/auto-fix - should attempt auto-fix', async () => {
      const response = await request(app)
        .post('/api/data-validation/auto-fix')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          ruleIds: ['test_rule_1', 'test_rule_2']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fixed).toBeDefined();
      expect(response.body.data.failed).toBeDefined();
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.summary.totalRules).toBe(2);
      expect(response.body.data.summary.successRate).toBeDefined();
    });

    test('POST /api/data-validation/auto-fix - should require at least one rule ID', async () => {
      const response = await request(app)
        .post('/api/data-validation/auto-fix')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          ruleIds: [] // Empty array
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Database Analysis API', () => {
    test('POST /api/data-validation/analyze-database - should analyze database', async () => {
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
      expect(response.body.data.connectionId).toBe(testConnectionId);
      expect(response.body.data.databaseType).toBeDefined();
      expect(response.body.data.analysisTimestamp).toBeDefined();
      expect(response.body.data.overallQualityScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.executionTime).toBeGreaterThan(0);
    });

    test('POST /api/data-validation/analyze-database - should work with minimal options', async () => {
      const response = await request(app)
        .post('/api/data-validation/analyze-database')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Table Analysis API', () => {
    test('POST /api/data-validation/analyze-table - should analyze specific table', async () => {
      const response = await request(app)
        .post('/api/data-validation/analyze-table')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          tableName: 'users',
          sampleSize: 1000,
          includeProfiling: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tableName).toBe('users');
      expect(response.body.data.totalRows).toBeGreaterThanOrEqual(0);
      expect(response.body.data.totalColumns).toBeGreaterThanOrEqual(0);
      expect(response.body.data.overallQualityScore).toBeGreaterThanOrEqual(0);
    });

    test('POST /api/data-validation/analyze-table - should require table name', async () => {
      const response = await request(app)
        .post('/api/data-validation/analyze-table')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId
          // Missing tableName
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Data Lineage API', () => {
    test('POST /api/data-validation/data-lineage - should generate data lineage', async () => {
      const response = await request(app)
        .post('/api/data-validation/data-lineage')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          tableName: 'users',
          depth: 2
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.nodes).toBeDefined();
      expect(response.body.data.edges).toBeDefined();
      expect(response.body.data.impactAnalysis).toBeDefined();
      expect(Array.isArray(response.body.data.nodes)).toBe(true);
      expect(Array.isArray(response.body.data.edges)).toBe(true);
    });

    test('POST /api/data-validation/data-lineage - should validate depth parameter', async () => {
      const response = await request(app)
        .post('/api/data-validation/data-lineage')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId,
          tableName: 'users',
          depth: 10 // Too deep
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Pool Metrics API', () => {
    test('GET /api/data-validation/pool-metrics/:connectionId - should get connection metrics', async () => {
      const response = await request(app)
        .get(`/api/data-validation/pool-metrics/${testConnectionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.connectionId).toBe(testConnectionId);
      expect(response.body.data.metrics).toBeDefined();
      expect(response.body.data.metrics.totalConnections).toBeGreaterThan(0);
      expect(response.body.data.timestamp).toBeDefined();
    });

    test('GET /api/data-validation/pool-metrics - should get all metrics', async () => {
      const response = await request(app)
        .get('/api/data-validation/pool-metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.connections).toBeGreaterThanOrEqual(0);
      expect(response.body.data.metrics).toBeDefined();
      expect(response.body.data.timestamp).toBeDefined();
    });

    test('GET /api/data-validation/pool-metrics/:connectionId - should handle non-existent connection', async () => {
      // Mock getMetrics to return null for this test
      const { connectionPoolManager } = require('../../../../backend/src/services/ConnectionPoolManager.js');
      connectionPoolManager.getMetrics.mockReturnValueOnce(null);

      const response = await request(app)
        .get('/api/data-validation/pool-metrics/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Connection pool metrics not found');
    });
  });

  describe('Health Check API', () => {
    test('POST /api/data-validation/health-check - should check connection health', async () => {
      const response = await request(app)
        .post('/api/data-validation/health-check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.connectionId).toBe(testConnectionId);
      expect(response.body.data.healthy).toBe(true);
      expect(response.body.data.responseTime).toBeGreaterThan(0);
      expect(response.body.data.timestamp).toBeDefined();
    });

    test('POST /api/data-validation/health-check - should handle unhealthy connection', async () => {
      // Mock checkHealth to return unhealthy result
      const { connectionPoolManager } = require('../../../../backend/src/services/ConnectionPoolManager.js');
      connectionPoolManager.checkHealth.mockResolvedValueOnce({
        connectionId: testConnectionId,
        healthy: false,
        responseTime: 0,
        error: 'Connection timeout',
        timestamp: new Date()
      });

      const response = await request(app)
        .post('/api/data-validation/health-check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId
        })
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.data.healthy).toBe(false);
      expect(response.body.data.error).toBeDefined();
    });
  });

  describe('Validation Rules API', () => {
    test('GET /api/data-validation/validation-rules - should get rule templates', async () => {
      const response = await request(app)
        .get('/api/data-validation/validation-rules')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.templates).toBeDefined();
      expect(response.body.data.count).toBeGreaterThan(0);
      expect(Array.isArray(response.body.data.templates)).toBe(true);

      // Validate template structure
      const template = response.body.data.templates[0];
      expect(template.id).toBeDefined();
      expect(template.name).toBeDefined();
      expect(template.type).toBeDefined();
      expect(template.template).toBeDefined();
      expect(template.severity).toBeDefined();
      expect(template.description).toBeDefined();

      // Check template has placeholders
      expect(template.template).toMatch(/\{.*\}/);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing connection ID gracefully', async () => {
      const response = await request(app)
        .post('/api/data-validation/validate-database')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing connectionId
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    test('should handle invalid JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/data-validation/validate-database')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toBeDefined();
    });

    test('should handle invalid auth token', async () => {
      const response = await request(app)
        .post('/api/data-validation/validate-database')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          connectionId: testConnectionId
        })
        .expect(401);

      expect(response.body).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    test('validation endpoint should respond within reasonable time', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/data-validation/validate-database')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId
        })
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
      expect(response.body.success).toBe(true);
    });

    test('health check should be fast', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/api/data-validation/health-check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          connectionId: testConnectionId
        })
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });

  describe('Data Consistency', () => {
    test('API responses should have consistent structure', async () => {
      const endpoints = [
        { method: 'post', path: '/api/data-validation/validate-database', body: { connectionId: testConnectionId } },
        { method: 'post', path: '/api/data-validation/validate-consistency', body: { connectionId: testConnectionId, tables: ['users', 'orders'] } },
        { method: 'post', path: '/api/data-validation/analyze-database', body: { connectionId: testConnectionId } },
        { method: 'get', path: '/api/data-validation/validation-rules', body: {} }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${authToken}`)
          .send(endpoint.body)
          .expect(200);

        // All successful responses should have this structure
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.message).toBeDefined();
        expect(typeof response.body.success).toBe('boolean');
      }
    });
  });
});