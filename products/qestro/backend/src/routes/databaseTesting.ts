/**
 * Database Testing Routes
 *
 * RESTful API endpoints for database testing and validation
 * Following Kiro guidelines for Phase 5: Database Testing System
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { Router, Request, Response } from 'express';
import DatabaseTestingService, {
  DatabaseConnection,
  DatabaseType,
  DatabaseTestCase,
  ValidationType,
  ValidationOperator
} from '../services/DatabaseTestingService.js';
import { authenticateToken } from '../middleware/auth.js';
import { trackUsageMiddleware } from '../middleware/usageTrackingMiddleware.js';

const router = Router();
const databaseTestingService = new DatabaseTestingService();

// Apply authentication and usage tracking to all routes
router.use(authenticateToken);
router.use(trackUsageMiddleware('api'));

/**
 * GET /api/database-testing/connections
 * Get all database connections
 */
router.get('/connections', async (req: Request, res: Response) => {
  try {
    const connections = databaseTestingService.getAllConnections();
    res.json({
      success: true,
      data: {
        connections,
        count: connections.length
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve database connections',
      details: error.message
    });
  }
});

/**
 * POST /api/database-testing/connections
 * Register a new database connection
 */
router.post('/connections', async (req: Request, res: Response) => {
  try {
    const {
      name,
      type,
      host,
      port,
      database,
      username,
      password,
      ssl,
      connectionOptions
    } = req.body;

    // Validate required fields
    if (!name || !type || !host || !database) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: 'name, type, host, and database are required'
      });
    }

    // Validate database type
    if (!Object.values(DatabaseType).includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid database type',
        details: `Supported types: ${Object.values(DatabaseType).join(', ')}`
      });
    }

    const connection: DatabaseConnection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      host,
      port: port || (type === DatabaseType.POSTGRESQL ? 5432 :
                     type === DatabaseType.MYSQL ? 3306 :
                     type === DatabaseType.MONGODB ? 27017 :
                     type === DatabaseType.REDIS ? 6379 : 0),
      database,
      username,
      password,
      ssl,
      connectionOptions
    };

    await databaseTestingService.registerConnection(connection);

    res.status(201).json({
      success: true,
      data: {
        connectionId: connection.id,
        message: 'Database connection registered successfully'
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to register database connection',
      details: error.message
    });
  }
});

/**
 * POST /api/database-testing/connections/:connectionId/test
 * Test a database connection
 */
router.post('/connections/:connectionId/test', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;

    const isConnected = await databaseTestingService.testConnection(connectionId);

    res.json({
      success: true,
      data: {
        connectionId,
        connected: isConnected,
        message: isConnected ? 'Connection successful' : 'Connection failed',
        testedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: 'Failed to test database connection',
      details: error.message
    });
  }
});

/**
 * GET /api/database-testing/test-cases
 * Get all database test cases
 */
router.get('/test-cases', async (req: Request, res: Response) => {
  try {
    const testCases = databaseTestingService.getAllTestCases();
    res.json({
      success: true,
      data: {
        testCases,
        count: testCases.length
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve test cases',
      details: error.message
    });
  }
});

/**
 * POST /api/database-testing/test-cases
 * Create a new database test case
 */
router.post('/test-cases', async (req: Request, res: Response) => {
  try {
    const testCaseData = req.body;

    // Validate required fields
    if (!testCaseData.name || !testCaseData.connectionId || !testCaseData.queries) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: 'name, connectionId, and queries are required'
      });
    }

    // Validate validations array
    if (testCaseData.validations) {
      for (const validation of testCaseData.validations) {
        if (!Object.values(ValidationType).includes(validation.type)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid validation type',
            details: `Supported validation types: ${Object.values(ValidationType).join(', ')}`
          });
        }
        if (!Object.values(ValidationOperator).includes(validation.operator)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid validation operator',
            details: `Supported operators: ${Object.values(ValidationOperator).join(', ')}`
          });
        }
      }
    }

    const testCaseId = await databaseTestingService.createTestCase(testCaseData);

    res.status(201).json({
      success: true,
      data: {
        testCaseId,
        message: 'Test case created successfully'
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to create test case',
      details: error.message
    });
  }
});

/**
 * GET /api/database-testing/test-cases/:testCaseId
 * Get a specific test case
 */
router.get('/test-cases/:testCaseId', async (req: Request, res: Response) => {
  try {
    const { testCaseId } = req.params;
    const testCase = databaseTestingService.getTestCase(testCaseId);

    if (!testCase) {
      return res.status(404).json({
        success: false,
        error: 'Test case not found',
        details: `Test case with ID ${testCaseId} does not exist`
      });
    }

    res.json({
      success: true,
      data: { testCase }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve test case',
      details: error.message
    });
  }
});

/**
 * PUT /api/database-testing/test-cases/:testCaseId
 * Update a test case
 */
router.put('/test-cases/:testCaseId', async (req: Request, res: Response) => {
  try {
    const { testCaseId } = req.params;
    const updates = req.body;

    await databaseTestingService.updateTestCase(testCaseId, updates);

    res.json({
      success: true,
      data: {
        testCaseId,
        message: 'Test case updated successfully'
      }
    });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Test case not found',
        details: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update test case',
      details: error.message
    });
  }
});

/**
 * DELETE /api/database-testing/test-cases/:testCaseId
 * Delete a test case
 */
router.delete('/test-cases/:testCaseId', async (req: Request, res: Response) => {
  try {
    const { testCaseId } = req.params;

    await databaseTestingService.deleteTestCase(testCaseId);

    res.json({
      success: true,
      data: {
        testCaseId,
        message: 'Test case deleted successfully'
      }
    });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Test case not found',
        details: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete test case',
      details: error.message
    });
  }
});

/**
 * POST /api/database-testing/test-cases/:testCaseId/execute
 * Execute a database test case
 */
router.post('/test-cases/:testCaseId/execute', async (req: Request, res: Response) => {
  try {
    const { testCaseId } = req.params;
    const testCase = databaseTestingService.getTestCase(testCaseId);

    if (!testCase) {
      return res.status(404).json({
        success: false,
        error: 'Test case not found',
        details: `Test case with ID ${testCaseId} does not exist`
      });
    }

    // Convert the stored test case to DatabaseTestCase format
    const dbTestCase: DatabaseTestCase = {
      id: testCase.id,
      name: testCase.name,
      description: testCase.description || '',
      connectionId: testCase.connectionId,
      queries: testCase.queries || [],
      validations: testCase.validations || [],
      setupQueries: testCase.setupQueries || [],
      teardownQueries: testCase.teardownQueries || [],
      timeout: testCase.timeout || 30000,
      retries: testCase.retries || 0
    };

    const result = await databaseTestingService.executeTestCase(dbTestCase);

    res.json({
      success: true,
      data: {
        executionId: result.executionId,
        status: result.status,
        duration: result.duration,
        result
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to execute test case',
      details: error.message
    });
  }
});

/**
 * GET /api/database-testing/executions/:executionId
 * Get test execution results
 */
router.get('/executions/:executionId', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const result = databaseTestingService.getTestResults(executionId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Execution result not found',
        details: `Execution with ID ${executionId} does not exist`
      });
    }

    res.json({
      success: true,
      data: { result }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve execution result',
      details: error.message
    });
  }
});

/**
 * GET /api/database-testing/executions
 * Get all active test executions
 */
router.get('/executions', async (req: Request, res: Response) => {
  try {
    const activeTests = databaseTestingService.getActiveTests();
    res.json({
      success: true,
      data: {
        executions: activeTests,
        count: activeTests.length
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve test executions',
      details: error.message
    });
  }
});

/**
 * GET /api/database-testing/types
 * Get supported database types and validation options
 */
router.get('/types', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        databaseTypes: Object.values(DatabaseType),
        validationTypes: Object.values(ValidationType),
        validationOperators: Object.values(ValidationOperator),
        defaultPorts: {
          [DatabaseType.POSTGRESQL]: 5432,
          [DatabaseType.MYSQL]: 3306,
          [DatabaseType.MONGODB]: 27017,
          [DatabaseType.REDIS]: 6379,
          [DatabaseType.SQLITE]: 0
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve database types',
      details: error.message
    });
  }
});

/**
 * POST /api/database-testing/validate
 * Validate test case configuration without executing
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const testCaseData = req.body;
    const errors: string[] = [];

    // Validate required fields
    if (!testCaseData.name) errors.push('name is required');
    if (!testCaseData.connectionId) errors.push('connectionId is required');
    if (!testCaseData.queries || !Array.isArray(testCaseData.queries)) {
      errors.push('queries array is required');
    }

    // Validate queries
    if (testCaseData.queries) {
      testCaseData.queries.forEach((query: any, index: number) => {
        if (!query.id) errors.push(`Query ${index + 1}: id is required`);
        if (!query.sql) errors.push(`Query ${index + 1}: sql is required`);
        if (typeof query.captureResults !== 'boolean') {
          errors.push(`Query ${index + 1}: captureResults must be boolean`);
        }
      });
    }

    // Validate validations
    if (testCaseData.validations) {
      testCaseData.validations.forEach((validation: any, index: number) => {
        if (!validation.id) errors.push(`Validation ${index + 1}: id is required`);
        if (!Object.values(ValidationType).includes(validation.type)) {
          errors.push(`Validation ${index + 1}: invalid validation type`);
        }
        if (!Object.values(ValidationOperator).includes(validation.operator)) {
          errors.push(`Validation ${index + 1}: invalid validation operator`);
        }
        if (!validation.query) errors.push(`Validation ${index + 1}: query is required`);
        if (!validation.description) errors.push(`Validation ${index + 1}: description is required`);
      });
    }

    const isValid = errors.length === 0;

    res.json({
      success: true,
      data: {
        valid: isValid,
        errors: errors.length > 0 ? errors : undefined,
        message: isValid ? 'Test case configuration is valid' : 'Test case configuration has errors'
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to validate test case',
      details: error.message
    });
  }
});

export default router;