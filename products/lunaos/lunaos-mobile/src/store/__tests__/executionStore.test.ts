/**
 * Tests for execution Zustand store.
 * Validates run, stream, reset, fetchHistory.
 */

import { act } from '@testing-library/react-native';
import { useExecutionStore } from '../executionStore';
import * as sseModule from '../../api/sse';
import * as agentsApi from '../../api/agents';
import {
  mockExecuteParams,
  mockExecutionsResponse,
} from '../../test-utils/mocks/fixtures';

jest.mock('../../api/sse');
jest.mock('../../api/agents');
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockSSE = sseModule as jest.Mocked<typeof sseModule>;
const mockAgents = agentsApi as jest.Mocked<typeof agentsApi>;

beforeEach(() => {
  useExecutionStore.setState({
    output: '',
    isStreaming: false,
    streamError: null,
    executionId: null,
    durationMs: null,
    ragSources: null,
    history: [],
    isLoadingHistory: false,
  });
  jest.clearAllMocks();
});

describe('useExecutionStore', () => {
  describe('run', () => {
    it('sets isStreaming during execution', async () => {
      mockSSE.executeAgentStream.mockImplementation(async (_params, cb) => {
        expect(useExecutionStore.getState().isStreaming).toBe(true);
        cb.onToken('Hello');
        cb.onDone('exec-1', 1000);
      });

      await act(async () => {
        await useExecutionStore.getState().run(mockExecuteParams);
      });

      expect(useExecutionStore.getState().isStreaming).toBe(false);
    });

    it('accumulates tokens into output', async () => {
      mockSSE.executeAgentStream.mockImplementation(async (_params, cb) => {
        cb.onToken('Hello');
        cb.onToken(' World');
        cb.onDone('exec-1', 500);
      });

      await act(async () => {
        await useExecutionStore.getState().run(mockExecuteParams);
      });

      expect(useExecutionStore.getState().output).toBe('Hello World');
    });

    it('stores executionId and duration on done', async () => {
      mockSSE.executeAgentStream.mockImplementation(async (_params, cb) => {
        cb.onDone('exec-42', 2500);
      });

      await act(async () => {
        await useExecutionStore.getState().run(mockExecuteParams);
      });

      const state = useExecutionStore.getState();
      expect(state.executionId).toBe('exec-42');
      expect(state.durationMs).toBe(2500);
    });

    it('stores ragSources from rag callback', async () => {
      mockSSE.executeAgentStream.mockImplementation(async (_params, cb) => {
        cb.onRag?.(5, 200);
        cb.onDone('exec-3', 1000);
      });

      await act(async () => {
        await useExecutionStore.getState().run(mockExecuteParams);
      });

      expect(useExecutionStore.getState().ragSources).toBe(5);
    });

    it('sets streamError on error callback', async () => {
      mockSSE.executeAgentStream.mockImplementation(async (_params, cb) => {
        cb.onError('Agent timeout');
      });

      await act(async () => {
        await useExecutionStore.getState().run(mockExecuteParams);
      });

      const state = useExecutionStore.getState();
      expect(state.streamError).toBe('Agent timeout');
      expect(state.isStreaming).toBe(false);
    });

    it('sets streamError on thrown exception', async () => {
      mockSSE.executeAgentStream.mockRejectedValue(new Error('Network down'));

      await act(async () => {
        await useExecutionStore.getState().run(mockExecuteParams);
      });

      expect(useExecutionStore.getState().streamError).toBe('Network down');
      expect(useExecutionStore.getState().isStreaming).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears all execution state', () => {
      useExecutionStore.setState({
        output: 'some output',
        isStreaming: true,
        streamError: 'err',
        executionId: 'e1',
        durationMs: 1000,
        ragSources: 3,
      });

      act(() => {
        useExecutionStore.getState().reset();
      });

      const state = useExecutionStore.getState();
      expect(state.output).toBe('');
      expect(state.isStreaming).toBe(false);
      expect(state.streamError).toBeNull();
      expect(state.executionId).toBeNull();
      expect(state.durationMs).toBeNull();
      expect(state.ragSources).toBeNull();
    });
  });

  describe('fetchHistory', () => {
    it('populates history on success', async () => {
      mockAgents.listExecutions.mockResolvedValue(mockExecutionsResponse);

      await act(async () => {
        await useExecutionStore.getState().fetchHistory();
      });

      expect(useExecutionStore.getState().history).toEqual(
        mockExecutionsResponse.executions,
      );
      expect(useExecutionStore.getState().isLoadingHistory).toBe(false);
    });

    it('handles fetch error gracefully', async () => {
      mockAgents.listExecutions.mockRejectedValue(new Error('Offline'));

      await act(async () => {
        await useExecutionStore.getState().fetchHistory();
      });

      expect(useExecutionStore.getState().history).toEqual([]);
      expect(useExecutionStore.getState().isLoadingHistory).toBe(false);
    });
  });
});
