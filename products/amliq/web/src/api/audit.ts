import { api } from './client';
import type { AuditEntry } from '../types';

interface AuditListResponse {
  entries: AuditEntry[];
}

export const auditApi = {
  list: () => api.get<AuditListResponse>('/audit'),
  get: (id: string) => api.get<AuditEntry>(`/audit/${id}`),
};
