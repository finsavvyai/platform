import { api } from './client';

export interface MonitorProfile {
  id: string;
  entity_name: string;
  entity_type: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  lists_to_screen: string[];
  frequency: 'realtime' | 'daily' | 'weekly';
  status: 'active' | 'paused' | 'expired';
  last_screened_at: string | null;
  next_screen_at: string;
  match_count: number;
  created_at: string;
}

export interface MonitorAlert {
  id: string;
  profile_id: string;
  alert_type: string;
  match_score: number;
  matched_entity: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  reviewed_by: string;
  reviewed_at: string | null;
  disposition: string;
  created_at: string;
}

export interface MonitorDashboard {
  active_profiles: number;
  total_profiles: number;
  pending_alerts: number;
  total_alerts: number;
  by_severity: Record<string, number>;
}

interface ProfileListResponse {
  profiles: MonitorProfile[];
  total: number;
}

interface AlertListResponse {
  alerts: MonitorAlert[];
  total: number;
}

interface CreateProfilePayload {
  entity_name: string;
  entity_type: string;
  risk_level: string;
  frequency?: string;
  lists?: string[];
}

interface UpdateProfilePayload {
  frequency?: string;
  lists?: string[];
  status?: 'active' | 'paused';
}

export const monitoringApi = {
  listProfiles: () =>
    api.get<ProfileListResponse>('/monitor'),
  addProfile: (payload: CreateProfilePayload) =>
    api.post<MonitorProfile>('/monitor', payload),
  updateProfile: (id: string, payload: UpdateProfilePayload) =>
    api.put<MonitorProfile>(`/monitor/${id}`, payload),
  deleteProfile: (id: string) =>
    api.del<{ status: string }>(`/monitor/${id}`),
  listAlerts: (params?: { severity?: string; status?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return api.get<AlertListResponse>(`/monitor/alerts${qs ? `?${qs}` : ''}`);
  },
  reviewAlert: (id: string, disposition: string, reviewedBy: string) =>
    api.put<MonitorAlert>(`/monitor/alerts/${id}/review`, {
      disposition,
      reviewed_by: reviewedBy,
    }),
  getDashboard: () =>
    api.get<MonitorDashboard>('/monitor/dashboard'),
};
