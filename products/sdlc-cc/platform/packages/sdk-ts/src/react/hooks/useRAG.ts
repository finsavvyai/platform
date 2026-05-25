// RAG hook for React

import * as React from 'react';
import { useSDLC } from '../providers/SDLCProvider';
import type { RAGQueryRequest, RAGQueryResponse } from '../../rag/types';

export function useRAG() {
  const { client } = useSDLC();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const query = React.useCallback(async (queryData: RAGQueryRequest): Promise<RAGQueryResponse> => {
    if (!client) throw new Error('Client not initialized');

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const response = await client.rag.query(queryData);
      setIsLoading(false);
      return response;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setIsLoading(false);
        return Promise.reject(new Error('Query cancelled'));
      }

      setIsLoading(false);
      setError(err as Error);
      throw err;
    }
  }, [client]);

  const cancelQuery = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return {
    query,
    isLoading,
    error,
    cancelQuery,
    clearError,
  };
}
