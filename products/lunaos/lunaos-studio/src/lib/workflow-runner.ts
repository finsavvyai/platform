/**
 * WorkflowRunner — execute a serialized pipeline via the
 * LunaOS Engine API at api.lunaos.ai/chains/execute.
 */

import type { PipelineJSON, ExecutionResult } from '../types';

const API_BASE = 'https://api.lunaos.ai';

interface RunnerCallbacks {
  onStart?: () => void;
  onNodeStart?: (nodeId: string) => void;
  onNodeComplete?: (nodeId: string, output: unknown) => void;
  onComplete?: (result: ExecutionResult) => void;
  onError?: (error: Error) => void;
}

function getToken(): string {
  return localStorage.getItem('lunaos_token') ?? '';
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function executeWorkflow(
  pipeline: PipelineJSON,
  callbacks: RunnerCallbacks = {}
): Promise<ExecutionResult> {
  callbacks.onStart?.();

  const response = await fetch(`${API_BASE}/chains/execute`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      pipeline: {
        name: pipeline.name,
        nodes: pipeline.nodes,
        edges: pipeline.edges,
      },
    }),
  });

  if (!response.ok) {
    const msg = await response.text().catch(() => response.statusText);
    const err = new Error(`Execution failed: ${msg}`);
    callbacks.onError?.(err);
    throw err;
  }

  // Handle SSE streaming from the engine
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let result: ExecutionResult = {
    executionId: '',
    status: 'running',
    nodeResults: {},
    startedAt: new Date().toISOString(),
  };

  // eslint-disable-next-line no-constant-condition -- SSE reader loop
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data) as Record<string, unknown>;
        result = processSSEEvent(parsed, result, callbacks);
      } catch {
        // Non-JSON SSE line — skip
      }
    }
  }

  result.status = 'completed';
  result.completedAt = new Date().toISOString();
  callbacks.onComplete?.(result);
  return result;
}

function processSSEEvent(
  event: Record<string, unknown>,
  result: ExecutionResult,
  callbacks: RunnerCallbacks
): ExecutionResult {
  const type = event['event'] as string | undefined;

  switch (type) {
  case 'chain_start':
    result.executionId = (event['executionId'] as string) ?? result.executionId;
    break;

  case 'node_start':
    if (typeof event['nodeId'] === 'string') {
      callbacks.onNodeStart?.(event['nodeId']);
    }
    break;

  case 'node_complete': {
    const nodeId = event['nodeId'] as string | undefined;
    if (nodeId) {
      result.nodeResults[nodeId] = {
        output: event['output'],
        duration: (event['duration'] as number) ?? 0,
        status: 'success',
      };
      callbacks.onNodeComplete?.(nodeId, event['output']);
    }
    break;
  }

  case 'error': {
    const errNodeId = event['nodeId'] as string | undefined;
    if (errNodeId) {
      result.nodeResults[errNodeId] = {
        output: null,
        duration: 0,
        status: 'error',
        error: (event['message'] as string) ?? 'Unknown error',
      };
    }
    result.status = 'failed';
    callbacks.onError?.(new Error((event['message'] as string) ?? 'Execution error'));
    break;
  }
  }

  return result;
}

export async function getExecutionStatus(
  executionId: string
): Promise<ExecutionResult> {
  const response = await fetch(
    `${API_BASE}/chains/${executionId}/status`,
    { headers: buildHeaders() }
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch status: ${response.statusText}`);
  }
  return response.json() as Promise<ExecutionResult>;
}
