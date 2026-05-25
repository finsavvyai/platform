import type { ApiKeyRecord } from '../api-keys';
import type { Env } from '../env';
import { insertAgentRun, updateAgentRunStatus } from './storage';
import type {
  AgentRunRecord,
  AgentRunRequest,
  RunnerDispatchPayload,
  RunnerDispatchTokenClaims,
} from './types';

const DEFAULT_MAX_STEPS = 20;
const DEFAULT_RUNNER_TIMEOUT_MS = 15_000;
const RUNNER_TOKEN_TTL_SECONDS = 5 * 60;

export interface DispatchContext {
  runId: string;
  apiKeyId: string;
  requestId: string;
  publicBaseUrl: string;
  keyData: ApiKeyRecord;
}

export async function dispatchRun(
  request: AgentRunRequest,
  env: Env,
  context: DispatchContext
): Promise<Response> {
  if (!env.RUNNER_BASE_URL) {
    return jsonResponse(
      {
        error: {
          code: 'runner_unavailable',
          message: 'Runner dispatch is not configured for this environment',
        },
      },
      503,
      context.requestId
    );
  }

  if (!env.RUNNER_SHARED_SECRET) {
    return jsonResponse(
      {
        error: {
          code: 'runner_secret_missing',
          message: 'Runner shared secret is not configured',
        },
      },
      503,
      context.requestId
    );
  }

  const normalizedRequest = normalizeRunRequest(request, context.keyData);
  const scopeError = enforceRunScopes(normalizedRequest, context.keyData);

  if (scopeError) {
    return jsonResponse(
      {
        error: {
          code: 'forbidden',
          message: scopeError,
        },
      },
      403,
      context.requestId
    );
  }

  const now = new Date().toISOString();
  const runRecord: AgentRunRecord = {
    run_id: context.runId,
    project_id: normalizedRequest.project_id,
    session_id: normalizedRequest.session_id,
    tenant_id: normalizedRequest.tenant_id,
    user_id: normalizedRequest.user_id,
    api_key_id: context.apiKeyId,
    adapter: normalizedRequest.adapter,
    model: normalizedRequest.model,
    status: 'accepted',
    goal: normalizedRequest.goal,
    summary: 'Run accepted by edge dispatcher',
    result_json: null,
    error_json: null,
    usage_json: null,
    created_at: now,
    updated_at: now,
  };

  await insertAgentRun(env.DB, runRecord);

  const callbackUrl = buildCallbackUrl(context.publicBaseUrl, context.runId);
  const toolBaseUrl = buildToolBaseUrl(context.publicBaseUrl);
  const token = await createRunnerDispatchToken(
    {
      iss: 'api.sdlc.cc',
      aud: getRunnerAudience(env.RUNNER_BASE_URL),
      sub: context.runId,
      exp: Math.floor(Date.now() / 1000) + RUNNER_TOKEN_TTL_SECONDS,
      nbf: Math.floor(Date.now() / 1000) - 10,
      project_id: normalizedRequest.project_id,
      tenant_id: normalizedRequest.tenant_id,
      user_id: normalizedRequest.user_id,
      adapter: normalizedRequest.adapter,
      model: normalizedRequest.model,
    },
    env.RUNNER_SHARED_SECRET
  );

  const runnerPayload: RunnerDispatchPayload = {
    run_id: context.runId,
    project_id: normalizedRequest.project_id,
    session_id: normalizedRequest.session_id,
    tenant_id: normalizedRequest.tenant_id,
    user_id: normalizedRequest.user_id,
    adapter: normalizedRequest.adapter,
    goal: normalizedRequest.goal,
    model: normalizedRequest.model,
    max_steps: normalizedRequest.max_steps,
    stream: normalizedRequest.stream,
    tool_base_url: toolBaseUrl,
    callback_url: callbackUrl,
    metadata: {
      request_id: context.requestId,
      api_key_id: context.apiKeyId,
      ...normalizedRequest.metadata,
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    getRunnerTimeoutMs(env.RUNNER_TIMEOUT_MS)
  );

  try {
    const runnerResponse = await fetch(new URL('/v1/runs', env.RUNNER_BASE_URL).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Request-ID': context.requestId,
        'X-SDLC-Run-ID': context.runId,
      },
      body: JSON.stringify(runnerPayload),
      signal: controller.signal,
    });

    if (!runnerResponse.ok) {
      const body = await readErrorBody(runnerResponse);
      await updateAgentRunStatus(env.DB, context.runId, {
        status: 'failed',
        summary: 'Runner rejected the dispatch request',
        error: {
          status: runnerResponse.status,
          body,
        },
      });

      return jsonResponse(
        {
          error: {
            code: 'runner_dispatch_failed',
            message: 'Runner rejected the dispatch request',
            details: body,
          },
        },
        502,
        context.requestId
      );
    }

    await updateAgentRunStatus(env.DB, context.runId, {
      status: 'dispatched',
      summary: 'Run dispatched to the hosted runner',
    });

    return jsonResponse(
      {
        run_id: context.runId,
        status: 'accepted',
        session_id: normalizedRequest.session_id,
        project_id: normalizedRequest.project_id,
        created_at: now,
      },
      202,
      context.requestId
    );
  } catch (error) {
    await updateAgentRunStatus(env.DB, context.runId, {
      status: 'failed',
      summary: 'Runner dispatch request failed before acceptance',
      error: serializeError(error),
    });

    return jsonResponse(
      {
        error: {
          code: 'runner_dispatch_error',
          message: 'Runner dispatch request failed',
          details: serializeError(error),
        },
      },
      502,
      context.requestId
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeRunRequest(request: AgentRunRequest, keyData: ApiKeyRecord): Required<AgentRunRequest> {
  const projectId = requiredString(request.project_id, 'project_id');
  const sessionId = requiredString(request.session_id, 'session_id');
  const tenantId = requiredString(request.tenant_id, 'tenant_id');
  const adapter = requiredString(request.adapter, 'adapter');
  const goal = requiredString(request.goal, 'goal');
  const model = requiredString(request.model, 'model');
  const userId = requiredString(request.user_id ?? keyData.user_id, 'user_id');

  return {
    project_id: projectId,
    session_id: sessionId,
    tenant_id: tenantId,
    user_id: userId,
    adapter,
    goal,
    model,
    max_steps: normalizeMaxSteps(request.max_steps),
    stream: request.stream === true,
    metadata: normalizeMetadata(request.metadata),
  };
}

function enforceRunScopes(request: Required<AgentRunRequest>, keyData: ApiKeyRecord): string | null {
  if (request.user_id !== keyData.user_id) {
    return 'The API key does not allow dispatching runs for a different user';
  }

  if (keyData.project_id && request.project_id !== keyData.project_id) {
    return `This API key is scoped to project "${keyData.project_id}"`;
  }

  if (keyData.adapter && request.adapter !== keyData.adapter) {
    return `This API key is scoped to adapter "${keyData.adapter}"`;
  }

  if (Array.isArray(keyData.allowed_models) && keyData.allowed_models.length > 0) {
    const allowed = new Set(keyData.allowed_models);
    if (!allowed.has(request.model)) {
      return `Model "${request.model}" is not allowed for this API key`;
    }
  }

  return null;
}

function buildCallbackUrl(publicBaseUrl: string, runId: string): string {
  return new URL(`/agent/internal/runs/${runId}/callback`, publicBaseUrl).toString();
}

function buildToolBaseUrl(publicBaseUrl: string): string {
  return new URL('/api/v1/claw', publicBaseUrl).toString();
}

function getRunnerAudience(runnerBaseUrl: string): string {
  return new URL(runnerBaseUrl).host;
}

function getRunnerTimeoutMs(value?: string): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RUNNER_TIMEOUT_MS;
}

function normalizeMaxSteps(value?: number): number {
  if (value === undefined) {
    return DEFAULT_MAX_STEPS;
  }

  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error('max_steps must be an integer between 1 and 100');
  }

  return value;
}

function normalizeMetadata(value?: Record<string, string>): Record<string, string> {
  if (!value) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>((accumulator, [key, item]) => {
    if (typeof item === 'string' && key.trim()) {
      accumulator[key.trim()] = item;
    }
    return accumulator;
  }, {});
}

function requiredString(value: string, field: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${field} is required`);
  }

  return normalized;
}

async function createRunnerDispatchToken(
  claims: RunnerDispatchTokenClaims,
  secret: string
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const unsigned = `${encodedHeader}.${encodedClaims}`;
  const signature = await signHmacSha256(unsigned, secret);

  return `${unsigned}.${signature}`;
}

async function signHmacSha256(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return base64UrlEncode(signature);
}

function base64UrlEncode(value: string | ArrayBuffer): string {
  const bytes =
    typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function readErrorBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function serializeError(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    name: 'Error',
    message: String(error),
  };
}

function jsonResponse(body: unknown, status: number, requestId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
    },
  });
}
