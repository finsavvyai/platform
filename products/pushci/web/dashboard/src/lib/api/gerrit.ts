import { apiFetch } from '../api-client';
import type { GerritProject, NewProjectForm } from '../../components/gerrit/types';

export const gerritApi = {
  list: async (): Promise<GerritProject[]> => {
    const data = await apiFetch<{ projects: GerritProject[] }>('/api/gerrit/projects');
    return data.projects;
  },
  register: (form: NewProjectForm) =>
    apiFetch<{ project: GerritProject }>('/api/gerrit/projects', {
      method: 'POST',
      body: JSON.stringify(form),
    }),
  remove: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/gerrit/projects/${id}`, { method: 'DELETE' }),
  test: (id: string) =>
    apiFetch<{ ok: boolean; version?: string; error?: string }>(
      `/api/gerrit/projects/${id}/test`,
      { method: 'POST' },
    ),
};
