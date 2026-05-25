import * as SecureStore from '../lib/secureStore';
import { API_BASE_URL } from '../config';

const TOKEN_KEY = 'pushci_token';

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
  const refreshed = res.headers.get('X-Refreshed-Token');
  if (refreshed) {
    await SecureStore.setItemAsync(TOKEN_KEY, refreshed);
  }
  if (!res.ok) {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json().catch(() => null) as { error?: string } | null;
      throw new Error(`API ${res.status}: ${data?.error || res.statusText}`);
    }
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export interface RunSummary {
  id: string;
  repo: string;
  branch: string;
  sha: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
  duration_ms: number | null;
  created_at: string;
  commit_message?: string;
  trigger?: string;
}

export interface Project {
  id: string;
  repo: string;
  platform: 'github' | 'gitlab' | 'bitbucket';
  created_at: string;
  last_run_status?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: string;
  tags: string[];
  installs: number;
  author: string;
}

export const api = {
  getRuns: async (): Promise<RunSummary[]> => {
    const data = await apiFetch<{ runs: RunSummary[] }>('/api/runs');
    return data.runs;
  },
  getProjects: async (): Promise<Project[]> => {
    const data = await apiFetch<{ projects: Project[] }>('/api/projects');
    return data.projects;
  },
  getSkills: async (): Promise<Skill[]> => {
    const data = await apiFetch<{ skills: Skill[] }>('/api/skills');
    return data.skills;
  },
  getUser: async () => {
    return apiFetch<{ plan?: string; ai_usage?: number; ai_limit?: number }>(
      '/api/user/me',
    );
  },
};
