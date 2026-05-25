import { useState, useEffect, useCallback, useRef } from 'react';
import { api, RunSummary, RunDetail } from './useApi';
import { CIRun } from '../data/types';

function toLocalRun(r: RunSummary): CIRun {
  const secs = Math.round((r.duration_ms ?? 0) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return {
    id: r.id,
    repo: r.repo,
    branch: r.branch,
    commitSha: r.sha.slice(0, 7),
    commitMsg: r.commit_message || '',
    status: r.status === 'pending' ? 'running' : r.status === 'cancelled' ? 'cancelled' : r.status,
    duration: `${m}m ${s}s`,
    timestamp: r.created_at,
    checks: [],
  };
}

function detailToLocal(r: RunDetail): CIRun {
  const base = toLocalRun(r);
  return {
    ...base,
    checks: r.checks.map(c => ({
      name: c.name,
      status: c.passed ? 'passed' : 'failed',
      duration: `${Math.round(c.duration_ms / 1000)}s`,
      output: c.output,
    })),
    logs: r.logs,
  };
}

const POLL_MS = 10_000;

export function useRuns() {
  const [runs, setRuns] = useState<CIRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>();

  const refresh = useCallback(async () => {
    try {
      const data = await api.getRuns();
      setRuns(data.map(toLocalRun));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'API unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer.current);
  }, [refresh]);

  const hasActive = runs.some(r => r.status === 'running');

  return { runs, loading, error, refresh, hasActive };
}

const TERMINAL_STATUSES = new Set(['passed', 'failed', 'cancelled']);

export function useRunDetail(id: string | undefined) {
  const [run, setRun] = useState<CIRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>();

  const fetch = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getRun(id);
      setRun(detailToLocal(data));
      setError(null);
    } catch (err) {
      // Only clear the run on the initial 404; transient 5xx/timeout should
      // keep the last-known state and surface a soft error.
      setRun((prev) => (prev ? prev : null));
      const message = err instanceof Error ? err.message : 'Run not available';
      setError(prev => (prev ? prev : message));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetch();
    timer.current = setInterval(fetch, POLL_MS);
    return () => clearInterval(timer.current);
  }, [fetch]);

  // Stop polling once the run reaches a terminal state.
  useEffect(() => {
    if (run && TERMINAL_STATUSES.has(run.status) && timer.current) {
      clearInterval(timer.current);
      timer.current = undefined;
    }
  }, [run?.status]);

  return { run, loading, error, refresh: fetch };
}
