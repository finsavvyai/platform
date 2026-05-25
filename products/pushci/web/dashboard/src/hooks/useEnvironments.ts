// useEnvironments — thin React hook wrapping the /api/projects/:id/environments
// CRUD endpoints. Keeps the pages free of fetch plumbing and normalizes error
// handling so callers can render {envs, loading, error, refresh, create, ...}.

import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';

export type EnvKind =
  | 'dev'
  | 'test'
  | 'staging'
  | 'pre-prod'
  | 'prod'
  | 'canary'
  | 'custom';

export interface ProjectEnvironment {
  id: string;
  projectId: string;
  name: string;
  kind: EnvKind;
  order: number;
  requireApproval: boolean;
  requiredApprovers: number;
  protectedBranch?: string;
  registryBindings: string[];
  variables: Record<string, string>;
  secretRefs: string[];
  createdAt: string;
  updatedAt: string;
}

export type EnvInput = Partial<ProjectEnvironment> & {
  name: string;
  kind: EnvKind;
};

function getToken(): string | null {
  return localStorage.getItem('pushci_token');
}

async function call<T>(path: string, opts?: RequestInit): Promise<T> {
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
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export function useProjectEnvironments(projectId: string) {
  const [envs, setEnvs] = useState<ProjectEnvironment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await call<{ environments: ProjectEnvironment[] }>(
        `/api/projects/${projectId}/environments`,
      );
      setEnvs(data.environments);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: EnvInput) => {
      const data = await call<{ environment: ProjectEnvironment }>(
        `/api/projects/${projectId}/environments`,
        { method: 'POST', body: JSON.stringify(input) },
      );
      await refresh();
      return data.environment;
    },
    [projectId, refresh],
  );

  const update = useCallback(
    async (envId: string, input: EnvInput) => {
      const data = await call<{ environment: ProjectEnvironment }>(
        `/api/projects/${projectId}/environments/${envId}`,
        { method: 'PUT', body: JSON.stringify(input) },
      );
      await refresh();
      return data.environment;
    },
    [projectId, refresh],
  );

  const remove = useCallback(
    async (envId: string) => {
      await call<{ ok: boolean }>(
        `/api/projects/${projectId}/environments/${envId}`,
        { method: 'DELETE' },
      );
      await refresh();
    },
    [projectId, refresh],
  );

  return { envs, loading, error, refresh, create, update, remove };
}
