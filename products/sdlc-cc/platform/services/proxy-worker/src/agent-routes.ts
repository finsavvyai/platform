/**
 * Agent run routes: dispatch, status, and cancel.
 */

import type { ApiKeyRecord } from './api-keys';
import type { Env } from './env';
import { dispatchRun } from './runners/dispatch';
import { getAgentRun, toAgentRunResponse, updateAgentRunStatus } from './runners/storage';
import {
  AGENT_RUN_TERMINAL_STATUSES,
  type AgentRunRecord,
  type AgentRunRequest,
} from './runners/types';
import {
  jsonResponse,
  badRequestResponse,
  notFoundResponse,
  methodNotAllowedResponse,
  readJsonBody,
} from './response-helpers';

// Re-export callback-related items for backward compatibility
export {
  AGENT_RUN_CALLBACK_PATTERN,
  handleRunnerCallback,
  handleRunnerToolRequest,
  isRunnerToolRequest,
} from './agent-callback';

const AGENT_RUN_STATUS_PATTERN = /^\/agent\/runs\/([^/]+)$/;
const AGENT_RUN_CANCEL_PATTERN = /^\/agent\/runs\/([^/]+)\/cancel$/;

export async function handleAgentRoute(
  request: Request,
  env: Env,
  keyData: ApiKeyRecord,
  requestId: string
): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname === '/agent/runs' && request.method === 'POST') {
    try {
      const body = await readJsonBody<AgentRunRequest>(request);
      return dispatchRun(body, env, {
        runId: `run_${crypto.randomUUID()}`,
        apiKeyId: keyData.id,
        requestId,
        publicBaseUrl: `${url.protocol}//${url.host}`,
        keyData,
      });
    } catch (error) {
      return badRequestResponse(
        error instanceof Error ? error.message : 'Invalid run request'
      );
    }
  }

  const cancelMatch = url.pathname.match(AGENT_RUN_CANCEL_PATTERN);
  if (cancelMatch) {
    return handleCancelRun(request, env, keyData, cancelMatch[1]);
  }

  const statusMatch = url.pathname.match(AGENT_RUN_STATUS_PATTERN);
  if (statusMatch) {
    return handleGetRunStatus(request, env, keyData, statusMatch[1]);
  }

  return null;
}

async function handleCancelRun(
  request: Request,
  env: Env,
  keyData: ApiKeyRecord,
  rawRunId: string
): Promise<Response> {
  if (request.method !== 'POST') {
    return methodNotAllowedResponse(['POST']);
  }

  const runId = decodeURIComponent(rawRunId);
  const run = await getAgentRun(env.DB, runId);
  if (!run || !canAccessRun(run, keyData)) {
    return notFoundResponse('Agent run not found');
  }

  if (
    AGENT_RUN_TERMINAL_STATUSES.includes(
      run.status as (typeof AGENT_RUN_TERMINAL_STATUSES)[number]
    )
  ) {
    return jsonResponse(
      {
        error: {
          code: 'invalid_state',
          message: `Run is already ${run.status} and cannot be cancelled`,
        },
      },
      409
    );
  }

  await updateAgentRunStatus(env.DB, runId, {
    status: 'cancelling',
    summary: 'Cancellation requested by API client',
  });

  const updatedRun = await getAgentRun(env.DB, runId);
  return jsonResponse(
    updatedRun
      ? toAgentRunResponse(updatedRun)
      : { run_id: runId, status: 'cancelling' },
    202
  );
}

async function handleGetRunStatus(
  request: Request,
  env: Env,
  keyData: ApiKeyRecord,
  rawRunId: string
): Promise<Response> {
  if (request.method !== 'GET') {
    return methodNotAllowedResponse(['GET']);
  }

  const run = await getAgentRun(env.DB, decodeURIComponent(rawRunId));
  if (!run || !canAccessRun(run, keyData)) {
    return notFoundResponse('Agent run not found');
  }

  return jsonResponse(toAgentRunResponse(run), 200);
}

function canAccessRun(run: AgentRunRecord, keyData: ApiKeyRecord): boolean {
  if (run.user_id !== keyData.user_id) {
    return false;
  }

  if (keyData.project_id && run.project_id !== keyData.project_id) {
    return false;
  }

  if (keyData.adapter && run.adapter !== keyData.adapter) {
    return false;
  }

  return true;
}
