import { apiFetch } from '../api-client';
import type { AuditLogEntry } from './types';

export interface AuditLogQuery {
  limit?: number;
  offset?: number;
  action?: string;
  resource_type?: string;
}

export const auditApi = {
  listLogs: (params?: AuditLogQuery) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.action) q.set('action', params.action);
    if (params?.resource_type) q.set('resource_type', params.resource_type);
    const qs = q.toString();
    return apiFetch<{ logs: AuditLogEntry[]; total: number }>(
      `/api/audit/logs${qs ? `?${qs}` : ''}`,
    );
  },
};
