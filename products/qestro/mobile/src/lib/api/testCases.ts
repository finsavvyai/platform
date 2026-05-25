import { apiFetch } from './client';
import type { ApiResponse, TestCase, PaginatedResponse } from '../../types';

interface TestCaseFilters {
  projectId?: string;
  status?: string;
}

export async function getTestCases(
  filters?: TestCaseFilters,
): Promise<ApiResponse<PaginatedResponse<TestCase>>> {
  const params = new URLSearchParams();
  if (filters?.projectId) params.set('projectId', filters.projectId);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return apiFetch(`/api/test-cases${qs ? `?${qs}` : ''}`);
}

export async function getTestCase(id: string): Promise<ApiResponse<TestCase>> {
  return apiFetch(`/api/test-cases/${id}`);
}

export async function createTestCase(
  data: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ApiResponse<TestCase>> {
  return apiFetch('/api/test-cases', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTestCase(
  id: string,
  data: Partial<TestCase>,
): Promise<ApiResponse<TestCase>> {
  return apiFetch(`/api/test-cases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTestCase(id: string): Promise<ApiResponse<void>> {
  return apiFetch(`/api/test-cases/${id}`, { method: 'DELETE' });
}
