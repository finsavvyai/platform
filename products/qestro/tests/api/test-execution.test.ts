/**
 * Test Execution API Integration Tests
 *
 * Comprehensive test suite for the test execution API endpoints.
 * Tests all functionality including queueing, monitoring, and managing test executions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestExecutionAPI } from '../../src/api/test-execution';
import { createTestExecutionEngine } from '../../src/services/test-execution-engine';

// Mock dependencies
vi.mock('../../src/services/test-execution-engine');
vi.mock('drizzle-orm/d1');

describe('Test Execution API', () => {
  let mockDB: any;
  let mockEnv: any;
  let testExecutionAPI: TestExecutionAPI;
  let mockExecutionEngine: any;

  beforeEach(() => {
    // Mock D1 database
    mockDB = {
      select: vi.fn(() => mockDB),
      from: vi.fn(() => mockDB),
      where: vi.fn(() => mockDB),
      orderBy: vi.fn(() => mockDB),
      limit: vi.fn(() => mockDB),
      offset: vi.fn(() => mockDB),
      first: vi.fn(),
    };

    // Mock execution engine
    mockExecutionEngine = {
      queueExecution: vi.fn(),
      getExecutionStatus: vi.fn(),
      cancelExecution: vi.fn(),
      pauseExecution: vi.fn(),
      resumeExecution: vi.fn(),
    };

    (createTestExecutionEngine as any).mockReturnValue(mockExecutionEngine);

    // Mock environment
    mockEnv = {
      DB: {} as D1Database,
      webSocketService: {
        broadcast: vi.fn(),
      },
    };

    testExecutionAPI = new TestExecutionAPI(mockEnv.DB, mockEnv.webSocketService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Queue Execution', () => {
    it('should queue execution successfully with valid data', async () => {
      const requestData = {
        projectId: 'test-project',
        testIds: ['test-1', 'test-2'],
        environment: 'development',
        config: { timeout: 30000 },
      };

      // Mock project existence check
      mockDB.first.mockResolvedValue({ id: 'test-project', name: 'Test Project' });

      // Mock execution engine
      mockExecutionEngine.queueExecution.mockResolvedValue('execution-123');

      const request = new Request('http://localhost/api/test-execution/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'user-123' },
        body: JSON.stringify(requestData),
      });

      const response = await testExecutionAPI.queueExecution(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.executionId).toBe('execution-123');
      expect(data.projectId).toBe('test-project');
      expect(data.testCount).toBe(2);
      expect(data.status).toBe('queued');

      expect(mockExecutionEngine.queueExecution).toHaveBeenCalledWith({
        id: '',
        projectId: 'test-project',
        testIds: ['test-1', 'test-2'],
        config: { timeout: 30000 },
        environment: 'development',
        metadata: {},
        requestedBy: 'user-123',
      });
    });

    it('should return error when project does not exist', async () => {
      const requestData = {
        projectId: 'non-existent-project',
        testIds: ['test-1'],
      };

      // Mock project not found
      mockDB.first.mockResolvedValue(null);

      const request = new Request('http://localhost/api/test-execution/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const response = await testExecutionAPI.queueExecution(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Project not found');
    });

    it('should return validation error for missing required fields', async () => {
      const requestData = {
        projectId: '', // Empty project ID
        testIds: [], // Empty test array
      };

      const request = new Request('http://localhost/api/test-execution/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const response = await testExecutionAPI.queueExecution(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: projectId, testIds');
    });
  });

  describe('Get Execution Status', () => {
    it('should return execution status successfully', async () => {
      const executionId = 'execution-123';
      const mockStatus = {
        execution: {
          id: executionId,
          projectId: 'test-project',
          status: 'running',
          createdAt: new Date(),
        },
        results: [
          {
            id: 'result-1',
            testId: 'test-1',
            status: 'completed',
            duration: 5000,
            startedAt: new Date(),
            completedAt: new Date(),
          },
          {
            id: 'result-2',
            testId: 'test-2',
            status: 'running',
            duration: null,
            startedAt: new Date(),
            completedAt: null,
          },
        ],
        isActive: true,
      };

      // Mock execution engine status
      mockExecutionEngine.getExecutionStatus.mockResolvedValue(mockStatus);

      // Mock artifacts query
      const mockArtifactsQuery = {
        select: vi.fn(() => mockArtifactsQuery),
        where: vi.fn(() => Promise.resolve([])),
      };
      mockDB.select.mockReturnValue(mockArtifactsQuery);

      const request = new Request(`http://localhost/api/test-execution/status/${executionId}`);

      const response = await testExecutionAPI.getExecutionStatus(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.execution.id).toBe(executionId);
      expect(data.execution.isActive).toBe(true);
      expect(data.execution.progress.completed).toBe(1);
      expect(data.execution.progress.total).toBe(2);
      expect(data.execution.progress.percentage).toBe(50);
    });

    it('should handle missing execution ID', async () => {
      const request = new Request('http://localhost/api/test-execution/status/');

      const response = await testExecutionAPI.getExecutionStatus(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing execution ID');
    });
  });

  describe('Cancel Execution', () => {
    it('should cancel execution successfully', async () => {
      const executionId = 'execution-123';
      const cancelData = { reason: 'User requested cancellation' };

      // Mock execution engine cancel
      mockExecutionEngine.cancelExecution.mockResolvedValue(undefined);

      const request = new Request(`http://localhost/api/test-execution/cancel/${executionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cancelData),
      });

      const response = await testExecutionAPI.cancelExecution(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.executionId).toBe(executionId);
      expect(data.status).toBe('cancelled');
      expect(data.reason).toBe('User requested cancellation');

      expect(mockExecutionEngine.cancelExecution).toHaveBeenCalledWith(executionId, 'User requested cancellation');
    });

    it('should handle cancellation without reason', async () => {
      const executionId = 'execution-123';

      mockExecutionEngine.cancelExecution.mockResolvedValue(undefined);

      const request = new Request(`http://localhost/api/test-execution/cancel/${executionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await testExecutionAPI.cancelExecution(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.reason).toBe('Cancelled by user');
    });
  });

  describe('Control Execution (Pause/Resume)', () => {
    it('should pause execution successfully', async () => {
      const executionId = 'execution-123';
      const controlData = { action: 'pause' };

      mockExecutionEngine.pauseExecution.mockResolvedValue(undefined);

      const request = new Request(`http://localhost/api/test-execution/control/${executionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(controlData),
      });

      const response = await testExecutionAPI.controlExecution(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe('pause');

      expect(mockExecutionEngine.pauseExecution).toHaveBeenCalledWith(executionId);
    });

    it('should resume execution successfully', async () => {
      const executionId = 'execution-123';
      const controlData = { action: 'resume' };

      mockExecutionEngine.resumeExecution.mockResolvedValue(undefined);

      const request = new Request(`http://localhost/api/test-execution/control/${executionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(controlData),
      });

      const response = await testExecutionAPI.controlExecution(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe('resume');

      expect(mockExecutionEngine.resumeExecution).toHaveBeenCalledWith(executionId);
    });

    it('should reject invalid control action', async () => {
      const executionId = 'execution-123';
      const controlData = { action: 'invalid' };

      const request = new Request(`http://localhost/api/test-execution/control/${executionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(controlData),
      });

      const response = await testExecutionAPI.controlExecution(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action. Must be "pause" or "resume"');
    });
  });

  describe('Get Executions List', () => {
    it('should return paginated executions list', async () => {
      const projectId = 'test-project';
      const mockExecutions = [
        {
          id: 'exec-1',
          projectId,
          status: 'completed',
          createdAt: new Date('2023-01-01'),
          summary: '{"passed": 5, "failed": 1}',
          config: '{"timeout": 30000}',
          metadata: '{"environment": "test"}',
        },
        {
          id: 'exec-2',
          projectId,
          status: 'running',
          createdAt: new Date('2023-01-02'),
          summary: null,
          config: null,
          metadata: null,
        },
      ];

      // Mock executions query
      const mockQuery = {
        select: vi.fn(() => mockQuery),
        from: vi.fn(() => mockQuery),
        where: vi.fn(() => mockQuery),
        orderBy: vi.fn(() => mockQuery),
        limit: vi.fn(() => mockQuery),
        offset: vi.fn(() => Promise.resolve(mockExecutions)),
      };
      mockDB.select.mockReturnValue(mockQuery);

      // Mock statistics
      const mockStatsQuery = {
        select: vi.fn(() => mockStatsQuery),
        from: vi.fn(() => mockStatsQuery),
        where: vi.fn(() => Promise.resolve(mockExecutions)),
      };
      mockDB.select.mockReturnValue(mockStatsQuery);

      const url = `http://localhost/api/test-execution/list?projectId=${projectId}&limit=10&offset=0`;
      const request = new Request(url);

      const response = await testExecutionAPI.getExecutions(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.executions).toHaveLength(2);
      expect(data.executions[0].summary).toEqual({ passed: 5, failed: 1 });
      expect(data.executions[1].status).toBe('running');
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.offset).toBe(0);
    });

    it('should require projectId parameter', async () => {
      const request = new Request('http://localhost/api/test-execution/list');

      const response = await testExecutionAPI.getExecutions(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing projectId parameter');
    });

    it('should filter by status when provided', async () => {
      const projectId = 'test-project';
      const status = 'completed';

      const mockQuery = {
        select: vi.fn(() => mockQuery),
        from: vi.fn(() => mockQuery),
        where: vi.fn(() => mockQuery),
        orderBy: vi.fn(() => mockQuery),
        limit: vi.fn(() => mockQuery),
        offset: vi.fn(() => Promise.resolve([])),
      };
      mockDB.select.mockReturnValue(mockQuery);

      const url = `http://localhost/api/test-execution/list?projectId=${projectId}&status=${status}`;
      const request = new Request(url);

      await testExecutionAPI.getExecutions(request, mockEnv);

      // Verify that the query was constructed with status filter
      expect(mockQuery.where).toHaveBeenCalled();
    });
  });

  describe('Get Metrics', () => {
    it('should return execution metrics with analytics', async () => {
      const projectId = 'test-project';
      const mockMetrics = [
        {
          id: 'metric-1',
          projectId,
          timestamp: Date.now(),
          totalTests: 10,
          passedTests: 8,
          failedTests: 2,
          averageDuration: 45000,
          successRate: 80,
          performanceMetrics: '{"cpu": 50, "memory": 70}',
          resourceUtilization: '{"disk": 30, "network": 20}',
        },
      ];

      // Mock metrics query
      const mockQuery = {
        select: vi.fn(() => mockQuery),
        from: vi.fn(() => mockQuery),
        where: vi.fn(() => mockQuery),
        orderBy: vi.fn(() => Promise.resolve(mockMetrics)),
      };
      mockDB.select.mockReturnValue(mockQuery);

      const url = `http://localhost/api/test-execution/metrics?projectId=${projectId}`;
      const request = new Request(url);

      const response = await testExecutionAPI.getMetrics(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.analytics.totalExecutions).toBe(1);
      expect(data.analytics.totalTests).toBe(10);
      expect(data.analytics.averageSuccessRate).toBe(80);
      expect(data.metrics[0].performanceMetrics).toEqual({ cpu: 50, memory: 70 });
    });

    it('should require projectId parameter', async () => {
      const request = new Request('http://localhost/api/test-execution/metrics');

      const response = await testExecutionAPI.getMetrics(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing projectId parameter');
    });

    it('should handle custom timeframe', async () => {
      const projectId = 'test-project';
      const from = '2023-01-01T00:00:00.000Z';
      const to = '2023-01-31T23:59:59.999Z';

      const mockQuery = {
        select: vi.fn(() => mockQuery),
        from: vi.fn(() => mockQuery),
        where: vi.fn(() => mockQuery),
        orderBy: vi.fn(() => Promise.resolve([])),
      };
      mockDB.select.mockReturnValue(mockQuery);

      const url = `http://localhost/api/test-execution/metrics?projectId=${projectId}&from=${from}&to=${to}`;
      const request = new Request(url);

      await testExecutionAPI.getMetrics(request, mockEnv);

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle execution engine errors gracefully', async () => {
      const requestData = {
        projectId: 'test-project',
        testIds: ['test-1'],
      };

      // Mock project exists
      mockDB.first.mockResolvedValue({ id: 'test-project' });

      // Mock execution engine error
      mockExecutionEngine.queueExecution.mockRejectedValue(new Error('Engine error'));

      const request = new Request('http://localhost/api/test-execution/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const response = await testExecutionAPI.queueExecution(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to queue test execution');
      expect(data.message).toBe('Engine error');
    });

    it('should handle database errors gracefully', async () => {
      const projectId = 'test-project';

      // Mock database error
      mockDB.select.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const url = `http://localhost/api/test-execution/list?projectId=${projectId}`;
      const request = new Request(url);

      const response = await testExecutionAPI.getExecutions(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get executions');
      expect(data.message).toBe('Database connection failed');
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate execution statistics correctly', async () => {
      const mockResults = [
        { status: 'passed', duration: 5000 },
        { status: 'passed', duration: 3000 },
        { status: 'failed', duration: 7000 },
        { status: 'skipped', duration: 0 },
        { status: 'error', duration: 2000 },
      ];

      // Access private method for testing
      const statsMethod = (testExecutionAPI as any).calculateExecutionStatistics;
      const stats = statsMethod.call(testExecutionAPI, mockResults);

      expect(stats.total).toBe(5);
      expect(stats.passed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.skipped).toBe(1);
      expect(stats.errors).toBe(1);
      expect(stats.successRate).toBe(40); // 2/5 * 100
      expect(stats.failureRate).toBe(20); // 1/5 * 100
      expect(stats.averageDuration).toBe(3400); // (5000+3000+7000+0+2000)/4
    });

    it('should handle empty results', async () => {
      const statsMethod = (testExecutionAPI as any).calculateExecutionStatistics;
      const stats = statsMethod.call(testExecutionAPI, []);

      expect(stats.total).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.failureRate).toBe(0);
      expect(stats.averageDuration).toBe(0);
    });
  });
});
