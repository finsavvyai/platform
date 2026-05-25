import { apiFetch } from './client';
import type { ApiResponse, Exploration, ExplorationFinding } from '../../types';

export async function getExplorations(
  status?: string,
): Promise<ApiResponse<Exploration[]>> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch(`/api/explorations${qs}`);
}

export async function getExploration(
  id: string,
): Promise<ApiResponse<Exploration>> {
  return apiFetch(`/api/explorations/${id}`);
}

export async function createExploration(
  data: Partial<Exploration>,
): Promise<ApiResponse<Exploration>> {
  return apiFetch('/api/explorations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateExploration(
  id: string,
  data: Partial<Exploration>,
): Promise<ApiResponse<Exploration>> {
  return apiFetch(`/api/explorations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteExploration(id: string): Promise<ApiResponse<void>> {
  return apiFetch(`/api/explorations/${id}`, { method: 'DELETE' });
}

export async function addFinding(
  id: string,
  finding: Omit<ExplorationFinding, 'id'>,
): Promise<ApiResponse<void>> {
  return apiFetch(`/api/explorations/${id}/findings`, {
    method: 'POST',
    body: JSON.stringify(finding),
  });
}
