/**
 * MCP Tool: Heal failed tests
 * Triggers self-healing for failed tests and returns suggested fixes
 */

import { z } from 'zod';
import { apiPost } from '../utils/api-client.js';
import { HealTestInput, HealTestResult } from '../types.js';

const HealTestInputSchema = z.object({
  testId: z.string().min(1),
  failureId: z.string().optional(),
});

/**
 * Trigger self-healing for a failed test
 * @param input - Test ID and optional failure ID
 * @returns Healed test code and suggestions
 */
export async function healTest(input: HealTestInput): Promise<HealTestResult> {
  const validation = HealTestInputSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      testId: input.testId,
      error: `Invalid input: ${validation.error.message}`,
    };
  }

  const testId = validation.data.testId;

  try {
    const response = await apiPost<{
      healed: boolean;
      suggestedFix: string;
      code: string;
    }>('/tests/heal', {
      testId,
      failureId: validation.data.failureId,
    });

    if (!response.success) {
      return {
        success: false,
        testId,
        error: response.error || 'Failed to heal test',
      };
    }

    return {
      success: true,
      testId,
      healed: response.data?.healed || false,
      suggestedFix: response.data?.suggestedFix,
      code: response.data?.code,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      testId,
      error: `API request failed: ${message}`,
    };
  }
}

/**
 * Tool handler for MCP
 */
export const healTestTool = {
  name: 'qestro_heal_test',
  description:
    'Auto-heal a failed test using AI analysis. Returns suggested fixes for selectors, timing, and assertions.',
  inputSchema: {
    type: 'object',
    properties: {
      testId: {
        type: 'string',
        description: 'ID of the test to heal',
      },
      failureId: {
        type: 'string',
        description: 'Optional ID of specific failure to analyze',
      },
    },
    required: ['testId'],
  },
};
