import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useAlerts } from './useAlerts';
import { alertsApi } from '../api/alerts';
import type { Alert } from '../types';

vi.mock('../api/alerts', () => ({
  alertsApi: {
    list: vi.fn(),
    resolve: vi.fn(),
  },
}));

const makeAlert = (overrides: Partial<Alert> = {}): Alert => ({
  id: 'a1',
  entity: { name: { fullName: 'John Doe', firstName: 'John', lastName: 'Doe' }, type: 'individual', nationality: 'US' },
  status: 'open',
  priority: 'high',
  riskLevel: 'high',
  matchedCount: 2,
  evidenceCount: 1,
  notes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
} as Alert);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useAlerts', () => {
  it('fetches alerts on mount', async () => {
    const alert = makeAlert();
    vi.mocked(alertsApi.list).mockResolvedValue({ data: [alert], total: 1 } as any);
    const { result } = renderHook(() => useAlerts());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0].id).toBe('a1');
  });

  it('handles array response from API', async () => {
    const alert = makeAlert({ id: 'a2' });
    vi.mocked(alertsApi.list).mockResolvedValue([alert] as any);
    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.alerts[0].id).toBe('a2');
  });

  it('sets error on fetch failure', async () => {
    vi.mocked(alertsApi.list).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('Network error');
    expect(result.current.alerts).toHaveLength(0);
  });

  it('handles null response', async () => {
    vi.mocked(alertsApi.list).mockResolvedValue(null as any);
    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.alerts).toHaveLength(0);
  });

  it('refetch reloads alerts', async () => {
    vi.mocked(alertsApi.list)
      .mockResolvedValueOnce({ data: [makeAlert({ id: 'a1' })], total: 1 } as any)
      .mockResolvedValueOnce({ data: [makeAlert({ id: 'a2' })], total: 1 } as any);
    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.alerts[0].id).toBe('a1');
    result.current.refetch();
    await waitFor(() => expect(result.current.alerts[0].id).toBe('a2'));
  });

  it('resolve calls api and refetches', async () => {
    const alert = makeAlert();
    vi.mocked(alertsApi.list).mockResolvedValue({ data: [alert], total: 1 } as any);
    vi.mocked(alertsApi.resolve).mockResolvedValue(alert);
    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.resolve('a1', 'false_positive', 'no match');
    expect(alertsApi.resolve).toHaveBeenCalledWith('a1', { resolution: 'false_positive', notes: 'no match' });
    expect(alertsApi.list).toHaveBeenCalledTimes(2);
  });
});
