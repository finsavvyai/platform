// Typed client for enterprise dashboard endpoints.
// No mocks — callers must handle empty/loading/error states themselves.

import { API_BASE_URL } from '../config';

export interface DoraMetrics {
  window_days: number;
  deploy_count: number;
  deploy_frequency_per_day: number;
  lead_time_ms_p50: number | null;
  mttr_ms_p50: number | null;
  change_failure_rate: number | null;
  computed_at: string;
}

export interface IdentityStatus {
  sso: {
    configured: boolean;
    provider: string | null;
    tenant: string | null;
    updated_at: string | null;
  };
  scim: {
    configured: boolean;
    tenant: string | null;
  };
  checked_at: string;
}

export interface AuditEvent {
  id: number;
  actor_sub: string;
  actor_login: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details_json: string | null;
  created_at: string;
}

interface AuditListResponse { logs: AuditEvent[]; total: number; }

function authHeader(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('pushci_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getJson<T>(path: string, fetchImpl: typeof fetch = fetch): Promise<T> {
  const res = await fetchImpl(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return (await res.json()) as T;
}

export const enterpriseApi = {
  getDora: (fetchImpl?: typeof fetch) =>
    getJson<DoraMetrics>('/api/enterprise/dora', fetchImpl),
  getIdentityStatus: (fetchImpl?: typeof fetch) =>
    getJson<IdentityStatus>('/api/enterprise/identity-status', fetchImpl),
  getRecentAudit: async (limit = 10, fetchImpl?: typeof fetch) => {
    const data = await getJson<AuditListResponse>(
      `/api/audit/logs?limit=${encodeURIComponent(String(limit))}`,
      fetchImpl,
    );
    return data.logs ?? [];
  },
};
