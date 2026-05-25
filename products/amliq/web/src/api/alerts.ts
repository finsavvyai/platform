import { api } from './client';
import type { Alert } from '../types';

interface AlertListResponse {
  data: Alert[];
  total: number;
}

interface ResolvePayload {
  resolution: string;
  notes: string;
}

export const alertsApi = {
  list: () => api.get<AlertListResponse>('/alerts'),
  get: (id: string) => api.get<Alert>(`/alerts/${id}`),
  resolve: (id: string, payload: ResolvePayload) =>
    api.put<Alert>(`/alerts/${id}/resolve`, payload),
};
