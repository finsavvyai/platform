/**
 * Auth and Connections API service modules
 */

import apiClient from '../lib/enhanced-api-client';
import type { APIResponse } from './api-services-types';

export const authAPI = {
  async login(email: string, password: string) {
    const response = await apiClient.post<APIResponse<{ accessToken: string; refreshToken: string; user: unknown }>>('/api/v1/auth/login', { email, password });
    return response.data.data;
  },

  async register(email: string, password: string, name: string) {
    const response = await apiClient.post<APIResponse<{ accessToken: string; refreshToken: string; user: unknown }>>('/api/v1/auth/register', { email, password, name });
    return response.data.data;
  },

  async refreshToken(refreshToken: string) {
    const response = await apiClient.post<APIResponse<{ accessToken: string; refreshToken: string }>>('/api/v1/auth/refresh', { refreshToken });
    return response.data.data;
  },

  async logout() {
    await apiClient.post('/api/v1/auth/logout');
  },

  async getProfile() {
    const response = await apiClient.get<APIResponse<unknown>>('/api/v1/users/me');
    return response.data.data;
  },

  async updateProfile(data: unknown) {
    const response = await apiClient.put<APIResponse<unknown>>('/api/v1/users/me', data);
    return response.data.data;
  },

  async changePassword(oldPassword: string, newPassword: string) {
    const response = await apiClient.post<APIResponse<void>>('/api/v1/users/change-password', { oldPassword, newPassword });
    return response.data;
  },
};

export const connectionsAPI = {
  async getAll() {
    const response = await apiClient.get<APIResponse<unknown[]>>('/api/v1/connections');
    return response.data.data;
  },

  async getById(id: string) {
    const response = await apiClient.get<APIResponse<unknown>>(`/api/v1/connections/${id}`);
    return response.data.data;
  },

  async create(connection: unknown) {
    const response = await apiClient.post<APIResponse<unknown>>('/api/v1/connections', connection);
    return response.data.data;
  },

  async update(id: string, connection: unknown) {
    const response = await apiClient.put<APIResponse<unknown>>(`/api/v1/connections/${id}`, connection);
    return response.data.data;
  },

  async delete(id: string) {
    await apiClient.delete(`/api/v1/connections/${id}`);
  },

  async test(id: string) {
    const response = await apiClient.post<APIResponse<{ success: boolean; latency: number }>>(`/api/v1/connections/${id}/test`);
    return response.data.data;
  },

  async getSchema(id: string) {
    const response = await apiClient.get<APIResponse<unknown>>(`/api/v1/connections/${id}/schema`);
    return response.data.data;
  },
};
