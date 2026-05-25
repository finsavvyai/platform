import { api } from './client';

export interface EnforcementAction {
  id: string;
  entity_name: string;
  regulator: string;
  action_type: string;
  amount?: number;
  currency?: string;
  date: string;
  description: string;
  url: string;
  jurisdiction: string;
}

interface EnforcementSearchResponse {
  query: string;
  results: EnforcementAction[];
  total: number;
}

interface EnforcementEntityResponse {
  entity_id: string;
  actions: EnforcementAction[];
  total: number;
}

export const enforcementApi = {
  search: (query: string) =>
    api.get<EnforcementSearchResponse>(`/enforcement/search?q=${encodeURIComponent(query)}`),
  getByEntity: (entityId: string) =>
    api.get<EnforcementEntityResponse>(`/enforcement/entity/${entityId}`),
};
