import { apiFetch } from './client';
import type { ApiResponse, InsightsOverview } from '../../types';

export async function getInsightsOverview(): Promise<ApiResponse<InsightsOverview>> {
  return apiFetch('/api/insights/overview');
}

export async function getWeeklyInsights(): Promise<ApiResponse<unknown>> {
  return apiFetch('/api/insights/weekly');
}

export async function getInsightsTrend(): Promise<ApiResponse<unknown>> {
  return apiFetch('/api/insights/trend');
}
