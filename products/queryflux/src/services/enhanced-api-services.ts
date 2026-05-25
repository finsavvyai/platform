/**
 * Comprehensive API services for backend integration
 *
 * Types and domain services are split into:
 *   api-services-types.ts, api-services-data.ts,
 *   api-services-query.ts, api-services-monitoring.ts
 */

import apiClient from '../lib/enhanced-api-client';
import { queryKeys } from '../lib/queryKeys';
import type { APIResponse } from './api-services-types';
import { authAPI } from './api-services-data';
import { connectionsAPI } from './api-services-data';
import { queriesAPI } from './api-services-query';
import { metricsAPI, alertsAPI } from './api-services-monitoring';

export type { APIResponse, PaginatedResponse, PaginationParams, DatabaseMetrics, Alert } from './api-services-types';
export { authAPI, connectionsAPI } from './api-services-data';
export { queriesAPI } from './api-services-query';
export { metricsAPI, alertsAPI } from './api-services-monitoring';
export { queryKeys };

export const teamsAPI = {
  async getAll() {
    const response = await apiClient.get<APIResponse<unknown[]>>('/api/v1/teams');
    return response.data.data;
  },

  async getById(id: string) {
    const response = await apiClient.get<APIResponse<unknown>>(`/api/v1/teams/${id}`);
    return response.data.data;
  },

  async create(team: { name: string; description?: string }) {
    const response = await apiClient.post<APIResponse<unknown>>('/api/v1/teams', team);
    return response.data.data;
  },

  async update(id: string, team: unknown) {
    const response = await apiClient.put<APIResponse<unknown>>(`/api/v1/teams/${id}`, team);
    return response.data.data;
  },

  async delete(id: string) {
    await apiClient.delete(`/api/v1/teams/${id}`);
  },

  async addMember(teamId: string, userId: string, role: string) {
    const response = await apiClient.post<APIResponse<void>>(`/api/v1/teams/${teamId}/members`, { userId, role });
    return response.data;
  },

  async removeMember(teamId: string, userId: string) {
    await apiClient.delete(`/api/v1/teams/${teamId}/members/${userId}`);
  },

  async updateMemberRole(teamId: string, userId: string, role: string) {
    const response = await apiClient.put<APIResponse<void>>(`/api/v1/teams/${teamId}/members/${userId}`, { role });
    return response.data;
  },

  async inviteMember(teamId: string, email: string, role: string) {
    const response = await apiClient.post<APIResponse<void>>(`/api/v1/teams/${teamId}/invitations`, { email, role });
    return response.data;
  },
};

export const healthAPI = {
  async check() {
    const response = await apiClient.get<{ status: string; timestamp: string }>('/health');
    return response.data;
  },

  async checkDatabase() {
    const response = await apiClient.get<APIResponse<{ healthy: boolean; latency: number }>>('/health/database');
    return response.data.data;
  },
};

export const api = {
  auth: authAPI,
  connections: connectionsAPI,
  queries: queriesAPI,
  metrics: metricsAPI,
  alerts: alertsAPI,
  teams: teamsAPI,
  health: healthAPI,
};
