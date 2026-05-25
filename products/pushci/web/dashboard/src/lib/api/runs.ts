import { apiFetch } from '../api-client';
import type { CheckResult, RunDetail, RunRecord, RunSummary } from './types';

export function normalizeRun(run: RunRecord): RunSummary {
  return {
    id: run.id,
    repo: run.repo,
    branch: run.branch,
    sha: run.sha,
    status: run.status,
    duration_ms: run.duration_ms ?? 0,
    created_at: run.created_at ?? run.started_at ?? run.finished_at ?? new Date().toISOString(),
    commit_message: run.commit_message ?? undefined,
    trigger: run.trigger ?? undefined,
  };
}

export function normalizeRunDetail(run: RunRecord): RunDetail {
  let checks: CheckResult[] = [];
  if (run.checks_json) {
    try {
      checks = JSON.parse(run.checks_json) as CheckResult[];
    } catch {
      checks = [];
    }
  }
  return {
    ...normalizeRun(run),
    checks,
    logs: run.logs ?? '',
  };
}

export const runsApi = {
  list: async (): Promise<RunSummary[]> => {
    const data = await apiFetch<{ runs: RunRecord[] }>('/api/runs');
    return data.runs.map(normalizeRun);
  },
  get: async (id: string): Promise<RunDetail> => {
    const data = await apiFetch<{ run: RunRecord }>(`/api/runs/${id}`);
    return normalizeRunDetail(data.run);
  },
  getLogs: async (id: string): Promise<string> => {
    const data = await apiFetch<{ runId: string; logs: string }>(`/api/runs/${id}/logs`);
    return data.logs;
  },
  rerun: (id: string) =>
    apiFetch<{ run: RunRecord }>(`/api/runs/${id}/rerun`, { method: 'POST' }),
  cancel: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/runs/${id}/cancel`, { method: 'POST' }),
};
