/**
 * MCP Tool: Get project information
 * Returns overview of project, test counts, recent runs, and health metrics
 */

import { z } from 'zod';
import { apiGet } from '../utils/api-client.js';
import { ProjectInfoInput, ProjectInfoResult } from '../types.js';

const ProjectInfoInputSchema = z.object({
  projectId: z.string().optional(),
});

/**
 * Get project overview and health metrics
 * @param input - Optional project ID
 * @returns Project info, test counts, recent runs, health score
 */
export async function getProjectInfo(
  input: ProjectInfoInput,
): Promise<ProjectInfoResult> {
  const validation = ProjectInfoInputSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      error: `Invalid input: ${validation.error.message}`,
    };
  }

  try {
    // Get from default project if no ID provided
    const endpoint = validation.data.projectId
      ? `/projects/${validation.data.projectId}`
      : '/projects/default';

    const response = await apiGet<{
      projectId: string;
      name: string;
      testCount: number;
      passRate: number;
      recentRuns: Array<{
        runId: string;
        timestamp: string;
        status: string;
        duration: number;
      }>;
      healthScore: number;
      lastUpdated: string;
    }>(endpoint);

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to fetch project info',
      };
    }

    return {
      success: true,
      projectId: response.data?.projectId,
      name: response.data?.name,
      testCount: response.data?.testCount,
      passRate: response.data?.passRate,
      recentRuns: response.data?.recentRuns || [],
      healthScore: response.data?.healthScore,
      lastUpdated: response.data?.lastUpdated,
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
export const projectInfoTool = {
  name: 'qestro_project_info',
  description:
    'Get overview of a project including test counts, pass rate, recent runs, and health score.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID (uses default project if not specified)',
      },
    },
  },
};
