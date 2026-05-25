/**
 * Mobile Test Execution Service
 * Handles execution of mobile tests using Maestro and device control
 */

import { MobileDevice, MobileTestConfig } from './mobile-device-service';

export interface MobileTestExecution {
  id: string;
  deviceId: string;
  projectId: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
  config: MobileTestConfig;
  startTime?: string;
  endTime?: string;
  duration?: number;
  results: MobileTestResults;
  logs: string[];
  screenshots: string[];
  error?: string;
}

export interface MobileTestResults {
  steps: TestStepResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    successRate: number;
  };
  performance: {
    cpuUsage: number;
    memoryUsage: number;
    networkStats: {
      bytesReceived: number;
      bytesSent: number;
    };
  };
}

export interface TestStepResult {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  screenshot?: string;
  error?: string;
  timestamp: string;
}

/**
 * Mobile Test Execution Service
 */
export class MobileTestExecutionService {
  constructor(private env: any) {}

  /**
   * Execute mobile test on device
   */
  async executeTest(config: MobileTestConfig, projectId: string): Promise<MobileTestExecution> {
    const execution: MobileTestExecution = {
      id: crypto.randomUUID(),
      deviceId: config.deviceId,
      projectId,
      status: 'pending',
      config,
      results: {
        steps: [],
        summary: {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          duration: 0,
          successRate: 0
        },
        performance: {
          cpuUsage: 0,
          memoryUsage: 0,
          networkStats: {
            bytesReceived: 0,
            bytesSent: 0
          }
        }
      },
      logs: [],
      screenshots: []
    };

    try {
      // Store execution in KV
      await this.env.TESTS.put(`execution:${execution.id}`, JSON.stringify(execution));

      // Queue for processing
      await this.queueExecution(execution);

      return execution;
    } catch (error) {
      console.error('Failed to execute mobile test:', error);
      throw new Error('Failed to execute mobile test');
    }
  }

  /**
   * Get test execution status and results
   */
  async getExecution(executionId: string): Promise<MobileTestExecution | null> {
    try {
      const executionData = await this.env.TESTS.get(`execution:${executionId}`);
      if (!executionData) return null;

      return JSON.parse(executionData) as MobileTestExecution;
    } catch (error) {
      console.error('Failed to get execution:', error);
      throw new Error('Failed to get test execution');
    }
  }

  /**
   * Update execution status and results
   */
  async updateExecution(executionId: string, updates: Partial<MobileTestExecution>): Promise<void> {
    try {
      const execution = await this.getExecution(executionId);
      if (!execution) throw new Error('Execution not found');

      const updatedExecution = { ...execution, ...updates };
      await this.env.TESTS.put(`execution:${executionId}`, JSON.stringify(updatedExecution));
    } catch (error) {
      console.error('Failed to update execution:', error);
      throw new Error('Failed to update test execution');
    }
  }

  /**
   * Queue test execution for processing
   */
  private async queueExecution(execution: MobileTestExecution): Promise<void> {
    try {
      // Store in queue KV
      await this.env.QUEUE.put(`queue:${execution.id}`, JSON.stringify(execution), {
        expirationTtl: 3600 // 1 hour
      });

      console.log(`Queued mobile test execution: ${execution.id}`);
    } catch (error) {
      console.error('Failed to queue execution:', error);
    }
  }

  /**
   * Get list of test executions for a project
   */
  async getProjectExecutions(projectId: string, limit: number = 50): Promise<MobileTestExecution[]> {
    try {
      const list = await this.env.TESTS.list({
        prefix: 'execution:',
        limit
      });

      const executions: MobileTestExecution[] = [];

      for (const key of list.keys) {
        const executionData = await this.env.TESTS.get(key.name);
        if (executionData) {
          const execution = JSON.parse(executionData) as MobileTestExecution;
          if (execution.projectId === projectId) {
            executions.push(execution);
          }
        }
      }

      return executions.sort((a, b) =>
        new Date(b.startTime || '').getTime() - new Date(a.startTime || '').getTime()
      );
    } catch (error) {
      console.error('Failed to get project executions:', error);
      throw new Error('Failed to get project executions');
    }
  }

  /**
   * Cancel test execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    try {
      await this.updateExecution(executionId, {
        status: 'cancelled',
        endTime: new Date().toISOString()
      });

      // Remove from queue if still pending
      await this.env.QUEUE.delete(`queue:${executionId}`);
    } catch (error) {
      console.error('Failed to cancel execution:', error);
      throw new Error('Failed to cancel test execution');
    }
  }

  /**
   * Generate test report
   */
  async generateReport(executionId: string): Promise<{
    execution: MobileTestExecution;
    summary: string;
    recommendations: string[];
  }> {
    try {
      const execution = await this.getExecution(executionId);
      if (!execution) throw new Error('Execution not found');

      const { results, config } = execution;
      const { summary } = results;

      // Generate summary text
      const summaryText = `
Mobile Test Execution Report
============================
Execution ID: ${execution.id}
Device: ${config.deviceId}
Project: ${execution.projectId}
Status: ${execution.status}
Duration: ${summary.duration}ms
Success Rate: ${summary.successRate}%

Results:
- Total Steps: ${summary.total}
- Passed: ${summary.passed}
- Failed: ${summary.failed}
- Skipped: ${summary.skipped}

Performance:
- CPU Usage: ${results.performance.cpuUsage}%
- Memory Usage: ${results.performance.memoryUsage}MB
- Network Received: ${results.performance.networkStats.bytesReceived} bytes
- Network Sent: ${results.performance.networkStats.bytesSent} bytes
      `.trim();

      // Generate recommendations
      const recommendations: string[] = [];

      if (summary.successRate < 100) {
        recommendations.push('Review failed test steps and fix identified issues');
      }

      if (results.performance.cpuUsage > 80) {
        recommendations.push('High CPU usage detected - consider optimizing test steps');
      }

      if (results.performance.memoryUsage > 500) {
        recommendations.push('High memory usage detected - check for memory leaks');
      }

      if (summary.duration > 60000) {
        recommendations.push('Test execution time is high - consider optimizing test flow');
      }

      return {
        execution,
        summary: summaryText,
        recommendations
      };
    } catch (error) {
      console.error('Failed to generate report:', error);
      throw new Error('Failed to generate test report');
    }
  }
}

export default MobileTestExecutionService;
