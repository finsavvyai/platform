/**
 * Agent API — list agents, execute agent, list executions.
 * Maps to GET /agents/list, POST /agents/execute, GET /agents/executions
 */

import { apiFetch } from './client';
import type {
  AgentListResponse,
  ExecuteParams,
  ExecutionsResponse,
} from '../types/api';

export async function listAgents(): Promise<AgentListResponse> {
  return apiFetch<AgentListResponse>('/agents/list', { skipAuth: true });
}

export async function listExecutions(
  limit = 20,
  offset = 0,
): Promise<ExecutionsResponse> {
  return apiFetch<ExecutionsResponse>(
    `/agents/executions?limit=${limit}&offset=${offset}`,
  );
}

export type { ExecuteParams };
