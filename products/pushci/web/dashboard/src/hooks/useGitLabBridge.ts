// Typed client for the GitLab live-poll bridge mounted at /api/gitlab/*.
// See api/src/gitlab-routes.ts for the wire contract.
import { API_BASE_URL } from '../config';

export interface GitLabConnection {
  id: string;
  label: string;
  baseUrl: string;
  privateTokenPreview: string;
  created_at: string;
  updated_at: string;
}

export interface GitLabProject {
  id: number;
  name: string;
  path: string;
  web_url: string;
  default_branch: string | null;
}

export type BridgeStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';

export interface GitLabPipelineSummary {
  id: number;
  ref: string;
  sha: string;
  status: BridgeStatus;
  raw_status: string;
  web_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitLabPipelineDetail {
  id: number;
  status: BridgeStatus;
  raw_status: string;
  ref: string;
  sha: string;
  web_url: string;
  duration: number | null;
}

export interface GitLabJob {
  id: number;
  name: string;
  stage: string;
  status: BridgeStatus;
  raw_status: string;
  duration: number | null;
}

export interface GitLabImportPreview {
  pipeline: { stages: string[]; jobs: Array<{ name: string; stage: string; script: string[] }> };
  yaml: string;
  source: string;
}

export interface ConnectInput {
  baseUrl?: string;
  privateToken: string;
  label?: string;
}

async function gitlabFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem('pushci_token');
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
    const msg = ct.includes('application/json')
      ? ((await res.json().catch(() => null)) as { error?: string } | null)?.error
      : await res.text().catch(() => '');
    throw new Error(msg || `GitLab API ${res.status}`);
  }
  return (await res.json()) as T;
}

export const gitlabApi = {
  connect: (input: ConnectInput) =>
    gitlabFetch<{ connection: GitLabConnection }>('/api/gitlab/connect', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  listConnections: () =>
    gitlabFetch<{ connections: GitLabConnection[] }>('/api/gitlab/connections'),
  deleteConnection: (id: string) =>
    gitlabFetch<{ ok: boolean }>(`/api/gitlab/connections/${id}`, { method: 'DELETE' }),
  listProjects: (id: string, search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return gitlabFetch<{ projects: GitLabProject[] }>(
      `/api/gitlab/connections/${id}/projects${qs}`,
    );
  },
  listPipelines: (id: string, projectId: number | string, ref?: string) => {
    const qs = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    return gitlabFetch<{ pipelines: GitLabPipelineSummary[] }>(
      `/api/gitlab/bridge/${id}/projects/${projectId}/pipelines${qs}`,
    );
  },
  getPipeline: (id: string, projectId: number | string, pipelineId: number | string) =>
    gitlabFetch<{ pipeline: GitLabPipelineDetail; jobs: GitLabJob[] }>(
      `/api/gitlab/bridge/${id}/projects/${projectId}/pipelines/${pipelineId}`,
    ),
  trigger: (id: string, projectId: number | string, ref: string, variables: Record<string, string> = {}) =>
    gitlabFetch<{ triggered: boolean; pipeline: { id: number; web_url: string; status: BridgeStatus } }>(
      `/api/gitlab/bridge/${id}/projects/${projectId}/trigger`,
      { method: 'POST', body: JSON.stringify({ ref, variables }) },
    ),
  import: (connectionId: string, projectId: number | string, ref?: string) =>
    gitlabFetch<{ preview: GitLabImportPreview }>(
      '/api/gitlab/import',
      { method: 'POST', body: JSON.stringify({ connectionId, projectId, ref }) },
    ),
};

export type GitLabApi = typeof gitlabApi;
