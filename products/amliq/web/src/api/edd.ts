import { api } from './client';

export interface EDDReport {
  id: string;
  entity_name: string;
  entity_type: string;
  status: 'pending' | 'in_progress' | 'completed';
  risk_level: string;
  findings: string;
  created_at: string;
  completed_at: string | null;
}

export interface CreateEDDPayload {
  entity_name: string;
  entity_type?: string;
  reason: string;
}

export const eddApi = {
  create: (payload: CreateEDDPayload) =>
    api.post<EDDReport>('/edd', payload),
  get: (id: string) =>
    api.get<EDDReport>(`/edd/${id}`),
};
