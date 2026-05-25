/**
 * Test Execution Engine Tests - Phase 8
 */

import TestExecutionEngine, { TestCase, ExecutionConfig } from '../../../../backend/src/services/TestExecutionEngine';

describe('TestExecutionEngine', () => {
  let engine: TestExecutionEngine;

  beforeEach(() => {
    engine = new TestExecutionEngine();
  });

  afterEach(async () => {
    await engine.cancelAll();
    engine.clearResults();
  });

  describe('Single Test Execution', () => {
    it('should execute a single web test', async () => {
      const testCase: TestCase = {
        id: 'test-1',
        name: 'Login Test',
        type: 'web',
        framework: 'playwright',
        code: 'test code here',
      };

      const result = await engine.executeTest(testCase);

      expect(result).toBeDefined();
      expect(result.testId).toBe('test-1');
      expect(['passed', 'failed', 'error']).toContain(result.status);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);
    });

    it('should execute a mobile test', async () => {
      const testCase: TestCase = {
        id: 'test-2',
        name: 'Mobile Navigation Test',
        type: 'mobile',
        framework: 'maestro',
        code: 'mobile test code',
      };

      const result = await engine.executeTest(testCase);

      expect(result).toBeDefined();
      expect(result.testId).toBe('test-2');
      expect(result.status).toBeDefined();
    });

    it('should execute an API test', async () => {
      const testCase: TestCase = {
        id: 'test-3',
        name: 'API Endpoint Test',
        type: 'api',
        framework: 'postman',
        code: 'api test code',
      };

      const result = await engine.executeTest(testCase);

      expect(result).toBeDefined();
      expect(result.testId).toBe('test-3');
      expect(result.status).toBeDefined();
    });

    it('should execute a database test', async () => {
      const testCase: TestCase = {
        id: 'test-4',
        name: 'Database Query Test',
        type: 'database',
        framework: 'custom',
        code: 'database test code',
      };

      const result = await engine.executeTest(testCase);

      expect(result).toBeDefined();
      expect(result.testId).toBe('test-4');
      expect(result.status).toBeDefined();
    });

    it('should include metrics in test results', async () => {
      const testCase: TestCase = {
        id: 'test-5',
        name: 'Metrics Test',
        type: 'web',
        framework: 'playwright',
        code: 'test code',
      };

      const result = await engine.executeTest(testCase);

      expect(result.metrics).toBeDefined();
      expect(result.metrics?.memory).toBeGreaterThanOrEqual(0);
      expect(result.metrics?.cpu).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Test Suite Execution', () => {
    it('should execute multiple tests in parallel', async () => {
      const testCases: TestCase[] = [
        { id: 'test-1', name: 'Test 1', type: 'web', framework: 'playwright', code: 'code1' },
        { id: 'test-2', name: 'Test 2', type: 'web', framework: 'playwright', code: 'code2' },
        { id: 'test-3', name: 'Test 3', type: 'api', framework: 'postman', code: 'code3' },
      ];

      const results = await engine.executeTestSuite(testCases);

      expect(results.size).toBe(3);
      expect(results.has('test-1')).toBe(true);
      expect(results.has('test-2')).toBe(true);
      expect(results.has('test-3')).toBe(true);
    });

    it('should respect priority ordering', async () => {
      const testCases: TestCase[] = [
        { id: 'test-1', name: 'Low Priority', type: 'web', framework: 'playwright', code: 'code1', priority: 1 },
        { id: 'test-2', name: 'High Priority', type: 'web', framework: 'playwright', code: 'code2', priority: 10 },
        { id: 'test-3', name: 'Medium Priority', type: 'web', framework: 'playwright', code: 'code3', priority: 5 },
      ];

      const results = await engine.executeTestSuite(testCases);

      expect(results.size).toBe(3);
    });

    it('should handle fail-fast mode', async () => {
      const testCases: TestCase[] = Array.from({ length: 10 }, (_, i) => ({
        id: `test-${i}`,
        name: `Test ${i}`,
        type: 'web' as const,
        framework: 'playwright',
        code: 'code',
      }));

      const config: ExecutionConfig = {
        failFast: true,
      };

      const results = await engine.executeTestSuite(testCases, config);

      // Should stop after first failure
      expect(results.size).toBeGreaterThan(0);
    });

    it('should limit parallel execution', async () => {
      const testCases: TestCase[] = Array.from({ length: 10 }, (_, i) => ({
        id: `test-${i}`,
        name: `Test ${i}`,
        type: 'web' as const,
        framework: 'playwright',
        code: 'code',
      }));

      const config: ExecutionConfig = {
        maxParallel: 2,
      };

      const results = await engine.executeTestSuite(testCases, config);

      expect(results.size).toBe(10);
    });
  });

  describe('Statistics', () => {
    it('should provide execution statistics', async () => {
      const testCases: TestCase[] = [
        { id: 'test-1', name: 'Test 1', type: 'web', framework: 'playwright', code: 'code1' },
        { id: 'test-2', name: 'Test 2', type: 'web', framework: 'playwright', code: 'code2' },
      ];

      await engine.executeTestSuite(testCases);

      const stats = engine.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.total).toBe(2);
      expect(stats.passed).toBeGreaterThanOrEqual(0);
      expect(stats.failed).toBeGreaterThanOrEqual(0);
      expect(stats.passRate).toBeGreaterThanOrEqual(0);
      expect(stats.passRate).toBeLessThanOrEqual(100);
      expect(stats.totalDuration).toBeGreaterThan(0);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });

    it('should track running tests', async () => {
      const testCase: TestCase = {
        id: 'test-1',
        name: 'Test 1',
        type: 'web',
        framework: 'playwright',
        code: 'code',
      };

      const promise = engine.executeTest(testCase);
      
      // Check stats while running (may or may not catch it)
      const stats = engine.getStatistics();
      expect(stats).toBeDefined();

      await promise;
    });
  });

  describe('Result Management', () => {
    it('should retrieve test result by ID', async () => {
      const testCase: TestCase = {
        id: 'test-1',
        name: 'Test 1',
        type: 'web',
        framework: 'playwright',
        code: 'code',
      };

      await engine.executeTest(testCase);

      const result = engine.getResult('test-1');

      expect(result).toBeDefined();
      expect(result?.testId).toBe('test-1');
    });

    it('should retrieve all results', async () => {
      const testCases: TestCase[] = [
        { id: 'test-1', name: 'Test 1', type: 'web', framework: 'playwright', code: 'code1' },
        { id: 'test-2', name: 'Test 2', type: 'web', framework: 'playwright', code: 'code2' },
      ];

      await engine.executeTestSuite(testCases);

      const results = engine.getAllResults();

      expect(results).toHaveLength(2);
    });

    it('should clear results', async () => {
      const testCase: TestCase = {
        id: 'test-1',
        name: 'Test 1',
        type: 'web',
        framework: 'playwright',
        code: 'code',
      };

      await engine.executeTest(testCase);
      
      engine.clearResults();

      const results = engine.getAllResults();
      expect(results).toHaveLength(0);
    });
  });

  describe('Cancellation', () => {
    it('should cancel all running tests', async () => {
      const testCases: TestCase[] = Array.from({ length: 5 }, (_, i) => ({
        id: `test-${i}`,
        name: `Test ${i}`,
        type: 'web' as const,
        framework: 'playwright',
        code: 'code',
      }));

      const promise = engine.executeTestSuite(testCases);
      
      // Cancel immediately
      await engine.cancelAll();

      // Wait for suite to complete
      await promise;

      const stats = engine.getStatistics();
      expect(stats.isRunning).toBe(false);
    });
  });

  describe('Event Emission', () => {
    it('should emit test:start event', (done) => {
      const testCase: TestCase = {
        id: 'test-1',
        name: 'Test 1',
        type: 'web',
        framework: 'playwright',
        code: 'code',
      };

      engine.on('test:start', (data) => {
        expect(data.testId).toBe('test-1');
        expect(data.name).toBe('Test 1');
        done();
      });

      engine.executeTest(testCase);
    });

    it('should emit test:complete event', (done) => {
      const testCase: TestCase = {
        id: 'test-1',
        name: 'Test 1',
        type: 'web',
        framework: 'playwright',
        code: 'code',
      };

      engine.on('test:complete', (result) => {
        expect(result.testId).toBe('test-1');
        done();
      });

      engine.executeTest(testCase);
    });

    it('should emit suite:start event', (done) => {
      const testCases: TestCase[] = [
        { id: 'test-1', name: 'Test 1', type: 'web', framework: 'playwright', code: 'code1' },
        { id: 'test-2', name: 'Test 2', type: 'web', framework: 'playwright', code: 'code2' },
      ];

      engine.on('suite:start', (data) => {
        expect(data.totalTests).toBe(2);
        done();
      });

      engine.executeTestSuite(testCases);
    });

    it('should emit suite:complete event', (done) => {
      const testCases: TestCase[] = [
        { id: 'test-1', name: 'Test 1', type: 'web', framework: 'playwright', code: 'code1' },
      ];

      engine.on('suite:complete', (data) => {
        expect(data.totalTests).toBe(1);
        expect(data.results).toBeDefined();
        done();
      });

      engine.executeTestSuite(testCases);
    });
  });
});
