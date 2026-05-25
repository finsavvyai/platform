/**
 * Metrics and Alerts API service modules
 */

import apiClient from '../lib/enhanced-api-client';
import type { APIResponse, PaginationParams, DatabaseMetrics, Alert } from './api-services-types';

export const metricsAPI = {
  async getLatest(connectionId: string) {
    const response = await apiClient.get<APIResponse<DatabaseMetrics>>(`/api/v1/metrics/${connectionId}/latest`);
    return response.data.data;
  },

  async getHistory(connectionId: string, startTime: string, endTime: string, limit?: number, offset?: number) {
    const response = await apiClient.get<APIResponse<DatabaseMetrics[]>>(
      `/api/v1/metrics/${connectionId}/history`,
      { params: { startTime, endTime, limit, offset } } as never,
    );
    return response.data.data;
  },

  async getAverage(connectionId: string, startTime: string, endTime: string) {
    const response = await apiClient.get<APIResponse<DatabaseMetrics>>(
      `/api/v1/metrics/${connectionId}/average`,
      { params: { startTime, endTime } } as never,
    );
    return response.data.data;
  },

  async startMonitoring(connectionId: string, intervalSeconds: number) {
    const response = await apiClient.post<APIResponse<void>>(`/api/v1/metrics/${connectionId}/monitoring/start`, { interval: intervalSeconds });
    return response.data;
  },

  async stopMonitoring(connectionId: string) {
    const response = await apiClient.post<APIResponse<void>>(`/api/v1/metrics/${connectionId}/monitoring/stop`);
    return response.data;
  },

  async collect(connectionId: string) {
    const response = await apiClient.post<APIResponse<DatabaseMetrics>>(`/api/v1/metrics/${connectionId}/collect`);
    return response.data.data;
  },
};

export const alertsAPI = {
  async getAll(params?: PaginationParams & { severity?: string; status?: string }) {
    const response = await apiClient.get<APIResponse<Alert[]>>('/api/v1/alerts', { params } as never);
    return response.data.data;
  },

  async getActive() {
    const response = await apiClient.get<APIResponse<Alert[]>>('/api/v1/alerts/active');
    return response.data.data;
  },

  async getById(id: string) {
    const response = await apiClient.get<APIResponse<Alert>>(`/api/v1/alerts/${id}`);
    return response.data.data;
  },

  async create(alert: Partial<Alert>) {
    const response = await apiClient.post<APIResponse<Alert>>('/api/v1/alerts', alert);
    return response.data.data;
  },

  async acknowledge(id: string) {
    const response = await apiClient.post<APIResponse<void>>(`/api/v1/alerts/${id}/acknowledge`);
    return response.data;
  },

  async resolve(id: string) {
    const response = await apiClient.post<APIResponse<void>>(`/api/v1/alerts/${id}/resolve`);
    return response.data;
  },

  async mute(id: string, durationHours?: number) {
    const response = await apiClient.post<APIResponse<void>>(`/api/v1/alerts/${id}/mute`, { durationHours });
    return response.data;
  },

  async getStats(days = 7) {
    const response = await apiClient.get<APIResponse<unknown>>('/api/v1/alerts/stats', { params: { days } } as never);
    return response.data.data;
  },
};
