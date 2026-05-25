import { apiFetch } from './client';
import type { ApiResponse, Integration } from '../../types';

interface IntegrationFilters {
  type?: string;
  status?: string;
}

export async function getIntegrations(
  filters?: IntegrationFilters,
): Promise<ApiResponse<Integration[]>> {
  const params = new URLSearchParams();
  if (filters?.type) params.set('type', filters.type);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return apiFetch(`/api/integrations${qs ? `?${qs}` : ''}`);
}

export async function getAvailableIntegrations(): Promise<ApiResponse<Integration[]>> {
  return apiFetch('/api/integrations/available');
}

export async function getIntegration(id: string): Promise<ApiResponse<Integration>> {
  return apiFetch(`/api/integrations/${id}`);
}

export async function createIntegration(
  data: Partial<Integration>,
): Promise<ApiResponse<Integration>> {
  return apiFetch('/api/integrations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateIntegration(
  id: string,
  data: Partial<Integration>,
): Promise<ApiResponse<Integration>> {
  return apiFetch(`/api/integrations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteIntegration(id: string): Promise<ApiResponse<void>> {
  return apiFetch(`/api/integrations/${id}`, { method: 'DELETE' });
}

export async function syncIntegration(id: string): Promise<ApiResponse<void>> {
  return apiFetch(`/api/integrations/${id}/sync`, { method: 'POST' });
}
