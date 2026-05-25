import { useState, useCallback } from 'react';
import { screeningApi, ScreenPayload } from '../api/screening';
import type { ScreenResponse } from '../types';

export function useScreening() {
  const [result, setResult] = useState<ScreenResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const screen = useCallback(async (data: ScreenPayload) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await screeningApi.screen(data);
      setResult(resp);
      return resp;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, screen, clear };
}
