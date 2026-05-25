/**
 * Tests for Test Execution Manager
 *
 * Comprehensive test coverage for test execution orchestration, parallel processing,
 * resource management, and error handling scenarios
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { TestExecutionManager, type TestExecutionRequest, type TestSuite, type TestCase } from '../../src/services/test-execution/execution-manager';
import { EventEmitter } from 'events';

describe('TestExecutionManager', () => {
  let executionManager: TestExecutionManager;
  let mockResourceManager: any;
  let mockDeviceManager: any;
  let mockReportGenerator: any;
  let mockNotificationService: any;

  beforeEach(() => {
    // Mock dependencies
    mockResourceManager = {
      checkAvailability: vi.fn().mockResolvedValue(true),
      allocateResources: vi.fn().mockResolvedValue(undefined),
      releaseResources: vi.fn().mockResolvedValue(undefined)
    };

    mockDeviceManager = {
      getAvailableDevices: vi.fn().mockResolvedValue([]),
      reserveDevice: vi.fn().mockResolvedValue('device-1'),
      releaseDevice: vi.fn().mockResolvedValue(undefined)
    };

    mockReportGenerator = {
      generateReport: vi.fn().mockResolvedValue({ path: '/reports/test.html', size: 1024 })
    };

    mockNotificationService = {
      send: vi.fn().mockResolvedValue(undefined)
    };

    // Create manager instance
    executionManager = new TestExecutionManager() as any;

    // Mock the dependencies
    executionManager.resourceManager = mockResourceManager;
    executionManager.deviceManager = mockDeviceManager;
    executionManager.reportGenerator = mockReportGenerator;
    executionManager.notificationService = mockNotificationService;
  });

  describe('Execution Queue Management', () => {
    it('should queue execution requests successfully', async () => {
      const request = createMockExecutionRequest();

      const executionId = await executionManager.queueExecution(request);

      expect(executionId).toBeDefined();
      expect(executionId).toMatch(/^exec_\d+_[a-z0-9]+$/);
    });

    it('should sort queue by priority', async () => {
      const lowPriorityRequest = createMockExecutionRequest({ priority: 'low' });
      const highPriorityRequest = createMockExecutionRequest({ priority: 'high' });
      const criticalPriorityRequest = createMockExecutionRequest({ priority: 'critical' });

      // Queue in random order
      await executionManager.queueExecution(lowPriorityRequest);
      await executionManager.queueExecution(criticalPriorityRequest);
      await executionManager.queueExecution(highPriorityRequest);

      // Get internal queue for testing
      const queue = (executionManager as any).executionQueue;

      // Should be sorted by priority (critical, high, low)
      expect(queue[0].priority).toBe('critical');
      expect(queue[1].priority).toBe('high');
      expect(queue[2].priority).toBe('low');
    });

    it('should validate execution requests', async () => {
      const invalidRequest = {
        id: 'invalid-request',
        userId: 'user-123',
        projectId: 'project-456',
        testSuite: { tests: [] }, // Empty test suite
        executionConfig: createMockExecutionConfig(),
        requestedAt: new Date(),
        priority: 'medium' as const
      };

      await expect(executionManager.queueExecution(invalidRequest)).rejects.toThrow('Test suite must contain at least one test');
    });

    it('should handle resource unavailability', async () => {
      mockResourceManager.checkAvailability.mockResolvedValue(false);

      const request = createMockExecutionRequest();
      await executionManager.queueExecution(request);

      // Execution should remain queued when resources unavailable
      const queue = (executionManager as any).executionQueue;
      expect(queue.length).toBe(1);
    });
  });

  describe('Test Execution', () => {
    it('should execute test suite sequentially', async () => {
      const request = createMockExecutionRequest({
        executionConfig: {
          ...createMockExecutionConfig(),
          parallelExecution: false,
          maxConcurrency: 1
        }
      });

      const executionId = await executionManager.queueExecution(request);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution = await executionManager.getExecutionStatus(executionId);
      expect(execution).toBeDefined();
      expect(execution?.status).toBe('completed');
      expect(execution?.progress.completedTests).toBe(2);
    });

    it('should execute tests in parallel when configured', async () => {
      const request = createMockExecutionRequest({
        testSuite: createMockTestSuite({
          tests: Array.from({ length: 4 }, (_, i) => createMockTestCase(`test-${i}`))
        }),
        executionConfig: {
          ...createMockExecutionConfig(),
          parallelExecution: true,
          maxConcurrency: 2
        }
      });

      const executionId = await executionManager.queueExecution(request);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      const execution = await executionManager.getExecutionStatus(executionId);
      expect(execution).toBeDefined();
      expect(execution?.status).toBe('completed');
      expect(execution?.progress.completedTests).toBe(4);
    });

    it('should handle test failures appropriately', async () => {
      const request = createMockExecutionRequest({
        testSuite: createMockTestSuite({
          tests: [
            createMockTestCase('failing-test', { willFail: true })
          ]
        })
      });

      const executionId = await executionManager.queueExecution(request);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution = await executionManager.getExecutionStatus(executionId);
      expect(execution).toBeDefined();
      expect(execution?.status).toBe('failed');
      expect(execution?.error).toBeDefined();
    });

    it('should execute setup and teardown steps', async () => {
      const request = createMockExecutionRequest({
        testSuite: createMockTestSuite({
          setup: [
            { id: 'setup-1', name: 'Initialize test environment', type: 'setup', action: 'init' }
          ],
          teardown: [
            { id: 'teardown-1', name: 'Cleanup test environment', type: 'cleanup', action: 'cleanup' }
          ]
        })
      });

      const executionId = await executionManager.queueExecution(request);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution = await executionManager.getExecutionStatus(executionId);
      expect(execution).toBeDefined();
      expect(execution?.status).toBe('completed');

      // Check that setup and teardown steps were logged
      const setupLogs = execution?.logs.filter(log => log.message.includes('setup'));
      const teardownLogs = execution?.logs.filter(log => log.message.includes('cleanup'));
      expect(setupLogs?.length).toBeGreaterThan(0);
      expect(teardownLogs?.length).toBeGreaterThan(0);
    });

    it('should respect timeout configurations', async () => {
      const request = createMockExecutionRequest({
        executionConfig: {
          ...createMockExecutionConfig(),
          timeoutStrategy: {
            defaultTimeout: 5000,
            perTestTimeout: 2000,
            suiteTimeout: 10000,
            escalateOnTimeout: true
          }
        }
      });

      const executionId = await executionManager.queueExecution(request);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution = await executionManager.getExecutionStatus(executionId);
      expect(execution).toBeDefined();
      // Should complete within timeout
      expect(execution?.duration).toBeLessThan(5000);
    });
  });

  describe('Progress Tracking', () => {
    it('should track execution progress accurately', async () => {
      const request = createMockExecutionRequest({
        testSuite: createMockTestSuite({
          tests: Array.from({ length: 5 }, (_, i) => createMockTestCase(`test-${i}`))
        })
      });

      const progressUpdates: any[] = [];
      executionManager.on('test_completed', (data) => {
        progressUpdates.push(data);
      });

      const executionId = await executionManager.queueExecution(request);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const execution = await executionManager.getExecutionStatus(executionId);
      expect(execution?.progress.totalTests).toBe(5);
      expect(execution?.progress.completedTests).toBe(5);
      expect(execution?.progress.percentage).toBe(100);

      // Should have received progress updates
      expect(progressUpdates.length).toBe(5);
    });

    it('should update progress for failed tests', async () => {
      const request = createMockExecutionRequest({
        testSuite: createMockTestSuite({
          tests: [
            createMockTestCase('passing-test'),
            createMockTestCase('failing-test', { willFail: true }),
            createMockTestCase('another-passing-test')
          ]
        })
      });

      const executionId = await executionManager.queueExecution(request);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      const execution = await executionManager.getExecutionStatus(executionId);
      expect(execution?.progress.completedTests).toBe(3);
      expect(execution?.progress.passedTests).toBe(2);
      expect(execution?.progress.failedTests).toBe(1);
    });
  });

  describe('Resource Management', () => {
    it('should allocate resources before execution', async () => {
      const request = createMockExecutionRequest();

      const executionId = await executionManager.queueExecution(request);

      // Wait for resource allocation
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockResourceManager.allocateResources).toHaveBeenCalledWith(
        expect.any(String),
        request.executionConfig.resourceAllocation
      );
    });

    it('should release resources after execution', async () => {
      const request = createMockExecutionRequest();

      const executionId = await executionManager.queueExecution(request);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockResourceManager.releaseResources).toHaveBeenCalledWith(expect.any(String));
    });

    it('should handle resource allocation failures', async () => {
      mockResourceManager.allocateResources.mockRejectedValue(new Error('Resource allocation failed'));

      const request = createMockExecutionRequest();

      const executionId = await executionManager.queueExecution(request);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution = await executionManager.getExecutionStatus(executionId);
      expect(execution?.status).toBe('failed');
      expect(execution?.error?.message).toContain('Resource allocation failed');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle execution cancellation', async () => {
      const request = createMockExecutionRequest({
        testSuite: createMockTestSuite({
          tests: Array.from({ length: 10 }, (_, i) => createMockTestCase(`slow-test-${i}`))
        })
      });

      const executionId = await executionManager.queueExecution(request);

      // Cancel execution
      const cancelled = await executionManager.cancelExecution(executionId, 'User requested cancellation');
      expect(cancelled).toBe(true);

      const execution = await executionManager.getExecutionStatus(executionId);
      expect(execution?.status).toBe('cancelled');
      expect(execution?.endTime).toBeDefined();
    });

    it('should retry failed executions', async () => {
      const originalRequest = createMockExecutionRequest();
      const originalExecutionId = await executionManager.queueExecution(originalRequest);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate failed execution in history
      const executionHistory = (executionManager as any).executionHistory;
      if (executionHistory.length > 0) {
        executionHistory[0].status = 'failed';
        executionHistory[0].result = { outcome: 'failed' as const, passed: 0, failed: 1, skipped: 0, errors: 1, assertions: [], performance: { totalTime: 1000, averageStepTime: 200, slowestStep: 'test', slowestStepTime: 500, memoryUsage: 100, cpuUsage: 25, networkRequests: 3, customMetrics: {} } };
      }

      const retryExecutionId = await executionManager.retryExecution(originalExecutionId, {
        maxRetries: 2,
        retryDelay: 1000
      });

      expect(retryExecutionId).toBeDefined();
      expect(retryExecutionId).not.toBe(originalExecutionId);
    });

    it('should handle infrastructure errors gracefully', async () => {
      // Mock infrastructure failure
      mockResourceManager.checkAvailability.mockRejectedValue(new Error('Infrastructure error'));

      const request = createMockExecutionRequest();

      await expect(executionManager.queueExecution(request)).rejects.toThrow('Infrastructure error');
    });

    it('should emit appropriate events for error scenarios', async () => {
      const errorEvents: any[] = [];
      executionManager.on('execution_error', (data) => {
        errorEvents.push(data);
      });

      // Trigger an error
      await expect(executionManager.queueExecution({
        id: 'invalid',
        userId: '',
        projectId: '',
        testSuite: { tests: [] },
        executionConfig: createMockExecutionConfig(),
        requestedAt: new Date(),
        priority: 'medium'
      })).rejects.toThrow();

      expect(errorEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Reporting and Notifications', () => {
    it('should generate reports when configured', async () => {
      const request = createMockExecutionRequest({
        executionConfig: {
          ...createMockExecutionConfig(),
          reportingStrategy: {
            realTimeUpdates: true,
            includeScreenshots: true,
            includeVideos: false,
            includeLogs: true,
            includePerformanceMetrics: true,
            reportFormats: ['html', 'json']
          }
        }
      });

      const executionId = await executionManager.queueExecution(request);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockReportGenerator.generateReport).toHaveBeenCalledTimes(2); // html + json
    });

    it('should send notifications on completion', async () => {
      const request = createMockExecutionRequest({
        notificationConfig: {
          onSuccess: [
            {
              type: 'email',
              recipients: ['test@example.com'],
              template: 'execution-success'
            }
          ],
          onFailure: [],
          onProgress: [],
          channels: [{ type: 'email', config: {}, enabled: true }]
        }
      });

      const executionId = await executionManager.queueExecution(request);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'email' }),
        expect.objectContaining({ type: 'success' })
      );
    });

    it('should send notifications on failure', async () => {
      const request = createMockExecutionRequest({
        testSuite: createMockTestSuite({
          tests: [createMockTestCase('failing-test', { willFail: true })]
        }),
        notificationConfig: {
          onSuccess: [],
          onFailure: [
            {
              type: 'slack',
              recipients: ['#test-alerts'],
              template: 'execution-failure'
            }
          ],
          onProgress: [],
          channels: [{ type: 'slack', config: {}, enabled: true }]
        }
      });

      const executionId = await executionManager.queueExecution(request);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'slack' }),
        expect.objectContaining({ type: 'failure' })
      );
    });

    it('should collect execution artifacts', async () => {
      const request = createMockExecutionRequest({
        executionConfig: {
          ...createMockExecutionConfig(),
          reportingStrategy: {
            realTimeUpdates: true,
            includeScreenshots: true,
            includeVideos: true,
            includeLogs: true,
            includePerformanceMetrics: true,
            reportFormats: ['html']
          }
        }
      });

      const executionId = await executionManager.queueExecution(request);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution = await executionManager.getExecutionStatus(executionId);
      expect(execution?.artifacts).toBeDefined();
      expect(execution?.artifacts.length).toBeGreaterThan(0);

      const reports = execution?.artifacts.filter(a => a.type === 'report');
      expect(reports?.length).toBeGreaterThan(0);
    });
  });

  describe('Execution History and Statistics', () => {
    it('should maintain execution history', async () => {
      const requests = Array.from({ length: 3 }, (_, i) =>
        createMockExecutionRequest({ id: `request-${i}` })
      );

      const executionIds = await Promise.all(
        requests.map(request => executionManager.queueExecution(request))
      );

      // Wait for executions to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const history = await executionManager.getExecutionHistory();
      expect(history.executions.length).toBe(3);
      expect(history.total).toBe(3);
    });

    it('should filter execution history', async () => {
      const user1Request = createMockExecutionRequest({
        id: 'user1-request',
        userId: 'user-1',
        projectId: 'project-1'
      });
      const user2Request = createMockExecutionRequest({
        id: 'user2-request',
        userId: 'user-2',
        projectId: 'project-2'
      });

      await executionManager.queueExecution(user1Request);
      await executionManager.queueExecution(user2Request);

      // Wait for executions to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      // Filter by user
      const user1History = await executionManager.getExecutionHistory({
        userId: 'user-1'
      });
      expect(user1History.executions.length).toBe(1);
      expect(user1History.executions[0].metadata.userId).toBe('user-1');

      // Filter by project
      const project1History = await executionManager.getExecutionHistory({
        projectId: 'project-1'
      });
      expect(project1History.executions.length).toBe(1);
    });

    it('should generate execution statistics', async () => {
      const requests = Array.from({ length: 5 }, (_, i) =>
        createMockExecutionRequest({ id: `stats-request-${i}` })
      );

      // Make some fail
      requests[1].testSuite.tests[0].willFail = true;
      requests[3].testSuite.tests[0].willFail = true;

      await Promise.all(
        requests.map(request => executionManager.queueExecution(request))
      );

      // Wait for executions to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      const stats = await executionManager.getExecutionStatistics();

      expect(stats.totalExecutions).toBe(5);
      expect(stats.completedExecutions + stats.failedExecutions).toBe(5);
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeLessThanOrEqual(100);
      expect(stats.averageExecutionTime).toBeGreaterThan(0);
    });

    it('should calculate platform and framework breakdowns', async () => {
      const webRequest = createMockExecutionRequest({
        id: 'web-request',
        testSuite: createMockTestSuite({
          platform: 'web',
          framework: 'playwright'
        })
      });
      const mobileRequest = createMockExecutionRequest({
        id: 'mobile-request',
        testSuite: createMockTestSuite({
          platform: 'ios',
          framework: 'maestro'
        })
      });

      await executionManager.queueExecution(webRequest);
      await executionManager.queueExecution(mobileRequest);

      // Wait for executions to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      const stats = await executionManager.getExecutionStatistics();

      expect(stats.platformBreakdown.web).toBe(1);
      expect(stats.platformBreakdown.ios).toBe(1);
      expect(stats.frameworkBreakdown.playwright).toBe(1);
      expect(stats.frameworkBreakdown.maestro).toBe(1);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent execution requests', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        createMockExecutionRequest({
          id: `concurrent-${i}`,
          testSuite: createMockTestSuite({
            tests: [createMockTestCase(`test-${i}`)]
          })
        })
      );

      const startTime = Date.now();
      const executionIds = await Promise.all(
        concurrentRequests.map(request => executionManager.queueExecution(request))
      );

      // Wait for all executions to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      const endTime = Date.now();

      expect(executionIds.length).toBe(10);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete concurrently
    });

    it('should respect concurrency limits', async () => {
      const request = createMockExecutionRequest({
        executionConfig: {
          ...createMockExecutionConfig(),
          parallelExecution: true,
          maxConcurrency: 2
        },
        testSuite: createMockTestSuite({
          tests: Array.from({ length: 6 }, (_, i) => createMockTestCase(`test-${i}`))
        })
      });

      const executionId = await executionManager.queueExecution(request);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const execution = await executionManager.getExecutionStatus(executionId);
      expect(execution?.status).toBe('completed');
      expect(execution?.progress.completedTests).toBe(6);
    });

    it('should maintain performance under load', async () => {
      const largeRequest = createMockExecutionRequest({
        testSuite: createMockTestSuite({
          tests: Array.from({ length: 50 }, (_, i) => createMockTestCase(`test-${i}`))
        }),
        executionConfig: {
          ...createMockExecutionConfig(),
          parallelExecution: true,
          maxConcurrency: 5
        }
      });

      const startTime = Date.now();
      const executionId = await executionManager.queueExecution(largeRequest);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      const endTime = Date.now();

      const execution = await executionManager.getExecutionStatus(executionId);
      expect(execution?.status).toBe('completed');
      expect(execution?.progress.completedTests).toBe(50);

      // Performance should be reasonable
      const averageTimePerTest = (endTime - startTime) / 50;
      expect(averageTimePerTest).toBeLessThan(50); // Less than 50ms per test
    });
  });

  describe('Event System', () => {
    it('should emit execution lifecycle events', async () => {
      const events: any[] = [];

      executionManager.on('execution_queued', (data) => events.push({ type: 'queued', ...data }));
      executionManager.on('execution_started', (data) => events.push({ type: 'started', ...data }));
      executionManager.on('execution_completed', (data) => events.push({ type: 'completed', ...data }));

      const request = createMockExecutionRequest();
      const executionId = await executionManager.queueExecution(request);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events.some(e => e.type === 'queued')).toBe(true);
      expect(events.some(e => e.type === 'started')).toBe(true);
      expect(events.some(e => e.type === 'completed')).toBe(true);
    });

    it('should emit test completion events', async () => {
      const testEvents: any[] = [];

      executionManager.on('test_completed', (data) => testEvents.push(data));

      const request = createMockExecutionRequest({
        testSuite: createMockTestSuite({
          tests: Array.from({ length: 3 }, (_, i) => createMockTestCase(`test-${i}`))
        })
      });

      const executionId = await executionManager.queueExecution(request);

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(testEvents.length).toBe(3);
      testEvents.forEach((event, index) => {
        expect(event.testId).toBe(`test-${index}`);
        expect(event.result).toBeDefined();
      });
    });
  });
});

// Helper functions to create mock objects
function createMockExecutionRequest(overrides: Partial<TestExecutionRequest> = {}): TestExecutionRequest {
  return {
    id: `request-${Math.random().toString(36).substr(2, 9)}`,
    userId: 'user-123',
    projectId: 'project-456',
    testSuite: createMockTestSuite(),
    executionConfig: createMockExecutionConfig(),
    requestedAt: new Date(),
    priority: 'medium',
    ...overrides
  };
}

function createMockTestSuite(overrides: Partial<TestSuite> = {}): TestSuite {
  return {
    id: `suite-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Suite',
    description: 'Test suite for execution',
    tests: [
      createMockTestCase('test-1'),
      createMockTestCase('test-2')
    ],
    setup: [],
    teardown: [],
    dependencies: [],
    metadata: {
      framework: 'playwright',
      platform: 'web',
      estimatedDuration: 5000,
      retryCount: 1,
      timeout: 30000
    },
    ...overrides
  };
}

function createMockTestCase(name: string, overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: `test-${Math.random().toString(36).substr(2, 9)}`,
    name,
    description: `Test case ${name}`,
    type: 'ui',
    platform: 'web',
    framework: 'playwright',
    content: `test content for ${name}`,
    parameters: {},
    assertions: [
      {
        id: 'assert-1',
        type: 'exists',
        target: '#element',
        expected: true
      }
    ],
    setup: [],
    teardown: [],
    metadata: {
      estimatedDuration: 1000,
      priority: 'medium',
      tags: ['smoke', 'regression'],
      retryCount: 1,
      timeout: 10000,
      flaky: false,
      dependencies: [],
      willFail: overrides.willFail || false
    },
    ...overrides
  };
}

function createMockExecutionConfig(): any {
  return {
    parallelExecution: false,
    maxConcurrency: 1,
    retryStrategy: {
      enabled: true,
      maxRetries: 2,
      retryDelay: 1000,
      exponentialBackoff: true,
      retryOnFailureTypes: ['timeout', 'assertion_failure']
    },
    timeoutStrategy: {
      defaultTimeout: 30000,
      perTestTimeout: 10000,
      suiteTimeout: 60000,
      escalateOnTimeout: true
    },
    reportingStrategy: {
      realTimeUpdates: true,
      includeScreenshots: true,
      includeVideos: false,
      includeLogs: true,
      includePerformanceMetrics: true,
      reportFormats: ['json']
    },
    environmentConfig: {
      variables: { ENV: 'test' },
      testData: { user: 'testuser' },
      mockServices: [],
      externalDependencies: []
    },
    resourceAllocation: {
      devices: [],
      containers: [],
      memory: 512,
      cpu: 1,
      storage: 1024
    }
  };
}
