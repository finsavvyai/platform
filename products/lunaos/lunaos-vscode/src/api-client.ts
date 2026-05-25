import * as vscode from 'vscode';
import type {
  Agent,
  AnalyzeRequest,
  AnalyzeResponse,
  ApiError,
  PipeRequest,
  PipeResponse,
  Run,
  RunLog,
} from './types';

/** Read the configured API endpoint */
function getEndpoint(): string {
  const config = vscode.workspace.getConfiguration('lunaos');
  return config.get<string>('apiEndpoint', 'https://api.lunaos.ai');
}

/** Read the configured API key */
function getApiKey(): string {
  const config = vscode.workspace.getConfiguration('lunaos');
  return config.get<string>('apiKey', '');
}

/** Build headers with auth */
function buildHeaders(): Record<string, string> {
  const key = getApiKey();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (key) {
    headers['Authorization'] = `Bearer ${key}`;
  }
  return headers;
}

/** Generic fetch wrapper with error handling */
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getEndpoint()}${path}`;
  const headers = { ...buildHeaders(), ...(options.headers as Record<string, string> ?? {}) };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const apiErr = body as ApiError | null;
    const msg = apiErr?.error ?? `HTTP ${response.status}`;
    throw new Error(msg);
  }

  return response.json() as Promise<T>;
}

/** Fetch all agents */
export async function fetchAgents(): Promise<Agent[]> {
  return request<Agent[]>('/api/agents');
}

/** Trigger a run for an agent */
export async function createRun(agentId: string): Promise<Run> {
  return request<Run>('/api/runs', {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  });
}

/** Fetch recent runs */
export async function fetchRecentRuns(limit = 20): Promise<Run[]> {
  return request<Run[]>(`/api/runs?limit=${limit}`);
}

/** Fetch logs for a specific run */
export async function fetchRunLogs(runId: string): Promise<RunLog[]> {
  return request<RunLog[]>(`/api/runs/${runId}/logs`);
}

/** Execute a pipe expression */
export async function executePipe(
  expression: string,
  context?: Record<string, unknown>
): Promise<PipeResponse> {
  const body: PipeRequest = { expression, context };
  return request<PipeResponse>('/api/pipes/execute', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Analyze code with an agent */
export async function analyzeCode(
  code: string,
  language: string,
  agentId?: string
): Promise<AnalyzeResponse> {
  const body: AnalyzeRequest = { code, language, agentId };
  return request<AnalyzeResponse>('/api/analyze', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Check whether an API key is configured */
export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}
