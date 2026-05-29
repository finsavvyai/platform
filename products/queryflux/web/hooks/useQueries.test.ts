import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockApi, mockStore } = vi.hoisted(() => ({
  mockApi: {
    queries: {
      getAll: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      execute: vi.fn(),
    },
  },
  mockStore: {
    setSavedQueries: vi.fn(),
    addSavedQuery: vi.fn(),
    updateSavedQuery: vi.fn(),
    removeSavedQuery: vi.fn(),
    setIsExecuting: vi.fn(),
    setCurrentResult: vi.fn(),
    setCurrentError: vi.fn(),
    addToHistory: vi.fn(),
  },
}));

vi.mock('../services/api', () => ({ api: mockApi }));

vi.mock('../stores/queryStore', () => ({
  useQueryStore: vi.fn((selector) => (selector ? selector(mockStore) : mockStore)),
}));

import {
  queryKeys,
  useQueries,
  useQueryById,
  useSaveQuery,
  useUpdateQuery,
  useDeleteQuery,
  useExecuteQuery,
} from './useQueries';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queryKeys', () => {
    it('should return correct all key', () => {
      expect(queryKeys.all).toEqual(['queries']);
    });

    it('should return correct detail key', () => {
      expect(queryKeys.detail('q-1')).toEqual(['queries', 'q-1']);
    });
  });

  describe('useQueries hook', () => {
    it('should fetch all queries and sync to store', async () => {
      const queries = [{ id: 'q1', sql: 'SELECT 1', connectionId: 'c1' }];
      mockApi.queries.getAll.mockResolvedValue(queries);
      const { result } = renderHook(() => useQueries(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApi.queries.getAll).toHaveBeenCalled();
      expect(mockStore.setSavedQueries).toHaveBeenCalledWith(queries);
    });
  });

  describe('useQueryById hook', () => {
    it('should fetch a query by id', async () => {
      mockApi.queries.getById.mockResolvedValue({ id: 'q1', sql: 'SELECT 1' });
      const { result } = renderHook(() => useQueryById('q1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApi.queries.getById).toHaveBeenCalledWith('q1');
    });
  });

  describe('useSaveQuery hook', () => {
    it('should call api.create and sync store onSuccess', async () => {
      const newQuery = { id: 'q2', sql: 'SELECT 2', connectionId: 'c1' };
      mockApi.queries.create.mockResolvedValue(newQuery);
      const { result } = renderHook(() => useSaveQuery(), { wrapper: createWrapper() });
      await act(async () => {
        result.current.mutate({ sql: 'SELECT 2', connectionId: 'c1' });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockStore.addSavedQuery).toHaveBeenCalledWith(newQuery);
    });
  });

  describe('useUpdateQuery hook', () => {
    it('should call api.update and sync store onSuccess', async () => {
      const updated = { id: 'q1', sql: 'SELECT updated', connectionId: 'c1' };
      mockApi.queries.update.mockResolvedValue(updated);
      const { result } = renderHook(() => useUpdateQuery(), { wrapper: createWrapper() });
      await act(async () => {
        result.current.mutate({ id: 'q1', updates: { sql: 'SELECT updated' } });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockStore.updateSavedQuery).toHaveBeenCalledWith('q1', updated);
    });
  });

  describe('useDeleteQuery hook', () => {
    it('should call api.delete and sync store onSuccess', async () => {
      mockApi.queries.delete.mockResolvedValue(undefined);
      const { result } = renderHook(() => useDeleteQuery(), { wrapper: createWrapper() });
      await act(async () => {
        result.current.mutate('q1');
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockStore.removeSavedQuery).toHaveBeenCalledWith('q1');
    });
  });

  describe('useExecuteQuery hook', () => {
    it('should set executing state and store result on success', async () => {
      const execResult = { columns: ['id'], rows: [{ id: 1 }], rowCount: 1, executionTime: 5 };
      mockApi.queries.execute.mockResolvedValue(execResult);
      const { result } = renderHook(() => useExecuteQuery(), { wrapper: createWrapper() });
      await act(async () => {
        result.current.mutate({ sql: 'SELECT 1', connectionId: 'c1' });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockStore.setIsExecuting).toHaveBeenCalledWith(true);
      expect(mockStore.setCurrentResult).toHaveBeenCalledWith(execResult);
      expect(mockStore.addToHistory).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'SELECT 1', connectionId: 'c1', result: execResult })
      );
      expect(mockStore.setIsExecuting).toHaveBeenCalledWith(false);
    });

    it('should store error on failure', async () => {
      mockApi.queries.execute.mockRejectedValue(new Error('timeout'));
      const { result } = renderHook(() => useExecuteQuery(), { wrapper: createWrapper() });
      await act(async () => {
        result.current.mutate({ sql: 'BAD SQL', connectionId: 'c1' });
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(mockStore.setCurrentError).toHaveBeenCalledWith('timeout');
      expect(mockStore.addToHistory).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'BAD SQL', connectionId: 'c1', error: 'timeout' })
      );
      expect(mockStore.setIsExecuting).toHaveBeenCalledWith(false);
    });
  });
});
