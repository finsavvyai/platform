/**
 * MCP Tool: Run tests
 * Triggers test execution via Qestro API and returns results
 */

import { z } from 'zod';
import { apiPost, apiGet } from '../utils/api-client.js';
import { RunTestsInput, TestRunResult } from '../types.js';

const RunTestsInputSchema = z.object({
  testId: z.string().optional(),
  projectId: z.string().optional(),
  environment: z.string().optional(),
});

/**
 * Run tests and get execution results
 * @param input - Test execution parameters
 * @returns Test run status and results
 */
export async function runTests(input: RunTestsInput): Promise<TestRunResult> {
  const validation = RunTestsInputSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      error: `Invalid input: ${validation.error.message}`,
    };
  }

  if (!validation.data.testId && !validation.data.projectId) {
    return {
      success: false,
      error: 'Either testId or projectId must be provided',
    };
  }

  try {
    // Trigger test execution
    const runResponse = await apiPost<{ runId: string }>(
      '/tests/run',
      {
        testId: validation.data.testId,
        projectId: validation.data.projectId,
        environment: validation.data.environment || 'staging',
      },
    );

    if (!runResponse.success) {
      return {
        success: false,
        error: runResponse.error || 'Failed to start test run',
      };
    }

    const runId = runResponse.data?.runId;
    if (!runId) {
      return {
        success: false,
        error: 'No run ID returned from API',
      };
    }

    // Poll for results (with timeout)
    const results = await pollTestResults(runId, 30000); // 30 second timeout

    return {
      success: true,
      runId,
      ...results,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `API request failed: ${message}`,
    };
  }
}

/**
 * Poll for test results until completion or timeout
 */
async function pollTestResults(
  runId: string,
  timeoutMs: number,
): Promise<Omit<TestRunResult, 'success' | 'error' | 'timestamp'>> {
  const startTime = Date.now();
  const pollInterval = 1000; // 1 second

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await apiGet<{
        status: string;
        passedTests: number;
        failedTests: number;
        totalTests: number;
        duration: number;
      }>(`/tests/runs/${runId}`);

      if (response.success && response.data) {
        const status = response.data.status as 'passed' | 'failed' | 'running';

        if (status !== 'running') {
          return {
            runId,
            status,
            passedTests: response.data.passedTests,
            failedTests: response.data.failedTests,
            totalTests: response.data.totalTests,
            duration: response.data.duration,
          };
        }
      }
    } catch {
      // Continue polling on error
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  // Return running status if timeout
  return {
    runId,
    status: 'running',
  };
}

/**
 * Tool handler for MCP
 */
export const runTestsTool = {
  name: 'qestro_run_tests',
  description:
    'Execute tests and get results. Can run a specific test or all tests in a project.',
  inputSchema: {
    type: 'object',
    properties: {
      testId: {
        type: 'string',
        description: 'ID of specific test to run',
      },
      projectId: {
        type: 'string',
        description: 'ID of project (runs all tests in project)',
      },
      environment: {
        type: 'string',
        description: 'Environment to run tests against (default: staging)',
      },
    },
  },
};
