// Typed client for the GitHub Actions live-poll bridge API
// (mounted at /api/github-actions/* on the CF Worker).
// Backend is under construction — this hook matches the shape
// declared in the importer spec; tests stub fetch/client.
// License: Apache-2.0

import { useCallback } from 'react';
import { API_BASE_URL } from '../config';

export type GHAConclusion =
  | 'success' | 'failure' | 'cancelled' | 'skipped'
  | 'timed_out' | 'action_required' | 'neutral' | 'stale' | null;

export type GHAStatus = 'queued' | 'in_progress' | 'completed' | 'waiting' | 'pending';

export interface GitHubActionsConnection {
  id: string;
  label: string;
  login?: string;
  tokenPreview: string;
  scopes: string[];
  created_at: string;
  updated_at: string;
}

export interface GHARepo {
  id: number;
  name: string;
  owner: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  last_run?: { conclusion: GHAConclusion; status: GHAStatus; created_at: string };
}

export interface GHAWorkflow {
  id: number;
  name: string;
  path: string;
  state: 'active' | 'disabled_manually' | 'disabled_inactivity';
  has_workflow_dispatch?: boolean;
  inputs?: Array<{ name: string; required?: boolean; default?: string; description?: string }>;
}

export interface GHARun {
  id: number;
  run_number: number;
  name?: string;
  head_branch?: string;
  head_sha: string;
  status: GHAStatus;
  conclusion: GHAConclusion;
  event: string;
  created_at: string;
  updated_at?: string;
  html_url?: string;
  workflow_id: number;
  run_started_at?: string;
  duration_ms?: number;
}

export interface GHAStep {
  name: string;
  status: GHAStatus;
  conclusion: GHAConclusion;
  number: number;
  started_at?: string;
  completed_at?: string;
}

export interface GHAJob {
  id: number;
  name: string;
  status: GHAStatus;
  conclusion: GHAConclusion;
  started_at?: string;
  completed_at?: string;
  html_url?: string;
  steps: GHAStep[];
}

export interface GHARunDetail {
  run: GHARun;
  jobs: GHAJob[];
}

export interface ConnectPayload { token: string; label?: string }
export interface DispatchPayload {
  workflowId: number;
  ref: string;
  inputs?: Record<string, string>;
}

function getToken(): string | null { return localStorage.getItem('pushci_token'); }

export async function ghaFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
  if (!res.ok) {
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `GitHub Actions API ${res.status}`);
    }
    throw new Error(`GitHub Actions API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export interface GitHubActionsBridgeClient {
  connect: (body: ConnectPayload) => Promise<GitHubActionsConnection>;
  listConnections: () => Promise<GitHubActionsConnection[]>;
  deleteConnection: (id: string) => Promise<void>;
  listRepos: (id: string, search?: string) => Promise<GHARepo[]>;
  listWorkflows: (id: string, owner: string, repo: string) => Promise<GHAWorkflow[]>;
  listRuns: (id: string, owner: string, repo: string, filter?: { workflowId?: number; branch?: string }) => Promise<GHARun[]>;
  getRun: (id: string, owner: string, repo: string, runId: number) => Promise<GHARunDetail>;
  dispatch: (id: string, owner: string, repo: string, body: DispatchPayload) => Promise<{ ok: boolean }>;
}

function enc(v: string | number): string { return encodeURIComponent(String(v)); }

export function useGitHubActionsBridge(): GitHubActionsBridgeClient {
  const connect = useCallback(async (body: ConnectPayload) => {
    const { connection } = await ghaFetch<{ connection: GitHubActionsConnection }>(
      '/api/github-actions/connect',
      { method: 'POST', body: JSON.stringify(body) },
    );
    return connection;
  }, []);

  const listConnections = useCallback(async () => {
    const { connections } = await ghaFetch<{ connections: GitHubActionsConnection[] }>('/api/github-actions/connections');
    return connections;
  }, []);

  const deleteConnection = useCallback(async (id: string) => {
    await ghaFetch<{ ok: boolean }>(`/api/github-actions/connections/${enc(id)}`, { method: 'DELETE' });
  }, []);

  const listRepos = useCallback(async (id: string, search?: string) => {
    const qs = search ? `?search=${enc(search)}` : '';
    const { repos } = await ghaFetch<{ repos: GHARepo[] }>(
      `/api/github-actions/connections/${enc(id)}/repos${qs}`,
    );
    return repos;
  }, []);

  const listWorkflows = useCallback(async (id: string, owner: string, repo: string) => {
    const { workflows } = await ghaFetch<{ workflows: GHAWorkflow[] }>(
      `/api/github-actions/bridge/${enc(id)}/${enc(owner)}/${enc(repo)}/workflows`,
    );
    return workflows;
  }, []);

  const listRuns = useCallback(async (
    id: string, owner: string, repo: string,
    filter?: { workflowId?: number; branch?: string },
  ) => {
    const params = new URLSearchParams();
    if (filter?.workflowId != null) params.set('workflowId', String(filter.workflowId));
    if (filter?.branch) params.set('branch', filter.branch);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const { runs } = await ghaFetch<{ runs: GHARun[] }>(
      `/api/github-actions/bridge/${enc(id)}/${enc(owner)}/${enc(repo)}/runs${qs}`,
    );
    return runs;
  }, []);

  const getRun = useCallback(async (id: string, owner: string, repo: string, runId: number) => {
    return ghaFetch<GHARunDetail>(
      `/api/github-actions/bridge/${enc(id)}/${enc(owner)}/${enc(repo)}/runs/${enc(runId)}`,
    );
  }, []);

  const dispatch = useCallback(async (id: string, owner: string, repo: string, body: DispatchPayload) => {
    return ghaFetch<{ ok: boolean }>(
      `/api/github-actions/bridge/${enc(id)}/${enc(owner)}/${enc(repo)}/dispatch`,
      { method: 'POST', body: JSON.stringify(body) },
    );
  }, []);

  return { connect, listConnections, deleteConnection, listRepos, listWorkflows, listRuns, getRun, dispatch };
}
