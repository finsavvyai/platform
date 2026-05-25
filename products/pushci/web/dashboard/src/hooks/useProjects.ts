import { useState, useEffect, useCallback } from 'react';
import { api, Project } from './useApi';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
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
