// RAG hook for React

import { useState, useCallback, useRef } from 'react';
import { useSDLC } from '../providers/SDLCProvider';
import { RAGQuery, RAGResponse, RAGQueryUpdate } from '../../types';

export function useRAG() {
  const { client } = useSDLC();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const query = useCallback(async (queryData: RAGQuery): Promise<RAGResponse> => {
    if (!client) throw new Error('Client not initialized');

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const response = await client.rag.query({
        ...queryData,
        signal: abortControllerRef.current.signal
      });

      setIsLoading(false);
      return response;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setIsLoading(false);
        return Promise.reject(new Error('Query cancelled'));
      }

      setIsLoading(false);
      setError(err);
      throw err;
    }
  }, [client]);

  const streamQuery = useCallback(async function* (
    queryData: RAGQuery
  ): AsyncGenerator<RAGQueryUpdate, void, unknown> {
    if (!client) throw new Error('Client not initialized');

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const stream = client.rag.streamQuery({
        ...queryData,
        signal: abortControllerRef.current.signal
      });

      for await (const update of stream) {
        yield update;

        if (update.status === 'completed' || update.status === 'failed') {
          setIsLoading(false);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      setError(err);
      throw err;
    }
  }, [client]);

  const cancelQuery = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    query,
    streamQuery,
    isLoading,
    error,
    cancelQuery,
    clearError
  };
}
