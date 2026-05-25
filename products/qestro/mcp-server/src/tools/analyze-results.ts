/**
 * MCP Tool: Analyze test results
 * Gets detailed failure analysis and self-healing suggestions
 */

import { z } from 'zod';
import { apiGet } from '../utils/api-client.js';
import { AnalyzeResultsInput, AnalysisResult } from '../types.js';

const AnalyzeResultsInputSchema = z.object({
  runId: z.string().min(1),
});

/**
 * Analyze test results and get failure details
 * @param input - Run ID to analyze
 * @returns Detailed analysis with healing suggestions
 */
export async function analyzeResults(
  input: AnalyzeResultsInput,
): Promise<AnalysisResult> {
  const validation = AnalyzeResultsInputSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      runId: input.runId,
      error: `Invalid input: ${validation.error.message}`,
    };
  }

  const runId = validation.data.runId;

  try {
    const response = await apiGet<{
      summary: string;
      failureCount: number;
      failures: Array<{
        testName: string;
        error: string;
        healingSuggestion?: string;
      }>;
      overallHealth: string;
    }>(`/tests/runs/${runId}/analysis`);

    if (!response.success) {
      return {
        success: false,
        runId,
        error: response.error || 'Failed to analyze results',
      };
    }

    return {
      success: true,
      runId,
      summary: response.data?.summary,
      failureCount: response.data?.failureCount || 0,
      failures: response.data?.failures || [],
      overallHealth: (response.data?.overallHealth as
        | 'healthy'
        | 'degraded'
        | 'critical') || 'healthy',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      runId,
      error: `API request failed: ${message}`,
    };
  }
}

/**
 * Tool handler for MCP
 */
export const analyzeResultsTool = {
  name: 'qestro_analyze_results',
  description:
    'Analyze test results from a run. Returns failure details, root cause analysis, and self-healing suggestions.',
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'ID of the test run to analyze',
      },
    },
    required: ['runId'],
  },
};
