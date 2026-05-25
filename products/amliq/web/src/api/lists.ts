import { api } from './client';

interface ListMeta {
  id: string;
  source_url: string;
  custom_url: string;
  parser_type: string;
  entity_count: number;
  last_synced: number;
  sync_enabled: boolean;
  threshold: number;
}

interface ListsResponse {
  lists: ListMeta[];
}

export const listsApi = {
  list: () => api.get<ListsResponse>('/lists'),
  get: (id: string) => api.get<ListMeta>(`/lists/${id}`),
  sync: (id: string) => api.post(`/lists/${id}/sync`, {}),
};

export type { ListMeta };
