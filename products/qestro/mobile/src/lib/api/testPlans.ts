import { apiFetch } from './client';
import type { ApiResponse, TestPlan, PaginatedResponse } from '../../types';

interface TestPlanFilters {
  projectId?: string;
  status?: string;
}

export async function getTestPlans(
  filters?: TestPlanFilters,
): Promise<ApiResponse<PaginatedResponse<TestPlan>>> {
  const params = new URLSearchParams();
  if (filters?.projectId) params.set('projectId', filters.projectId);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return apiFetch(`/api/test-plans${qs ? `?${qs}` : ''}`);
}

export async function getTestPlan(id: string): Promise<ApiResponse<TestPlan>> {
  return apiFetch(`/api/test-plans/${id}`);
}

export async function createTestPlan(
  data: Omit<TestPlan, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ApiResponse<TestPlan>> {
  return apiFetch('/api/test-plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTestPlan(
  id: string,
  data: Partial<TestPlan>,
): Promise<ApiResponse<TestPlan>> {
  return apiFetch(`/api/test-plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteTestPlan(id: string): Promise<ApiResponse<void>> {
  return apiFetch(`/api/test-plans/${id}`, { method: 'DELETE' });
}

export async function runTestPlan(id: string): Promise<ApiResponse<void>> {
  return apiFetch(`/api/test-plans/${id}/run`, { method: 'POST' });
}
