import { useState, useEffect, useCallback } from 'react';
import { api, Project as ApiProject } from './useApi';
import { Project } from '../data/types';
import { sampleProjects } from '../data/sampleProjects';

function toLocalProject(p: ApiProject): Project {
  return {
    id: p.id,
    repo: p.repo,
    platform: p.platform,
    lastRunStatus: p.last_run_status === 'passed' ? 'passed'
      : p.last_run_status === 'failed' ? 'failed' : 'running',
    connectedDate: p.created_at.slice(0, 10),
    url: `https://${p.platform}.com/${p.repo}`,
  };
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(sampleProjects);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getProjects();
      setProjects(data.map(toLocalProject));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'API unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { projects, loading, error, refresh };
}
