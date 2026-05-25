import { api } from './client';

export interface TeamMember {
  id: string;
  email: string;
  role: 'admin' | 'analyst' | 'auditor' | 'viewer';
  status: 'active' | 'invited' | 'disabled';
  joined_at: string;
}

interface TeamListResponse {
  members: TeamMember[];
}

interface InvitePayload {
  email: string;
  role: TeamMember['role'];
}

export const teamApi = {
  list: () =>
    api.get<TeamListResponse>('/team'),
  invite: (payload: InvitePayload) =>
    api.post<TeamMember>('/team/invite', payload),
  updateRole: (id: string, role: TeamMember['role']) =>
    api.put<TeamMember>(`/team/${id}/role`, { role }),
};
