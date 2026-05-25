// Typed client for the Bitbucket Cloud live-poll bridge API
// (mounted at /api/bitbucket/* on the CF Worker).
// Backend shapes mirror api/src/bitbucket-routes.ts + bitbucket-conn.ts.
// License: Apache-2.0

import { useCallback } from 'react';
import { API_BASE_URL } from '../config';

export type BitbucketAuthType = 'app-password' | 'bearer';

export interface BitbucketConnection {
  id: string;
  label: string;
  user?: string;
  authType: BitbucketAuthType;
  secretPreview: string;
  defaultWorkspace?: string;
  created_at: string;
  updated_at: string;
}

export interface BitbucketWorkspace {
  slug: string;
  name: string;
  uuid?: string;
}

export interface BitbucketRepo {
  slug: string;
  full_name: string;
  name: string;
  mainbranch?: { name: string };
  is_private?: boolean;
  updated_on?: string;
}

export type BitbucketStatus =
  | 'pending' | 'running' | 'passed' | 'failed' | 'stopped' | 'halted' | 'unknown';

export interface BitbucketPipelineSummary {
  uuid: string;
  build_number: number;
  status: BitbucketStatus;
  created_on: string;
  duration?: number;
  ref?: string;
  commit?: string;
}

export interface BitbucketPipelineStep {
  uuid: string;
  name?: string;
  started_on?: string;
  completed_on?: string;
  duration_in_seconds?: number;
}

export interface BitbucketPipelineDetail {
  pipeline: BitbucketPipelineSummary & { normalized_status: BitbucketStatus };
  steps: BitbucketPipelineStep[];
}

export interface ConnectPayload {
  user?: string;
  appPassword?: string;
  bearer?: string;
  defaultWorkspace?: string;
  label?: string;
}

export interface TriggerPayload {
  ref: string;
  refType?: 'branch' | 'tag';
}

export interface ImportedPipeline {
  name: string;
  image?: string;
  stages: Array<{ name: string; steps: string[] }>;
  warnings: string[];
}

export interface ImportPreview {
  preview: { pipeline: ImportedPipeline; yaml: string; source: string };
}

function getToken(): string | null {
  return localStorage.getItem('pushci_token');
}

export async function bbFetch<T>(path: string, opts?: RequestInit): Promise<T> {
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
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Bitbucket API ${res.status}`);
    }
    throw new Error(`Bitbucket API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export interface BitbucketBridgeClient {
  connect: (body: ConnectPayload) => Promise<BitbucketConnection>;
  listConnections: () => Promise<BitbucketConnection[]>;
  deleteConnection: (id: string) => Promise<void>;
  listWorkspaces: (id: string) => Promise<BitbucketWorkspace[]>;
  listRepos: (id: string, workspace: string) => Promise<BitbucketRepo[]>;
  listPipelines: (id: string, workspace: string, repo: string) => Promise<BitbucketPipelineSummary[]>;
  getPipeline: (id: string, workspace: string, repo: string, uuid: string) => Promise<BitbucketPipelineDetail>;
  triggerPipeline: (id: string, workspace: string, repo: string, body: TriggerPayload) => Promise<BitbucketPipelineSummary>;
  importPipeline: (body: { connectionId: string; workspace: string; repo: string; ref?: string }) => Promise<ImportPreview>;
}

export function useBitbucketBridge(): BitbucketBridgeClient {
  const connect = useCallback(async (body: ConnectPayload): Promise<BitbucketConnection> => {
    const { connection } = await bbFetch<{ connection: BitbucketConnection }>(
      '/api/bitbucket/connect',
      { method: 'POST', body: JSON.stringify(body) },
    );
    return connection;
  }, []);

  const listConnections = useCallback(async (): Promise<BitbucketConnection[]> => {
    const { connections } = await bbFetch<{ connections: BitbucketConnection[] }>('/api/bitbucket/connections');
    return connections;
  }, []);

  const deleteConnection = useCallback(async (id: string): Promise<void> => {
    await bbFetch<{ ok: boolean }>(`/api/bitbucket/connections/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }, []);

  const listWorkspaces = useCallback(async (id: string): Promise<BitbucketWorkspace[]> => {
    const { workspaces } = await bbFetch<{ workspaces: BitbucketWorkspace[] }>(
      `/api/bitbucket/connections/${encodeURIComponent(id)}/workspaces`,
    );
    return workspaces;
  }, []);

  const listRepos = useCallback(async (id: string, workspace: string): Promise<BitbucketRepo[]> => {
    const { repos } = await bbFetch<{ repos: BitbucketRepo[] }>(
      `/api/bitbucket/connections/${encodeURIComponent(id)}/workspaces/${encodeURIComponent(workspace)}/repos`,
    );
    return repos;
  }, []);

  const listPipelines = useCallback(async (id: string, workspace: string, repo: string) => {
    const { pipelines } = await bbFetch<{ pipelines: BitbucketPipelineSummary[] }>(
      `/api/bitbucket/bridge/${encodeURIComponent(id)}/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/pipelines`,
    );
    return pipelines;
  }, []);

  const getPipeline = useCallback(async (id: string, workspace: string, repo: string, uuid: string) => {
    return bbFetch<BitbucketPipelineDetail>(
      `/api/bitbucket/bridge/${encodeURIComponent(id)}/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/pipelines/${encodeURIComponent(uuid)}`,
    );
  }, []);

  const triggerPipeline = useCallback(async (id: string, workspace: string, repo: string, body: TriggerPayload) => {
    const data = await bbFetch<{ triggered: boolean; pipeline: BitbucketPipelineSummary }>(
      `/api/bitbucket/bridge/${encodeURIComponent(id)}/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/trigger`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    return data.pipeline;
  }, []);

  const importPipeline = useCallback(async (body: { connectionId: string; workspace: string; repo: string; ref?: string }) => {
    return bbFetch<ImportPreview>('/api/bitbucket/import', { method: 'POST', body: JSON.stringify(body) });
  }, []);

  return {
    connect, listConnections, deleteConnection,
    listWorkspaces, listRepos, listPipelines,
    getPipeline, triggerPipeline, importPipeline,
  };
}
