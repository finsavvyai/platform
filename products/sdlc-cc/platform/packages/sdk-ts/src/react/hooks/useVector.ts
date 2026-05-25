// Vector hook for React

import * as React from 'react';
import { useSDLC } from '../providers/SDLCProvider';
import type { VectorSearchRequest, VectorSearchResult } from '../../types';

export function useVector() {
  const { client } = useSDLC();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const search = React.useCallback(async (request: VectorSearchRequest): Promise<VectorSearchResult[]> => {
    if (!client) throw new Error('Client not initialized');
    setIsLoading(true);
    setError(null);
    try {
      return await client.vector.search(request);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  return { isLoading, error, search };
}
