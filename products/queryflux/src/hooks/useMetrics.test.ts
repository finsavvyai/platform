import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';

const { mockApi, mockQueryKeys } = vi.hoisted(() => ({
  mockApi: {
    metrics: {
      getLatest: vi.fn(),
      getHistory: vi.fn(),
      getAverage: vi.fn(),
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      collect: vi.fn(),
    },
  },
  mockQueryKeys: {
    metrics: {
      latest: (connectionId: string) => ['metrics', 'latest', connectionId] as const,
      history: (connectionId: string, timeRange: string) =>
        ['metrics', 'history', connectionId, timeRange] as const,
      average: (connectionId: string, timeRange: string) =>
        ['metrics', 'average', connectionId, timeRange] as const,
    },
  },
}));

vi.mock('../services/enhanced-api-services', () => ({
  api: mockApi,
  queryKeys: mockQueryKeys,
}));

import { useDashboardMetrics, useLatestMetrics } from './useMetrics';
import type { DatabaseMetrics } from './metricsTypes';

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

function createMetric(connectionID: string): DatabaseMetrics {
  return {
    id: `metric-${connectionID}`,
    connectionID,
    cpuUsage: 10,
    memoryUsage: 20,
    diskUsage: 30,
    activeConnections: 4,
    queriesPerSecond: 5,
    averageQueryTime: 6,
    timestamp: '2026-04-02T00:00:00.000Z',
  };
}

describe('useMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('fetches the latest metrics for a connection', async () => {
    const metric = createMetric('conn-1');
    mockApi.metrics.getLatest.mockResolvedValue(metric);

    const { result } = renderHook(() => useLatestMetrics('conn-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApi.metrics.getLatest).toHaveBeenCalledWith('conn-1');
    expect(result.current.metrics).toEqual(metric);
  });

  it('builds a dashboard map and keeps failed connections as null', async () => {
    const metric = createMetric('conn-1');

    mockApi.metrics.getLatest.mockImplementation(async (connectionId: string) => {
      if (connectionId === 'conn-2') {
        throw new Error('fetch failed');
      }

      return metric;
    });

    const { result } = renderHook(
      () => useDashboardMetrics(['conn-1', 'conn-2']),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.metricsMap).toEqual({
      'conn-1': metric,
      'conn-2': null,
    });
    expect(console.error).toHaveBeenCalledWith(
      'Failed to fetch metrics for conn-2:',
      expect.any(Error)
    );
  });
});
