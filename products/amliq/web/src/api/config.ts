import { api } from './client';

export interface TenantConfigResponse {
  country: string;
  regulation_framework: string[];
  enabled_lists: ListConfigItem[];
  default_threshold: number;
  match_weights: Record<string, number>;
  auto_dismiss_below: number;
  auto_escalate_above: number;
  screening_mode: string;
  batch_schedule: string;
  max_batch_size: number;
}

export interface ListConfigItem {
  list_id: string;
  source_url: string;
  custom_source_url: string;
  parser_type: string;
  sync_schedule: string;
  sync_enabled: boolean;
  threshold: number;
}

export const configApi = {
  get: () => api.get<TenantConfigResponse>('/config'),
  update: (data: Partial<TenantConfigResponse>) =>
    api.put<TenantConfigResponse>('/config', data),
};
