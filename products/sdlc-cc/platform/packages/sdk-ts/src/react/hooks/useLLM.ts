// LLM hook for React

import * as React from 'react';
import { useSDLC } from '../providers/SDLCProvider';
import type { LLMRequest, LLMResponse } from '../../types';

export function useLLM() {
  const { client } = useSDLC();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const chat = React.useCallback(async (request: LLMRequest): Promise<LLMResponse> => {
    if (!client) throw new Error('Client not initialized');
    setIsLoading(true);
    setError(null);
    try {
      return await client.llm.chat(request);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const completion = React.useCallback(async (request: LLMRequest): Promise<LLMResponse> => {
    if (!client) throw new Error('Client not initialized');
    setIsLoading(true);
    setError(null);
    try {
      return await client.llm.completion(request);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  return { isLoading, error, chat, completion };
}
