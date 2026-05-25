import { useState, useEffect } from 'react';
import { analyticsApi } from '../api/analytics';
import type { DashboardAnalytics } from '../types';

export function useAnalytics() {
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    analyticsApi
      .getDashboard()
      .then((data) => { if (mounted) setAnalytics(data); })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return { analytics, loading, error };
}
