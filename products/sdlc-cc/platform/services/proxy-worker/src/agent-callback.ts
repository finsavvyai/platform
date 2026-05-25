/**
 * Runner callback and tool request handlers for agent runs.
 */

import type { Env } from './env';
import type { RunnerCallbackPayload } from './runners/types';
import { getAgentRun, updateAgentRunStatus } from './runners/storage';
import {
  jsonResponse,
  unauthorizedResponse,
  badRequestResponse,
  notFoundResponse,
  methodNotAllowedResponse,
  readJsonBody,
} from './response-helpers';

export const AGENT_RUN_CALLBACK_PATTERN =
  /^\/agent\/internal\/runs\/([^/]+)\/callback$/;

export async function handleRunnerCallback(
  request: Request,
  env: Env,
  requestId: string,
  runId: string
): Promise<Response> {
  if (request.method !== 'POST') {
    return methodNotAllowedResponse(['POST']);
  }

  if (!env.RUNNER_SHARED_SECRET) {
    return jsonResponse(
      {
        error: {
          code: 'runner_secret_missing',
          message: 'Runner shared secret is not configured',
        },
      },
      503
    );
  }

  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${env.RUNNER_SHARED_SECRET}`) {
    return unauthorizedResponse('Invalid runner callback credentials');
  }

  const run = await getAgentRun(env.DB, runId);
  if (!run) {
    return notFoundResponse('Agent run not found');
  }

  let payload: RunnerCallbackPayload;
  try {
    payload = await readJsonBody<RunnerCallbackPayload>(request);
  } catch (error) {
    return badRequestResponse(
      error instanceof Error ? error.message : 'Invalid runner callback payload'
    );
  }

  if (!isValidAgentStatus(payload.status)) {
    return jsonResponse(
      {
        error: {
          code: 'invalid_status',
          message: 'Runner callback included an unsupported status',
        },
      },
      400
    );
  }

  await updateAgentRunStatus(env.DB, runId, {
    status: payload.status,
    summary: payload.summary,
    result: payload.result,
    error: payload.error,
    usage: payload.usage,
  });

  const updatedRun = await getAgentRun(env.DB, runId);
  return jsonResponse(
    {
      run_id: runId,
      request_id: requestId,
      status: updatedRun?.status ?? payload.status,
      updated_at: updatedRun?.updated_at ?? new Date().toISOString(),
    },
    202
  );
}

export async function handleRunnerToolRequest(
  request: Request,
  env: Env
): Promise<Response> {
  if (!env.BACKEND_URL) {
    return jsonResponse(
      {
        error: {
          code: 'backend_unavailable',
          message: 'Backend URL is not configured for Claw tool routing',
        },
      },
      503
    );
  }

  const { proxyToBackend } = await import('./proxy-backend');
  const headers = new Headers(request.headers);
  headers.delete('Authorization');
  headers.delete('X-API-Key');
  headers.set('X-SDLC-Runner', 'true');

  return proxyToBackend(new Request(request, { headers }), env);
}

export function isRunnerToolRequest(request: Request, env: Env): boolean {
  const pathname = new URL(request.url).pathname;
  if (
    !(pathname === '/api/v1/claw' || pathname.startsWith('/api/v1/claw/'))
  ) {
    return false;
  }

  if (!env.RUNNER_SHARED_SECRET) {
    return false;
  }

  return (
    request.headers.get('Authorization') ===
    `Bearer ${env.RUNNER_SHARED_SECRET}`
  );
}

function isValidAgentStatus(status: string): boolean {
  return [
    'accepted',
    'dispatched',
    'running',
    'completed',
    'failed',
    'cancelling',
    'cancelled',
  ].includes(status);
}
