import { apiFetch } from './client';
import type { ApiResponse, Mission } from '../../types';

interface MissionFilters {
  status?: string;
  type?: string;
}

export async function getMissions(
  filters?: MissionFilters,
): Promise<ApiResponse<Mission[]>> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.type) params.set('type', filters.type);
  const qs = params.toString();
  return apiFetch(`/api/missions${qs ? `?${qs}` : ''}`);
}

export async function getMission(id: string): Promise<ApiResponse<Mission>> {
  return apiFetch(`/api/missions/${id}`);
}

export async function createMission(data: {
  type: 'TICKET' | 'SCOUT' | 'CONCIERGE';
  title: string;
  description?: string;
}): Promise<ApiResponse<Mission>> {
  return apiFetch('/api/missions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteMission(id: string): Promise<ApiResponse<void>> {
  return apiFetch(`/api/missions/${id}`, { method: 'DELETE' });
}

export async function cancelMission(id: string): Promise<ApiResponse<void>> {
  return apiFetch(`/api/missions/${id}/cancel`, { method: 'POST' });
}

export async function getMissionStats(): Promise<ApiResponse<unknown>> {
  return apiFetch('/api/missions/stats/summary');
}
