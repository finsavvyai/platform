import { useState, useEffect, useCallback, useRef } from 'react';
import { api, RunSummary, RunDetail } from './useApi';
import { CIRun } from '../data/types';
import { sampleRuns } from '../data/sampleRuns';

function toLocalRun(r: RunSummary): CIRun {
  const secs = Math.round(r.duration_ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return {
    id: r.id,
    repo: r.repo,
    branch: r.branch,
    commitSha: r.sha.slice(0, 7),
    commitMsg: '',
    status: r.status === 'pending' ? 'running' : r.status,
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
  };
}

const POLL_MS = 10_000;

export function useRuns() {
  const [runs, setRuns] = useState<CIRun[]>(sampleRuns);
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
    } catch {
      setRun(null);
      setError('Run not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetch();
    timer.current = setInterval(fetch, POLL_MS);
    return () => clearInterval(timer.current);
  }, [fetch]);

  return { run, loading, error, refresh: fetch };
}
