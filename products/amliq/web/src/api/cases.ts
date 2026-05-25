import { api } from './client';

export interface ComplianceCase {
  id: string;
  alert_id: string;
  status: 'open' | 'assigned' | 'escalated' | 'resolved';
  assigned_to: string;
  created_at: string;
  updated_at: string;
}

export interface CaseDetail extends ComplianceCase {
  comments: CaseComment[];
}

export interface CaseComment {
  id: string;
  case_id: string;
  author: string;
  body: string;
  created_at: string;
}

interface CaseListResponse {
  data: ComplianceCase[];
  total: number;
}

export const casesApi = {
  list: (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return api.get<CaseListResponse>(`/cases${qs}`);
  },
  get: (id: string) =>
    api.get<CaseDetail>(`/cases/${id}`),
  assign: (id: string, userId: string) =>
    api.put<ComplianceCase>(`/cases/${id}/assign`, { user_id: userId }),
  escalate: (id: string, reason: string) =>
    api.put<ComplianceCase>(`/cases/${id}/escalate`, { reason }),
  resolve: (id: string, resolution: string, notes: string) =>
    api.put<ComplianceCase>(`/cases/${id}/resolve`, { resolution, notes }),
  review: (id: string, disposition: string, justification: string) =>
    api.put<{ status: string; message: string }>(`/cases/${id}/review`, { disposition, justification }),
  bulkResolve: (caseIds: string[], disposition: string, justification: string) =>
    api.post<{ resolved: number; total: number }>('/cases/bulk-resolve', {
      case_ids: caseIds, disposition, justification,
    }),
};
