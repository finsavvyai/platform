import { useState, useEffect, useCallback } from 'react';
import { alertsApi } from '../api/alerts';
import type { Alert } from '../types';

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await alertsApi.list();
      if (!resp) { setAlerts([]); return; }
      setAlerts(Array.isArray(resp) ? resp : resp?.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const resolve = useCallback(
    async (id: string, resolution: string, notes: string) => {
      await alertsApi.resolve(id, { resolution, notes });
      await fetchAlerts();
    },
    [fetchAlerts],
  );

  return { alerts, loading, error, refetch: fetchAlerts, resolve };
}
