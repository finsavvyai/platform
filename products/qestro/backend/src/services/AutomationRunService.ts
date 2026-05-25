import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { WebSocket } from 'ws';

export interface TestRun {
  id: string;
  name: string;
  testPlanId?: string;
  projectId: string;
  userId: string;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'cancelled' | 'paused';
  environment: 'dev' | 'staging' | 'prod';
  startTime: number;
  endTime?: number;
  duration?: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  retriedTests: number;
  config: TestRunConfig;
  results: TestResult[];
  artifacts: {
    screenshots: string[];
    videos: string[];
    logs: string[];
    reports: string[];
  };
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface TestRunConfig {
  parallel: boolean;
  maxParallelTests?: number;
  retryFailedTests?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  captureScreenshots?: boolean;
  captureVideo?: boolean;
  captureLogs?: boolean;
  environment: string;
  environmentVariables?: Record<string, string>;
  browsers?: string[];
  devices?: string[];
  cloudProvider?: string;
}

export interface TestResult {
  id: string;
  runId: string;
  testCaseId: string;
  testCaseName: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  startTime: number;
  endTime?: number;
  duration?: number;
  retries: number;
  error?: {
    message: string;
    stack?: string;
    screenshot?: string;
  };
  steps: TestStepResult[];
  artifacts: {
    screenshots: string[];
    video?: string;
    logs: string[];
  };
  metadata: Record<string, any>;
}

export interface TestStepResult {
  id: string;
  stepNumber: number;
  action: string;
  status: 'passed' | 'failed' | 'skipped';
  startTime: number;
  endTime?: number;
  duration?: number;
  error?: string;
  screenshot?: string;
  metadata?: Record<string, any>;
}

export class AutomationRunService extends EventEmitter {
  private activeRuns = new Map<string, TestRun>();
  private runQueue: string[] = [];
  private isProcessingQueue = false;
  private maxConcurrentRuns = 5;
  private wsConnections = new Map<string, Set<WebSocket>>();

  constructor() {
    super();
    this.startQueueProcessor();
  }

  /**
   * Create and queue a new test run
   */
  async createRun(config: {
    name: string;
    testPlanId?: string;
    projectId: string;
    userId: string;
    testCases: any[];
    config: TestRunConfig;
    metadata?: Record<string, any>;
  }): Promise<TestRun> {
    const runId = uuidv4();
    const now = Date.now();

    const run: TestRun = {
      id: runId,
      name: config.name,
      testPlanId: config.testPlanId,
      projectId: config.projectId,
      userId: config.userId,
      status: 'queued',
      environment: config.config.environment as any,
      startTime: now,
      totalTests: config.testCases.length,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      retriedTests: 0,
      config: config.config,
      results: [],
      artifacts: {
        screenshots: [],
        videos: [],
        logs: [],
        reports: []
      },
      metadata: config.metadata || {},
      createdAt: now,
      updatedAt: now
    };

    this.activeRuns.set(runId, run);
    this.runQueue.push(runId);

    logger.info(`Test run ${runId} created and queued`);
    this.emit('run:created', run);
    this.broadcastRunUpdate(run);

    return run;
  }

  /**
   * Start executing a test run
   */
  async startRun(runId: string): Promise<TestRun> {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Test run ${runId} not found`);
    }

    if (run.status !== 'queued' && run.status !== 'paused') {
      throw new Error(`Test run ${runId} cannot be started from status ${run.status}`);
    }

    run.status = 'running';
    run.startTime = Date.now();
    run.updatedAt = Date.now();

    this.activeRuns.set(runId, run);

    logger.info(`Test run ${runId} started`);
    this.emit('run:started', run);
    this.broadcastRunUpdate(run);

    // Execute tests in background
    this.executeRun(runId).catch(error => {
      logger.error(`Error executing run ${runId}:`, error);
      this.failRun(runId, error.message);
    });

    return run;
  }

  /**
   * Execute a test run with parallel or sequential execution
   */
  private async executeRun(runId: string): Promise<void> {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    try {
      // Get test cases from database or config
      // For now, we'll simulate test execution
      const testCases = this.getTestCasesForRun(run);

      if (run.config.parallel) {
        await this.executeParallel(run, testCases);
      } else {
        await this.executeSequential(run, testCases);
      }

      // Mark run as completed
      this.completeRun(runId);
    } catch (error: any) {
      logger.error(`Error in run execution ${runId}:`, error);
      this.failRun(runId, error.message);
    }
  }

  /**
   * Execute tests in parallel
   */
  private async executeParallel(run: TestRun, testCases: any[]): Promise<void> {
    const maxParallel = run.config.maxParallelTests || 3;
    const batches: any[][] = [];

    // Split test cases into batches
    for (let i = 0; i < testCases.length; i += maxParallel) {
      batches.push(testCases.slice(i, i + maxParallel));
    }

    // Execute batches
    for (const batch of batches) {
      const promises = batch.map(testCase => this.executeTestCase(run, testCase));
      await Promise.allSettled(promises);
    }
  }

  /**
   * Execute tests sequentially
   */
  private async executeSequential(run: TestRun, testCases: any[]): Promise<void> {
    for (const testCase of testCases) {
      await this.executeTestCase(run, testCase);
    }
  }

  /**
   * Execute a single test case
   */
  private async executeTestCase(run: TestRun, testCase: any): Promise<TestResult> {
    const resultId = uuidv4();
    const startTime = Date.now();

    const result: TestResult = {
      id: resultId,
      runId: run.id,
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      status: 'pending',
      startTime,
      retries: 0,
      steps: [],
      artifacts: {
        screenshots: [],
        logs: []
      },
      metadata: {}
    };

    try {
      // Simulate test execution
      logger.info(`Executing test case ${testCase.name} in run ${run.id}`);

      // Execute test steps
      const steps = testCase.steps || [];
      for (const [index, step] of steps.entries()) {
        const stepResult = await this.executeTestStep(run, step, index + 1);
        result.steps.push(stepResult);

        if (stepResult.status === 'failed' && !run.config.retryFailedTests) {
          throw new Error(`Step ${stepResult.stepNumber} failed: ${stepResult.error}`);
        }
      }

      // Mark as passed
      result.status = 'passed';
      result.endTime = Date.now();
      result.duration = result.endTime - result.startTime;

      run.passedTests++;
    } catch (error: any) {
      // Retry logic
      if (run.config.retryFailedTests && result.retries < (run.config.maxRetries || 2)) {
        result.retries++;
        run.retriedTests++;

        logger.info(`Retrying test case ${testCase.name} (attempt ${result.retries + 1})`);

        // Wait before retry
        if (run.config.retryDelay) {
          await this.delay(run.config.retryDelay);
        }

        return this.executeTestCase(run, testCase);
      }

      // Mark as failed
      result.status = 'failed';
      result.endTime = Date.now();
      result.duration = result.endTime - result.startTime;
      result.error = {
        message: error.message,
        stack: error.stack
      };

      run.failedTests++;
    }

    // Add result to run
    run.results.push(result);
    run.updatedAt = Date.now();
    this.activeRuns.set(run.id, run);

    // Emit events
    this.emit('test:completed', { run, result });
    this.broadcastRunUpdate(run);

    return result;
  }

  /**
   * Execute a single test step
   */
  private async executeTestStep(
    run: TestRun,
    step: any,
    stepNumber: number
  ): Promise<TestStepResult> {
    const startTime = Date.now();

    try {
      // Simulate step execution
      await this.delay(Math.random() * 500 + 200);

      // Randomly fail some steps for testing
      const shouldFail = Math.random() < 0.1; // 10% failure rate

      if (shouldFail) {
        throw new Error('Simulated step failure');
      }

      return {
        id: uuidv4(),
        stepNumber,
        action: step.action || 'unknown',
        status: 'passed',
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        id: uuidv4(),
        stepNumber,
        action: step.action || 'unknown',
        status: 'failed',
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Complete a test run
   */
  private completeRun(runId: string): void {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    run.status = run.failedTests > 0 ? 'failed' : 'passed';
    run.endTime = Date.now();
    run.duration = run.endTime - run.startTime;
    run.updatedAt = Date.now();

    this.activeRuns.set(runId, run);

    logger.info(`Test run ${runId} completed: ${run.status}`);
    this.emit('run:completed', run);
    this.broadcastRunUpdate(run);
  }

  /**
   * Fail a test run
   */
  private failRun(runId: string, error: string): void {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    run.status = 'failed';
    run.endTime = Date.now();
    run.duration = run.endTime - run.startTime;
    run.updatedAt = Date.now();
    run.metadata.error = error;

    this.activeRuns.set(runId, run);

    logger.error(`Test run ${runId} failed: ${error}`);
    this.emit('run:failed', run);
    this.broadcastRunUpdate(run);
  }

  /**
   * Pause a running test run
   */
  async pauseRun(runId: string): Promise<TestRun> {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Test run ${runId} not found`);
    }

    if (run.status !== 'running') {
      throw new Error(`Test run ${runId} is not running`);
    }

    run.status = 'paused';
    run.updatedAt = Date.now();

    this.activeRuns.set(runId, run);

    logger.info(`Test run ${runId} paused`);
    this.emit('run:paused', run);
    this.broadcastRunUpdate(run);

    return run;
  }

  /**
   * Cancel a test run
   */
  async cancelRun(runId: string): Promise<TestRun> {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Test run ${runId} not found`);
    }

    run.status = 'cancelled';
    run.endTime = Date.now();
    run.duration = run.endTime - run.startTime;
    run.updatedAt = Date.now();

    this.activeRuns.set(runId, run);

    logger.info(`Test run ${runId} cancelled`);
    this.emit('run:cancelled', run);
    this.broadcastRunUpdate(run);

    return run;
  }

  /**
   * Get a test run by ID
   */
  getRun(runId: string): TestRun | null {
    return this.activeRuns.get(runId) || null;
  }

  /**
   * Get all active runs
   */
  getActiveRuns(): TestRun[] {
    return Array.from(this.activeRuns.values())
      .filter(run => ['running', 'queued', 'paused'].includes(run.status));
  }

  /**
   * Get all runs
   */
  getAllRuns(): TestRun[] {
    return Array.from(this.activeRuns.values());
  }

  /**
   * Get runs by project
   */
  getRunsByProject(projectId: string): TestRun[] {
    return Array.from(this.activeRuns.values())
      .filter(run => run.projectId === projectId);
  }

  /**
   * Get runs by user
   */
  getRunsByUser(userId: string): TestRun[] {
    return Array.from(this.activeRuns.values())
      .filter(run => run.userId === userId);
  }

  /**
   * Get test result by ID
   */
  getTestResult(runId: string, resultId: string): TestResult | null {
    const run = this.activeRuns.get(runId);
    if (!run) return null;

    return run.results.find(r => r.id === resultId) || null;
  }

  /**
   * Register WebSocket connection for real-time updates
   */
  registerWebSocket(runId: string, ws: WebSocket): void {
    if (!this.wsConnections.has(runId)) {
      this.wsConnections.set(runId, new Set());
    }
    this.wsConnections.get(runId)!.add(ws);

    // Send initial state
    const run = this.activeRuns.get(runId);
    if (run) {
      ws.send(JSON.stringify({
        type: 'run:update',
        data: run
      }));
    }

    // Clean up on close
    ws.on('close', () => {
      const connections = this.wsConnections.get(runId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          this.wsConnections.delete(runId);
        }
      }
    });
  }

  /**
   * Broadcast run update to all connected WebSocket clients
   */
  private broadcastRunUpdate(run: TestRun): void {
    const connections = this.wsConnections.get(run.id);
    if (!connections) return;

    const message = JSON.stringify({
      type: 'run:update',
      data: run
    });

    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  /**
   * Start queue processor for managing concurrent runs
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      if (this.isProcessingQueue) return;

      this.processQueue();
    }, 1000);
  }

  /**
   * Process queued runs
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;

    try {
      const runningCount = this.getActiveRuns().filter(r => r.status === 'running').length;
      const availableSlots = this.maxConcurrentRuns - runningCount;

      if (availableSlots > 0 && this.runQueue.length > 0) {
        const toStart = this.runQueue.splice(0, availableSlots);

        for (const runId of toStart) {
          const run = this.activeRuns.get(runId);
          if (run && run.status === 'queued') {
            await this.startRun(runId);
          }
        }
      }
    } catch (error) {
      logger.error('Error processing run queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Get test cases for a run (placeholder - would fetch from database)
   */
  private getTestCasesForRun(run: TestRun): any[] {
    // This would normally fetch from database
    // For now, return mock data
    return [
      { id: '1', name: 'Test Case 1', steps: [{ action: 'click' }, { action: 'input' }] },
      { id: '2', name: 'Test Case 2', steps: [{ action: 'navigate' }, { action: 'assert' }] },
      { id: '3', name: 'Test Case 3', steps: [{ action: 'scroll' }, { action: 'click' }] }
    ];
  }

  /**
   * Utility: Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Export run results
   */
  exportRun(runId: string, format: 'json' | 'html' | 'xml' = 'json'): any {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Test run ${runId} not found`);
    }

    switch (format) {
      case 'json':
        return JSON.stringify(run, null, 2);
      case 'html':
        return this.generateHTMLReport(run);
      case 'xml':
        return this.generateXMLReport(run);
      default:
        return run;
    }
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(run: TestRun): string {
    const passRate = run.totalTests > 0
      ? Math.round((run.passedTests / run.totalTests) * 100)
      : 0;

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Test Run Report - ${run.name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: #1a1a1a; color: white; padding: 20px; border-radius: 8px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .card { background: #f5f5f5; padding: 15px; border-radius: 8px; }
    .passed { color: #22c55e; }
    .failed { color: #ef4444; }
    .test-result { margin: 10px 0; padding: 10px; border-left: 3px solid #ccc; }
    .test-result.passed { border-color: #22c55e; }
    .test-result.failed { border-color: #ef4444; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Test Run Report</h1>
    <h2>${run.name}</h2>
    <p>Status: ${run.status} | Environment: ${run.environment}</p>
    <p>Duration: ${run.duration ? (run.duration / 1000).toFixed(2) : 'N/A'}s | Pass Rate: ${passRate}%</p>
  </div>

  <div class="summary">
    <div class="card">
      <h3>Total Tests</h3>
      <p style="font-size: 2em;">${run.totalTests}</p>
    </div>
    <div class="card">
      <h3 class="passed">Passed</h3>
      <p style="font-size: 2em;">${run.passedTests}</p>
    </div>
    <div class="card">
      <h3 class="failed">Failed</h3>
      <p style="font-size: 2em;">${run.failedTests}</p>
    </div>
    <div class="card">
      <h3>Retried</h3>
      <p style="font-size: 2em;">${run.retriedTests}</p>
    </div>
  </div>

  <h2>Test Results</h2>
  ${run.results.map(result => `
    <div class="test-result ${result.status}">
      <h3>${result.testCaseName}</h3>
      <p>Status: ${result.status} | Duration: ${result.duration ? (result.duration / 1000).toFixed(2) : 'N/A'}s</p>
      ${result.error ? `<p style="color: red;">Error: ${result.error.message}</p>` : ''}
      <p>Steps: ${result.steps.length} (${result.steps.filter(s => s.status === 'passed').length} passed, ${result.steps.filter(s => s.status === 'failed').length} failed)</p>
    </div>
  `).join('')}
</body>
</html>
    `;
  }

  /**
   * Generate XML report (JUnit format)
   */
  private generateXMLReport(run: TestRun): string {
    const duration = run.duration ? (run.duration / 1000).toFixed(3) : '0';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuites name="${run.name}" tests="${run.totalTests}" failures="${run.failedTests}" time="${duration}">\n`;
    xml += `  <testsuite name="${run.name}" tests="${run.totalTests}" failures="${run.failedTests}" time="${duration}">\n`;

    for (const result of run.results) {
      const resultDuration = result.duration ? (result.duration / 1000).toFixed(3) : '0';
      xml += `    <testcase name="${result.testCaseName}" time="${resultDuration}">\n`;

      if (result.status === 'failed' && result.error) {
        xml += `      <failure message="${result.error.message}">\n`;
        xml += `        ${result.error.stack || ''}\n`;
        xml += `      </failure>\n`;
      }

      xml += `    </testcase>\n`;
    }

    xml += `  </testsuite>\n`;
    xml += `</testsuites>\n`;

    return xml;
  }

  /**
   * Clean up completed runs
   */
  cleanupOldRuns(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [runId, run] of this.activeRuns) {
      if (run.status === 'passed' || run.status === 'failed' || run.status === 'cancelled') {
        if (now - run.updatedAt > maxAge) {
          toDelete.push(runId);
        }
      }
    }

    for (const runId of toDelete) {
      this.activeRuns.delete(runId);
      this.wsConnections.delete(runId);
      logger.info(`Cleaned up old run ${runId}`);
    }

    logger.info(`Cleaned up ${toDelete.length} old runs`);
  }
}

export const automationRunService = new AutomationRunService();
