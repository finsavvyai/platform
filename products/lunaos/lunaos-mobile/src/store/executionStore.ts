/**
 * Execution state — manages current SSE streaming and history.
 */

import { create } from 'zustand';
import { executeAgentStream } from '../api/sse';
import { listExecutions } from '../api/agents';
import { logger } from '../utils/logger';
import type { Execution, ExecuteParams } from '../types/api';

interface ExecutionState {
  output: string;
  isStreaming: boolean;
  streamError: string | null;
  executionId: string | null;
  durationMs: number | null;
  ragSources: number | null;
  history: Execution[];
  isLoadingHistory: boolean;
  run: (params: ExecuteParams) => Promise<void>;
  reset: () => void;
  fetchHistory: () => Promise<void>;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  output: '',
  isStreaming: false,
  streamError: null,
  executionId: null,
  durationMs: null,
  ragSources: null,
  history: [],
  isLoadingHistory: false,

  run: async (params) => {
    set({
      output: '',
      isStreaming: true,
      streamError: null,
      executionId: null,
      durationMs: null,
      ragSources: null,
    });

    try {
      await executeAgentStream(params, {
        onToken: (text) => {
          set((s) => ({ output: s.output + text }));
        },
        onRag: (sources) => {
          set({ ragSources: sources });
        },
        onDone: (executionId, duration) => {
          set({ executionId, durationMs: duration, isStreaming: false });
        },
        onError: (error) => {
          logger.error('Execution', error);
          set({ streamError: error, isStreaming: false });
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Execution failed';
      set({ streamError: msg, isStreaming: false });
    }
  },

  reset: () =>
    set({
      output: '',
      isStreaming: false,
      streamError: null,
      executionId: null,
      durationMs: null,
      ragSources: null,
    }),

  fetchHistory: async () => {
    set({ isLoadingHistory: true });
    try {
      const res = await listExecutions(50, 0);
      set({ history: res.executions, isLoadingHistory: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load history';
      logger.error('ExecutionStore', msg);
      set({ isLoadingHistory: false });
    }
  },
}));
