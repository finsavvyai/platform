import { apiFetch } from '../api-client';
import type { CompanyRegistry, RegistryDraft } from '../../components/registries/types';

export const registriesApi = {
  list: async (): Promise<CompanyRegistry[]> => {
    const data = await apiFetch<{ registries: CompanyRegistry[] }>('/api/registries');
    return data.registries;
  },
  create: (draft: RegistryDraft) =>
    apiFetch<{ registry: CompanyRegistry }>('/api/registries', {
      method: 'POST',
      body: JSON.stringify(draft),
    }),
  update: (id: string, draft: RegistryDraft) =>
    apiFetch<{ registry: CompanyRegistry }>(`/api/registries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(draft),
    }),
  remove: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/registries/${id}`, { method: 'DELETE' }),
  test: (id: string) =>
    apiFetch<{ ok: boolean; error?: string }>(`/api/registries/${id}/test`, { method: 'POST' }),
};
