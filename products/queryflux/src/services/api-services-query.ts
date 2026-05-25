/**
 * Queries API service module
 */

import apiClient from '../lib/enhanced-api-client';
import type { APIResponse, PaginationParams } from './api-services-types';

export const queriesAPI = {
  async getAll(params?: PaginationParams & { connectionId?: string }) {
    const response = await apiClient.get<APIResponse<unknown[]>>('/api/v1/queries', { params } as never);
    return response.data.data;
  },

  async getById(id: string) {
    const response = await apiClient.get<APIResponse<unknown>>(`/api/v1/queries/${id}`);
    return response.data.data;
  },

  async execute(connectionId: string, sql: string, params?: Record<string, unknown>) {
    const response = await apiClient.post<APIResponse<{
      columns: string[];
      rows: unknown[];
      rowsAffected: number;
      executionTime: number;
    }>>('/api/v1/queries/execute', { connectionId, sql, params });
    return response.data.data;
  },

  async executeStream(connectionId: string, sql: string, chunkSize: number, callback: (chunk: unknown) => void) {
    const ws = apiClient.getWebSocket();
    if (!ws) throw new Error('WebSocket not connected');
    return new Promise((resolve, reject) => {
      ws.send('query:start', { connectionId, sql, chunkSize });
      const handler = (data: { type: string; data: unknown; error?: string }) => {
        if (data.type === 'chunk') { callback(data.data); }
        else if (data.type === 'complete') { ws.off('query:data'); resolve(data); }
        else if (data.type === 'error') { ws.off('query:data'); reject(new Error(data.error)); }
      };
      ws.on('query:data', handler);
    });
  },

  async explain(connectionId: string, sql: string) {
    const response = await apiClient.post<APIResponse<unknown>>('/api/v1/queries/explain', { connectionId, sql });
    return response.data.data;
  },

  async save(query: { name: string; sql: string; connectionId: string; description?: string }) {
    const response = await apiClient.post<APIResponse<unknown>>('/api/v1/queries', query);
    return response.data.data;
  },

  async update(id: string, query: unknown) {
    const response = await apiClient.put<APIResponse<unknown>>(`/api/v1/queries/${id}`, query);
    return response.data.data;
  },

  async delete(id: string) {
    await apiClient.delete(`/api/v1/queries/${id}`);
  },

  async getHistory(params?: PaginationParams & { connectionId?: string }) {
    const response = await apiClient.get<APIResponse<unknown[]>>('/api/v1/queries/history', { params } as never);
    return response.data.data;
  },
};
