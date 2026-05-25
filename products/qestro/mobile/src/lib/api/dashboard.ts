import { apiFetch } from './client';
import type { ApiResponse, DashboardStats } from '../../types';

export async function getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
  return apiFetch('/api/dashboard/stats');
}

export async function getDashboardHealth(): Promise<ApiResponse<unknown>> {
  return apiFetch('/api/dashboard/health');
}
