/**
 * MCP Tool: Generate tests via LLM
 * Calls Qestro API to generate Playwright/Cypress tests from URL or description
 */

import { z } from 'zod';
import { apiPost } from '../utils/api-client.js';
import { TestGenerationInput, TestGenerationResult } from '../types.js';

const GenerateTestsInputSchema = z.object({
  url: z.string().url().optional(),
  description: z.string().min(1).optional(),
  testType: z.enum(['e2e', 'api', 'visual']).optional(),
  framework: z.enum(['playwright', 'cypress']).optional(),
});

/**
 * Generate tests from URL or description
 * @param input - Test generation parameters
 * @returns Generated test code and metadata
 */
export async function generateTests(
  input: TestGenerationInput,
): Promise<TestGenerationResult> {
  // Validate input
  const validation = GenerateTestsInputSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      error: `Invalid input: ${validation.error.message}`,
    };
  }

  // Ensure at least URL or description is provided
  if (!validation.data.url && !validation.data.description) {
    return {
      success: false,
      error: 'Either url or description must be provided',
    };
  }

  try {
    const response = await apiPost<TestGenerationResult>(
      '/tests/generate',
      {
        url: validation.data.url,
        description: validation.data.description,
        testType: validation.data.testType || 'e2e',
        framework: validation.data.framework || 'playwright',
      },
    );

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to generate tests',
      };
    }

    return {
      success: true,
      testId: response.data?.testId,
      code: response.data?.code,
      language: response.data?.language || 'typescript',
      estimatedRuntime: response.data?.estimatedRuntime,
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
 * Tool handler for MCP
 */
export const generateTestsTool = {
  name: 'qestro_generate_tests',
  description:
    'Generate test code from a URL or description using AI. Supports Playwright and Cypress.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL of the application or API endpoint to test',
      },
      description: {
        type: 'string',
        description: 'Natural language description of what to test',
      },
      testType: {
        type: 'string',
        enum: ['e2e', 'api', 'visual'],
        description: 'Type of test to generate (default: e2e)',
      },
      framework: {
        type: 'string',
        enum: ['playwright', 'cypress'],
        description: 'Testing framework to use (default: playwright)',
      },
    },
  },
};
