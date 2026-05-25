import { apiFetch } from './client';
import type { ApiResponse } from '../../types';

interface DeviceFilters {
  provider?: string;
  platform?: string;
  status?: string;
}

export async function getDevices(
  filters?: DeviceFilters,
): Promise<ApiResponse<unknown[]>> {
  const params = new URLSearchParams();
  if (filters?.provider) params.set('provider', filters.provider);
  if (filters?.platform) params.set('platform', filters.platform);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return apiFetch(`/api/devices${qs ? `?${qs}` : ''}`);
}

export async function getDevice(id: string): Promise<ApiResponse<unknown>> {
  return apiFetch(`/api/devices/${id}`);
}

export async function getProviders(): Promise<ApiResponse<unknown[]>> {
  return apiFetch('/api/devices/providers');
}

export async function reserveDevice(id: string): Promise<ApiResponse<void>> {
  return apiFetch(`/api/devices/${id}/reserve`, { method: 'POST' });
}

export async function releaseDevice(
  reservationId: string,
): Promise<ApiResponse<void>> {
  return apiFetch(`/api/devices/reservations/${reservationId}`, {
    method: 'DELETE',
  });
}
