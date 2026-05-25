// Monitoring hook for React

import * as React from 'react';
import { useSDLC } from '../providers/SDLCProvider';
import type { HealthCheck } from '../../types';

export function useMonitoring() {
  const { client } = useSDLC();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const healthCheck = React.useCallback(async (): Promise<HealthCheck> => {
    if (!client) throw new Error('Client not initialized');
    setIsLoading(true);
    setError(null);
    try {
      return await client.monitoring.healthCheck();
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  return { isLoading, error, healthCheck };
}
