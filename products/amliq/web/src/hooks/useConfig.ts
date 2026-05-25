import { useState, useEffect, useCallback } from 'react';
import { configApi, TenantConfigResponse } from '../api/config';

export function useConfig() {
  const [config, setConfig] = useState<TenantConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await configApi.get();
      setConfig(resp);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = useCallback(
    async (data: Partial<TenantConfigResponse>) => {
      const resp = await configApi.update(data);
      setConfig(resp);
      return resp;
    },
    [],
  );

  return { config, loading, error, refetch: fetchConfig, updateConfig };
}
