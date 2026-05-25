import { apiFetch } from './client';
import type { ApiResponse, AutomationRun, PaginatedResponse } from '../../types';

interface RunFilters {
  projectId?: string;
  userId?: string;
  status?: string;
}

export async function getAutomationRuns(
  filters?: RunFilters,
): Promise<ApiResponse<PaginatedResponse<AutomationRun>>> {
  const params = new URLSearchParams();
  if (filters?.projectId) params.set('projectId', filters.projectId);
  if (filters?.userId) params.set('userId', filters.userId);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return apiFetch(`/api/automation-runs${qs ? `?${qs}` : ''}`);
}

export async function getAutomationRun(
  id: string,
): Promise<ApiResponse<AutomationRun>> {
  return apiFetch(`/api/automation-runs/${id}`);
}

export async function createAutomationRun(
  data: Partial<AutomationRun>,
): Promise<ApiResponse<AutomationRun>> {
  return apiFetch('/api/automation-runs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function startRun(id: string): Promise<ApiResponse<void>> {
  return apiFetch(`/api/automation-runs/${id}/start`, { method: 'POST' });
}

export async function pauseRun(id: string): Promise<ApiResponse<void>> {
  return apiFetch(`/api/automation-runs/${id}/pause`, { method: 'POST' });
}

export async function cancelRun(id: string): Promise<ApiResponse<void>> {
  return apiFetch(`/api/automation-runs/${id}/cancel`, { method: 'POST' });
}

export async function getRunResults(
  id: string,
): Promise<ApiResponse<unknown>> {
  return apiFetch(`/api/automation-runs/${id}/results`);
}

export async function getActiveRuns(): Promise<ApiResponse<AutomationRun[]>> {
  return apiFetch('/api/automation-runs/status/active');
}
