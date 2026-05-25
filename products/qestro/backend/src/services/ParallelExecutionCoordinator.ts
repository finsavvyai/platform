/**
 * Parallel Execution Coordinator - Phase 8
 * Manages parallel test execution across multiple workers
 */

import { EventEmitter } from 'events';
import { TestCase, TestResult, ExecutionConfig } from './TestExecutionEngine.js';
import TestExecutionEngine from './TestExecutionEngine.js';

export interface WorkerPool {
  id: string;
  engine: TestExecutionEngine;
  busy: boolean;
  currentTest?: string;
}

export interface ExecutionStrategy {
  type: 'parallel' | 'sequential' | 'smart';
  maxWorkers?: number;
  groupBy?: 'type' | 'priority' | 'none';
  retryStrategy?: 'immediate' | 'delayed' | 'exponential';
}

export class ParallelExecutionCoordinator extends EventEmitter {
  private workers: Map<string, WorkerPool> = new Map();
  private testQueue: TestCase[] = [];
  private completedTests: Map<string, TestResult> = new Map();
  private failedTests: Map<string, TestCase> = new Map();
  private maxWorkers: number;
  private strategy: ExecutionStrategy;

  constructor(strategy?: ExecutionStrategy) {
    super();
    this.strategy = strategy || { type: 'parallel', maxWorkers: 4 };
    this.maxWorkers = strategy?.maxWorkers || 4;
    this.initializeWorkers();
  }

  /**
   * Initialize worker pool
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.maxWorkers; i++) {
      const workerId = `worker-${i}`;
      const engine = new TestExecutionEngine();

      // Listen to engine events
      engine.on('test:start', (data) => {
        this.emit('worker:test:start', { workerId, ...data });
      });

      engine.on('test:complete', (result) => {
        this.handleTestComplete(workerId, result);
      });

      engine.on('test:error', (result) => {
        this.handleTestError(workerId, result);
      });

      this.workers.set(workerId, {
        id: workerId,
        engine,
        busy: false
      });
    }
  }

  /**
   * Execute test suite with parallel coordination
   */
  async executeTestSuite(
    testCases: TestCase[],
    config?: ExecutionConfig
  ): Promise<Map<string, TestResult>> {
    this.testQueue = this.organizeTests(testCases);
    this.completedTests.clear();
    this.failedTests.clear();

    this.emit('coordinator:start', {
      totalTests: testCases.length,
      workers: this.maxWorkers,
      strategy: this.strategy.type
    });

    // Start distributing tests to workers
    await this.distributeTests(config);

    // Wait for all tests to complete
    await this.waitForCompletion();

    // Handle retries if needed
    if (this.failedTests.size > 0 && config?.retries) {
      await this.retryFailedTests(config);
    }

    this.emit('coordinator:complete', {
      totalTests: testCases.length,
      completed: this.completedTests.size,
      failed: this.failedTests.size
    });

    return this.completedTests;
  }

  /**
   * Organize tests based on strategy
   */
  private organizeTests(testCases: TestCase[]): TestCase[] {
    const organized = [...testCases];

    switch (this.strategy.groupBy) {
      case 'type':
        // Group by test type
        organized.sort((a, b) => a.type.localeCompare(b.type));
        break;
      case 'priority':
        // Sort by priority
        organized.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        break;
      case 'none':
      default:
        // Keep original order
        break;
    }

    return organized;
  }

  /**
   * Distribute tests to available workers
   */
  private async distributeTests(config?: ExecutionConfig): Promise<void> {
    const distribution = new Map<string, TestCase[]>();

    // Distribute tests evenly across workers
    this.testQueue.forEach((test, index) => {
      const workerIndex = index % this.maxWorkers;
      const workerId = `worker-${workerIndex}`;
      
      if (!distribution.has(workerId)) {
        distribution.set(workerId, []);
      }
      distribution.get(workerId)!.push(test);
    });

    // Execute tests on each worker
    const executions: Promise<void>[] = [];

    for (const [workerId, tests] of distribution.entries()) {
      const worker = this.workers.get(workerId);
      if (worker) {
        worker.busy = true;
        const execution = this.executeOnWorker(worker, tests, config);
        executions.push(execution);
      }
    }

    await Promise.all(executions);
  }

  /**
   * Execute tests on a specific worker
   */
  private async executeOnWorker(
    worker: WorkerPool,
    tests: TestCase[],
    config?: ExecutionConfig
  ): Promise<void> {
    for (const test of tests) {
      if (config?.failFast && this.failedTests.size > 0) {
        break;
      }

      worker.currentTest = test.id;
      
      try {
        const result = await worker.engine.executeTest(test);
        
        if (result.status === 'passed') {
          this.completedTests.set(test.id, result);
        } else {
          this.failedTests.set(test.id, test);
        }
      } catch (error) {
        this.failedTests.set(test.id, test);
      }

      worker.currentTest = undefined;
    }

    worker.busy = false;
  }

  /**
   * Wait for all workers to complete
   */
  private async waitForCompletion(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const allIdle = Array.from(this.workers.values()).every(w => !w.busy);
        
        if (allIdle) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Retry failed tests
   */
  private async retryFailedTests(config: ExecutionConfig): Promise<void> {
    const maxRetries = config.retries || 3;
    const failedTestCases = Array.from(this.failedTests.values());

    this.emit('coordinator:retry', {
      failedTests: failedTestCases.length,
      maxRetries
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (this.failedTests.size === 0) break;

      const testsToRetry = Array.from(this.failedTests.values());
      this.failedTests.clear();

      // Apply retry delay based on strategy
      if (this.strategy.retryStrategy === 'delayed') {
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else if (this.strategy.retryStrategy === 'exponential') {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }

      await this.distributeTests(config);
    }
  }

  /**
   * Handle test completion
   */
  private handleTestComplete(workerId: string, result: TestResult): void {
    this.completedTests.set(result.testId, result);
    this.emit('coordinator:test:complete', { workerId, result });
  }

  /**
   * Handle test error
   */
  private handleTestError(workerId: string, result: TestResult): void {
    this.emit('coordinator:test:error', { workerId, result });
  }

  /**
   * Get execution statistics
   */
  getStatistics() {
    const workers = Array.from(this.workers.values());
    const busyWorkers = workers.filter(w => w.busy).length;
    const idleWorkers = workers.filter(w => !w.busy).length;

    const results = Array.from(this.completedTests.values());
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return {
      workers: {
        total: this.maxWorkers,
        busy: busyWorkers,
        idle: idleWorkers
      },
      tests: {
        total: this.testQueue.length + this.completedTests.size,
        completed: this.completedTests.size,
        passed,
        failed,
        pending: this.testQueue.length,
        passRate: results.length > 0 ? (passed / results.length) * 100 : 0
      },
      strategy: this.strategy
    };
  }

  /**
   * Cancel all executions
   */
  async cancelAll(): Promise<void> {
    this.testQueue = [];
    
    const cancellations = Array.from(this.workers.values()).map(worker =>
      worker.engine.cancelAll()
    );

    await Promise.all(cancellations);
    this.emit('coordinator:cancelled');
  }

  /**
   * Get worker status
   */
  getWorkerStatus(): any[] {
    return Array.from(this.workers.values()).map(worker => ({
      id: worker.id,
      busy: worker.busy,
      currentTest: worker.currentTest,
      statistics: worker.engine.getStatistics()
    }));
  }

  /**
   * Shutdown coordinator
   */
  async shutdown(): Promise<void> {
    await this.cancelAll();
    this.workers.clear();
    this.emit('coordinator:shutdown');
  }
}

export default ParallelExecutionCoordinator;
