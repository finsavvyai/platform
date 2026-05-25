import { apiFetch } from './client';
import type { ApiResponse, TestCycle, PaginatedResponse } from '../../types';

interface CycleFilters {
  projectId?: string;
  status?: string;
  environment?: string;
}

export async function getCycles(
  filters?: CycleFilters,
): Promise<ApiResponse<PaginatedResponse<TestCycle>>> {
  const params = new URLSearchParams();
  if (filters?.projectId) params.set('projectId', filters.projectId);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.environment) params.set('environment', filters.environment);
  const qs = params.toString();
  return apiFetch(`/api/cycles${qs ? `?${qs}` : ''}`);
}

export async function getCycle(id: string): Promise<ApiResponse<TestCycle>> {
  return apiFetch(`/api/cycles/${id}`);
}

export async function createCycle(
  data: Omit<TestCycle, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ApiResponse<TestCycle>> {
  return apiFetch('/api/cycles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCycle(
  id: string,
  data: Partial<TestCycle>,
): Promise<ApiResponse<TestCycle>> {
  return apiFetch(`/api/cycles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteCycle(id: string): Promise<ApiResponse<void>> {
  return apiFetch(`/api/cycles/${id}`, { method: 'DELETE' });
}

export async function getCycleStats(): Promise<ApiResponse<unknown>> {
  return apiFetch('/api/cycles/stats/summary');
}
