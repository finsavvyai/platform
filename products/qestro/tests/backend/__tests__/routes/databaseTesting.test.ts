/**
 * Database Testing Routes Tests
 *
 * Comprehensive test suite for database testing API endpoints
 * Following Kiro guidelines for Phase 5 testing
 */

// @ts-nocheck - Skip TypeScript checking for test mocks
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import databaseTestingRoutes from '../../../../backend/src/routes/databaseTesting.js';
import { DatabaseType, ValidationType, ValidationOperator } from '../../../../backend/src/services/DatabaseTestingService.js';

// Mock the DatabaseTestingService
jest.mock('../../../../backend/src/services/DatabaseTestingService.js', () => {
  const mockService = {
    getAllConnections: jest.fn(),
    registerConnection: jest.fn(),
    testConnection: jest.fn(),
    getAllTestCases: jest.fn(),
    createTestCase: jest.fn(),
    getTestCase: jest.fn(),
    updateTestCase: jest.fn(),
    deleteTestCase: jest.fn(),
    executeTestCase: jest.fn(),
    getTestResults: jest.fn(),
    getActiveTests: jest.fn()
  };

  return {
    __esModule: true,
    default: jest.fn(() => mockService),
    DatabaseType: {
      POSTGRESQL: 'postgresql',
      MYSQL: 'mysql',
      MONGODB: 'mongodb',
      REDIS: 'redis',
      SQLITE: 'sqlite'
    },
    ValidationType: {
      ROW_COUNT: 'row_count',
      COLUMN_VALUE: 'column_value',
      CONSTRAINT_CHECK: 'constraint_check',
      PERFORMANCE_METRIC: 'performance_metric',
      DATA_INTEGRITY: 'data_integrity'
    },
    ValidationOperator: {
      EQUALS: 'equals',
      NOT_EQUALS: 'not_equals',
      GREATER_THAN: 'greater_than',
      LESS_THAN: 'less_than',
      CONTAINS: 'contains',
      EXISTS: 'exists',
      NOT_EXISTS: 'not_exists'
    }
  };
});

// Mock authentication middleware
jest.mock('../../../../backend/src/middleware/auth.js', () => ({
  authenticateToken: jest.fn((req: any, res: any, next: any) => {
    req.user = { id: 'test-user', email: 'test@example.com' };
    next();
  })
}));

// Mock usage tracking middleware
jest.mock('../../../../backend/src/middleware/usageTrackingMiddleware.js', () => ({
  usageTrackingMiddleware: jest.fn((req: any, res: any, next: any) => next()),
  trackUsageMiddleware: jest.fn(() => (req: any, res: any, next: any) => next())
}));

describe('Database Testing Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/database-testing', databaseTestingRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/database-testing/connections', () => {
    it('should return all database connections', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          name: 'Test PostgreSQL',
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'testdb'
        }
      ];

      // Get the mocked service instance
      const DatabaseTestingService = (await import('../../../../backend/src/services/DatabaseTestingService.js')).default;
      const mockServiceInstance = new DatabaseTestingService();
      (mockServiceInstance.getAllConnections as any).mockReturnValue(mockConnections);

      const response = await request(app)
        .get('/api/database-testing/connections')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.connections).toEqual(mockConnections);
      expect(response.body.data.count).toBe(1);
    });

    it('should handle service errors', async () => {
      const DatabaseTestingService = (await import('../../../../backend/src/services/DatabaseTestingService.js')).default;
      const mockServiceInstance = new DatabaseTestingService();
      (mockServiceInstance.getAllConnections as any).mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app)
        .get('/api/database-testing/connections')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve database connections');
    });
  });

  describe('POST /api/database-testing/connections', () => {
    it('should create a new database connection', async () => {
      const connectionData = {
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        database: 'testdb',
        username: 'testuser',
        password: 'testpass'
      };

      const DatabaseTestingService = (await import('../../../../backend/src/services/DatabaseTestingService.js')).default;
      const mockServiceInstance = new DatabaseTestingService();
      (mockServiceInstance.registerConnection as any).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/database-testing/connections')
        .send(connectionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.connectionId).toBeDefined();
      expect(response.body.data.message).toBe('Database connection registered successfully');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: 'Test Connection'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/database-testing/connections')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required fields');
    });

    it('should validate database type', async () => {
      const invalidData = {
        name: 'Test Connection',
        type: 'invalid-type',
        host: 'localhost',
        database: 'testdb'
      };

      const response = await request(app)
        .post('/api/database-testing/connections')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid database type');
    });
  });

  describe('POST /api/database-testing/connections/:connectionId/test', () => {
    it('should test database connection successfully', async () => {
      const DatabaseTestingService = (await import('../../../../backend/src/services/DatabaseTestingService.js')).default;
      const mockServiceInstance = new DatabaseTestingService();
      (mockServiceInstance.testConnection as any).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/database-testing/connections/conn-1/test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.connected).toBe(true);
      expect(response.body.data.connectionId).toBe('conn-1');
    });

    it('should handle connection test failure', async () => {
      const DatabaseTestingService = (await import('../../../../backend/src/services/DatabaseTestingService.js')).default;
      const mockServiceInstance = new DatabaseTestingService();
      (mockServiceInstance.testConnection as any).mockResolvedValue(false);

      const response = await request(app)
        .post('/api/database-testing/connections/conn-1/test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.connected).toBe(false);
      expect(response.body.data.message).toBe('Connection failed');
    });
  });

  describe('GET /api/database-testing/test-cases', () => {
    it('should return all test cases', async () => {
      const mockTestCases = [
        {
          id: 'test-1',
          name: 'User Data Validation',
          description: 'Validate user table data',
          connectionId: 'conn-1'
        }
      ];

      const DatabaseTestingService = (await import('../../../../backend/src/services/DatabaseTestingService.js')).default;
      const mockServiceInstance = new DatabaseTestingService();
      (mockServiceInstance.getAllTestCases as any).mockReturnValue(mockTestCases);

      const response = await request(app)
        .get('/api/database-testing/test-cases')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.testCases).toEqual(mockTestCases);
      expect(response.body.data.count).toBe(1);
    });
  });

  describe('POST /api/database-testing/test-cases', () => {
    it('should create a new test case', async () => {
      const testCaseData = {
        name: 'Test Case 1',
        connectionId: 'conn-1',
        queries: [
          {
            id: 'query-1',
            sql: 'SELECT COUNT(*) FROM users',
            captureResults: true
          }
        ],
        validations: [
          {
            id: 'validation-1',
            type: 'row_count',
            query: 'SELECT COUNT(*) FROM users',
            operator: 'greater_than',
            expectedValue: 0,
            description: 'Users should exist'
          }
        ]
      };

      const DatabaseTestingService = (await import('../../../../backend/src/services/DatabaseTestingService.js')).default;
      const mockServiceInstance = new DatabaseTestingService();
      (mockServiceInstance.createTestCase as any).mockResolvedValue('test-case-123');

      const response = await request(app)
        .post('/api/database-testing/test-cases')
        .send(testCaseData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.testCaseId).toBe('test-case-123');
    });

    it('should validate required fields for test case', async () => {
      const invalidData = {
        name: 'Test Case'
        // Missing connectionId and queries
      };

      const response = await request(app)
        .post('/api/database-testing/test-cases')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required fields');
    });

    it('should validate validation types', async () => {
      const invalidData = {
        name: 'Test Case',
        connectionId: 'conn-1',
        queries: [{ id: 'q1', sql: 'SELECT 1', captureResults: true }],
        validations: [
          {
            id: 'v1',
            type: 'invalid-type',
            operator: 'equals',
            query: 'SELECT 1',
            description: 'Test'
          }
        ]
      };

      const response = await request(app)
        .post('/api/database-testing/test-cases')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid validation type');
    });
  });

  describe('GET /api/database-testing/test-cases/:testCaseId', () => {
    it('should return a specific test case', async () => {
      const mockTestCase = {
        id: 'test-1',
        name: 'Test Case 1',
        connectionId: 'conn-1'
      };

      const DatabaseTestingService = (await import('../../../../backend/src/services/DatabaseTestingService.js')).default;
      const mockServiceInstance = new DatabaseTestingService();
      (mockServiceInstance.getTestCase as any).mockReturnValue(mockTestCase);

      const response = await request(app)
        .get('/api/database-testing/test-cases/test-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.testCase).toEqual(mockTestCase);
    });

    it('should return 404 for non-existent test case', async () => {
      const DatabaseTestingService = (await import('../../../../backend/src/services/DatabaseTestingService.js')).default;
      const mockServiceInstance = new DatabaseTestingService();
      (mockServiceInstance.getTestCase as any).mockReturnValue(null);

      const response = await request(app)
        .get('/api/database-testing/test-cases/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Test case not found');
    });
  });

  describe('PUT /api/database-testing/test-cases/:testCaseId', () => {
    it('should update a test case', async () => {
      const updateData = {
        name: 'Updated Test Case',
        description: 'Updated description'
      };

      const DatabaseTestingService = (await import('../../../../backend/src/services/DatabaseTestingService.js')).default;
      const mockServiceInstance = new DatabaseTestingService();
      (mockServiceInstance.updateTestCase as any).mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/database-testing/test-cases/test-1')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.testCaseId).toBe('test-1');
    });

    it('should return 404 for non-existent test case', async () => {
      const DatabaseTestingService = (await import('../../../../backend/src/services/DatabaseTestingService.js')).default;
      const mockServiceInstance = new DatabaseTestingService();
      (mockServiceInstance.updateTestCase as any).mockRejectedValue(
        new Error('Test case not found')
      );

      const response = await request(app)
        .put('/api/database-testing/test-cases/non-existent')
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Test case not found');
    });
  });

  describe('DELETE /api/database-testing/test-cases/:testCaseId', () => {
    it('should delete a test case', async () => {
      const DatabaseTestingService = (await import('../../../../backend/src/services/DatabaseTestingService.js')).default;
      const mockServiceInstance = new DatabaseTestingService();
      (mockServiceInstance.deleteTestCase as any).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/database-testing/test-cases/test-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.testCaseId).toBe('test-1');
    });
  });

  describe('POST /api/database-testing/test-cases/:testCaseId/execute', () => {
    it('should execute a test case', async () => {
      const mockTestCase = {
        id: 'test-1',
        name: 'Test Case 1',
        connectionId: 'conn-1',
        queries: [],
        validations: []
      };

      const mockResult = {
        executionId: 'exec-123',
        testCaseId: 'test-1',
        status: 'passed',
        duration: 1500,
        startTime: new Date(),
        endTime: new Date(),
        queryResults: [],
        validationResults: [],
        performance: {
          totalExecutionTime: 1500,
          averageQueryTime: 0,
          slowestQuery: { queryId: '', executionTime: 0 },
          connectionTime: 0,
          memoryUsage: 0,
          cpuUsage: 0
        },
        logs: []
      };

      const DatabaseTestingService = (await import('../../../../backend/src/services/DatabaseTestingService.js')).default;
      const mockServiceInstance = new DatabaseTestingService();
      (mockServiceInstance.getTestCase as any).mockReturnValue(mockTestCase);
      (mockServiceInstance.executeTestCase as any).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/database-testing/test-cases/test-1/execute')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.executionId).toBe('exec-123');
      expect(response.body.data.status).toBe('passed');
    });

    it('should return 404 for non-existent test case', async () => {
      const DatabaseTestingService = (await import('../../../../backend/src/services/DatabaseTestingService.js')).default;
      const mockServiceInstance = new DatabaseTestingService();
      (mockServiceInstance.getTestCase as any).mockReturnValue(null);

      const response = await request(app)
        .post('/api/database-testing/test-cases/non-existent/execute')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Test case not found');
    });
  });

  describe('GET /api/database-testing/executions/:executionId', () => {
    it('should return execution results', async () => {
      const mockResult = {
        executionId: 'exec-123',
        testCaseId: 'test-1',
        status: 'passed',
        duration: 1500
      };

      const DatabaseTestingService = (await import('../../../../backend/src/services/DatabaseTestingService.js')).default;
      const mockServiceInstance = new DatabaseTestingService();
      (mockServiceInstance.getTestResults as any).mockReturnValue(mockResult);

      const response = await request(app)
        .get('/api/database-testing/executions/exec-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.result).toEqual(mockResult);
    });

    it('should return 404 for non-existent execution', async () => {
      const DatabaseTestingService = (await import('../../../../backend/src/services/DatabaseTestingService.js')).default;
      const mockServiceInstance = new DatabaseTestingService();
      (mockServiceInstance.getTestResults as any).mockReturnValue(null);

      const response = await request(app)
        .get('/api/database-testing/executions/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Execution result not found');
    });
  });

  describe('GET /api/database-testing/types', () => {
    it('should return supported database types and validation options', async () => {
      const response = await request(app)
        .get('/api/database-testing/types')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.databaseTypes).toContain('postgresql');
      expect(response.body.data.validationTypes).toContain('row_count');
      expect(response.body.data.validationOperators).toContain('equals');
      expect(response.body.data.defaultPorts).toHaveProperty('postgresql', 5432);
    });
  });

  describe('POST /api/database-testing/validate', () => {
    it('should validate a valid test case configuration', async () => {
      const validConfig = {
        name: 'Valid Test Case',
        connectionId: 'conn-1',
        queries: [
          {
            id: 'query-1',
            sql: 'SELECT COUNT(*) FROM users',
            captureResults: true
          }
        ],
        validations: [
          {
            id: 'validation-1',
            type: 'row_count',
            operator: 'greater_than',
            query: 'SELECT COUNT(*) FROM users',
            description: 'Users should exist'
          }
        ]
      };

      const response = await request(app)
        .post('/api/database-testing/validate')
        .send(validConfig)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.errors).toBeUndefined();
    });

    it('should validate an invalid test case configuration', async () => {
      const invalidConfig = {
        // Missing required fields
        queries: [
          {
            // Missing id and sql
            captureResults: 'invalid' // Should be boolean
          }
        ]
      };

      const response = await request(app)
        .post('/api/database-testing/validate')
        .send(invalidConfig)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.errors).toBeDefined();
      expect(response.body.data.errors.length).toBeGreaterThan(0);
    });
  });
});