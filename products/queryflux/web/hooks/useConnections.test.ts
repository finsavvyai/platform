import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockApi, mockStore } = vi.hoisted(() => ({
  mockApi: {
    connections: {
      getAll: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      test: vi.fn(),
    },
  },
  mockStore: {
    setConnections: vi.fn(),
    addConnection: vi.fn(),
    updateConnection: vi.fn(),
    removeConnection: vi.fn(),
  },
}));

vi.mock('../services/api', () => ({ api: mockApi }));

vi.mock('../stores/connectionStore', () => ({
  useConnectionStore: vi.fn((selector) => (selector ? selector(mockStore) : mockStore)),
}));

import {
  connectionKeys,
  useConnections,
  useConnection,
  useCreateConnection,
  useUpdateConnection,
  useDeleteConnection,
  useTestConnection,
} from './useConnections';

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

describe('useConnections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('connectionKeys', () => {
    it('should return correct all key', () => {
      expect(connectionKeys.all).toEqual(['connections']);
    });

    it('should return correct detail key', () => {
      expect(connectionKeys.detail('conn-1')).toEqual(['connections', 'conn-1']);
    });

    it('should return correct status key', () => {
      expect(connectionKeys.status('conn-1')).toEqual(['connections', 'conn-1', 'status']);
    });
  });

  describe('useConnections hook', () => {
    it('should fetch all connections and sync to store', async () => {
      const conns = [{ id: 'c1', name: 'DB', type: 'postgresql' }];
      mockApi.connections.getAll.mockResolvedValue(conns);
      const { result } = renderHook(() => useConnections(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApi.connections.getAll).toHaveBeenCalled();
      expect(mockStore.setConnections).toHaveBeenCalledWith(conns);
    });
  });

  describe('useConnection hook', () => {
    it('should fetch a connection by id', async () => {
      mockApi.connections.getById.mockResolvedValue({ id: 'c1', name: 'Test' });
      const { result } = renderHook(() => useConnection('c1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApi.connections.getById).toHaveBeenCalledWith('c1');
    });
  });

  describe('useCreateConnection hook', () => {
    it('should call api.create and sync store onSuccess', async () => {
      const newConn = { id: 'c2', name: 'New', type: 'mysql' };
      mockApi.connections.create.mockResolvedValue(newConn);
      const { result } = renderHook(() => useCreateConnection(), { wrapper: createWrapper() });
      await act(async () => {
        result.current.mutate({ name: 'New', type: 'mysql' });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockStore.addConnection).toHaveBeenCalledWith(newConn);
    });
  });

  describe('useUpdateConnection hook', () => {
    it('should call api.update and sync store onSuccess', async () => {
      const updated = { id: 'c1', name: 'Updated', type: 'postgresql' };
      mockApi.connections.update.mockResolvedValue(updated);
      const { result } = renderHook(() => useUpdateConnection(), { wrapper: createWrapper() });
      await act(async () => {
        result.current.mutate({ id: 'c1', updates: { name: 'Updated' } });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockStore.updateConnection).toHaveBeenCalledWith('c1', updated);
    });
  });

  describe('useDeleteConnection hook', () => {
    it('should call api.delete and sync store onSuccess', async () => {
      mockApi.connections.delete.mockResolvedValue(undefined);
      const { result } = renderHook(() => useDeleteConnection(), { wrapper: createWrapper() });
      await act(async () => {
        result.current.mutate('c1');
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockStore.removeConnection).toHaveBeenCalledWith('c1');
    });
  });

  describe('useTestConnection hook', () => {
    it('should call api.test on mutate', async () => {
      mockApi.connections.test.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useTestConnection(), { wrapper: createWrapper() });
      await act(async () => {
        result.current.mutate({ name: 'Test', type: 'postgresql' });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApi.connections.test).toHaveBeenCalledWith({ name: 'Test', type: 'postgresql' });
    });
  });
});
