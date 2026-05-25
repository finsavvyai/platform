import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchAlertSummary } from '../api/ai';
import type { Alert } from '../types';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; summary: string; model: string }
  | { status: 'error'; message: string };

export function useAlertSummary(alert: Alert) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const generate = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const result = await fetchAlertSummary(alert);
      if (mountedRef.current) {
        setState({ status: 'done', summary: result.summary, model: result.model });
      }
    } catch (err) {
      if (mountedRef.current) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to generate summary',
        });
      }
    }
  }, [alert]);

  return { state, generate };
}
