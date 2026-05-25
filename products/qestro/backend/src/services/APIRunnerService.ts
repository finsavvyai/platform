'use strict';

import { TestCase, TestResult } from './TestExecutionEngine';
import { APIRequestExecutor } from './api/APIRequestExecutor';
import { APIAssertionValidator } from './api/APIAssertionValidator';
import { APIEnvironmentSubstitutor } from './api/APIEnvironmentSubstitutor';

/**
 * API Test Runner Service
 * Executes REST/GraphQL tests with native fetch
 */

interface ITestRunner {
  execute(testCase: TestCase): Promise<TestResult>;
  validateEnvironment(): Promise<void>;
  captureScreenshot?(name: string): Promise<Buffer>;
}

interface RunnerConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

class APIRunnerService implements ITestRunner {
  private config: RunnerConfig;
  private logs: string[] = [];
  private metrics: { responseTimes: number[]; requestCount: number } = {
    responseTimes: [],
    requestCount: 0,
  };
  private requestExecutor: APIRequestExecutor;
  private assertionValidator: APIAssertionValidator;
  private envSubstitutor: APIEnvironmentSubstitutor;

  constructor(config: RunnerConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 2,
      retryDelay: config.retryDelay ?? 1000,
    };
    this.requestExecutor = new APIRequestExecutor(this.config);
    this.assertionValidator = new APIAssertionValidator();
    this.envSubstitutor = new APIEnvironmentSubstitutor();
  }

  /**
   * Validate API environment (network connectivity)
   */
  async validateEnvironment(): Promise<void> {
    try {
      const response = await Promise.race([
        fetch('https://api.github.com'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('API connectivity timeout')), 5000)
        ),
      ]);

      if (!(response instanceof Response)) {
        throw new Error('Invalid response object');
      }
    } catch (error) {
      throw new Error(`API environment validation failed: ${error}`);
    }
  }

  /**
   * Execute an API test case
   */
  async execute(testCase: TestCase): Promise<TestResult> {
    const startTime = new Date();
    this.logs = [];
    this.metrics = { responseTimes: [], requestCount: 0 };

    try {
      const testSteps = JSON.parse(testCase.code);
      const timeout = testCase.timeout || this.config.timeout;

      const responses: any[] = [];

      for (let i = 0; i < testSteps.length; i++) {
        const step = testSteps[i];

        try {
          if (step.type === 'request') {
            const response = await this.executeRequest(step, timeout);
            responses.push(response);
            this.logs.push(`[STEP ${i}] ${step.method || 'GET'} ${step.url} -> ${response.status}`);
          } else if (step.type === 'graphql') {
            const response = await this.executeGraphQL(step, timeout);
            responses.push(response);
            this.logs.push(`[STEP ${i}] GraphQL -> Success`);
          } else if (step.type === 'assertions') {
            await this.assertionValidator.validate(step.assertions, responses);
            this.logs.push(`[STEP ${i}] Assertions passed`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.logs.push(`[STEP ${i}] Error: ${errorMsg}`);
          throw error;
        }
      }

      const endTime = new Date();

      return {
        testId: testCase.id,
        status: 'passed',
        duration: endTime.getTime() - startTime.getTime(),
        startTime,
        endTime,
        logs: this.logs,
        metrics: {
          memory: process.memoryUsage().heapUsed,
          cpu: process.cpuUsage().user,
          network: this.metrics.requestCount,
        },
      };
    } catch (error: unknown) {
      const endTime = new Date();
      const errorMsg = error instanceof Error ? error.message : String(error);
      const stackTrace = error instanceof Error ? error.stack : undefined;

      return {
        testId: testCase.id,
        status: 'failed',
        duration: endTime.getTime() - startTime.getTime(),
        startTime,
        endTime,
        error: errorMsg,
        stackTrace,
        logs: this.logs,
        metrics: {
          memory: process.memoryUsage().heapUsed,
          cpu: process.cpuUsage().user,
          network: this.metrics.requestCount,
        },
      };
    }
  }

  /**
   * Execute HTTP request
   */
  private async executeRequest(step: any, timeout: number): Promise<any> {
    const url = this.envSubstitutor.substitute(step.url);
    const headers = this.envSubstitutor.substitute(step.headers || {});
    const body = step.body ? this.envSubstitutor.substitute(step.body) : undefined;

    const response = await this.requestExecutor.execute({
      method: step.method || 'GET',
      url,
      headers,
      body,
      auth: step.auth,
      timeout,
    });

    this.metrics.responseTimes.push(response.responseTime);
    this.metrics.requestCount++;

    return response;
  }

  /**
   * Execute GraphQL query/mutation
   */
  private async executeGraphQL(step: any, timeout: number): Promise<any> {
    const url = this.envSubstitutor.substitute(step.url);
    const query = this.envSubstitutor.substitute(step.query);
    const variables = step.variables
      ? this.envSubstitutor.substitute(step.variables)
      : undefined;

    return this.requestExecutor.executeGraphQL({
      url,
      query,
      variables,
      auth: step.auth,
      headers: step.headers,
      timeout,
    });
  }

  async captureScreenshot(): Promise<Buffer> {
    return Buffer.from('API runner does not capture screenshots');
  }
}

// Singleton instance
let instance: APIRunnerService;

/**
 * Get or create singleton instance
 */
export function getAPIRunner(config?: RunnerConfig): APIRunnerService {
  if (!instance) {
    instance = new APIRunnerService(config);
  }
  return instance;
}

export { APIRunnerService, ITestRunner, RunnerConfig };
export default getAPIRunner();
