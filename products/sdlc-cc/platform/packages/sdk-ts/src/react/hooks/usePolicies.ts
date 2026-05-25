// Policies hook for React

import * as React from 'react';
import { useSDLC } from '../providers/SDLCProvider';
import type { Policy } from '../../types';

export function usePolicies() {
  const { client } = useSDLC();
  const [policies, setPolicies] = React.useState<Policy[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const list = React.useCallback(async () => {
    if (!client) throw new Error('Client not initialized');
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.policies.list();
      setPolicies(result);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  return { policies, isLoading, error, list };
}
