const API = import.meta.env.VITE_API_URL || 'https://pushci-api.workers.dev';

function getToken(): string | null {
  return localStorage.getItem('pushci_token');
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export interface RunSummary {
  id: string;
  repo: string;
  branch: string;
  sha: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration_ms: number;
  created_at: string;
}

export interface RunDetail extends RunSummary {
  checks: CheckResult[];
  logs: string;
}

export interface CheckResult {
  name: string;
  passed: boolean;
  output: string;
  duration_ms: number;
}

export interface Project {
  id: string;
  repo: string;
  platform: 'github' | 'gitlab' | 'bitbucket';
  created_at: string;
  last_run_status: string;
}

export const api = {
  getRuns: () => apiFetch<RunSummary[]>('/api/runs'),
  getRun: (id: string) => apiFetch<RunDetail>(`/api/runs/${id}`),
  getProjects: () => apiFetch<Project[]>('/api/projects'),
  rerun: (id: string) => apiFetch<void>(`/api/runs/${id}/rerun`, { method: 'POST' }),
};
