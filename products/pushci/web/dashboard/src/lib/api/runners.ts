import { apiFetch } from '../api-client';
import type {
  CloudPoolStatus,
  CloudRunner,
  Project,
  RunnerRegistrationTokenResponse,
} from './types';

export const runnersApi = {
  getPool: () =>
    apiFetch<{ pool: CloudPoolStatus; runners: CloudRunner[] }>('/api/cloud/status'),
  listForProject: async (projectId: string): Promise<CloudRunner[]> => {
    const data = await apiFetch<{ project: Project; runners: CloudRunner[] }>(
      `/api/cloud/projects/${projectId}/runners`,
    );
    return data.runners;
  },
  createRegistrationToken: (projectId: string, expiresInHours = 24) =>
    apiFetch<RunnerRegistrationTokenResponse>(
      `/api/cloud/projects/${projectId}/runners/registration-token`,
      {
        method: 'POST',
        body: JSON.stringify({ expiresInHours }),
      },
    ),
  remove: (projectId: string, runnerId: string) =>
    apiFetch<{ ok: boolean }>(`/api/cloud/projects/${projectId}/runners/${runnerId}`, {
      method: 'DELETE',
    }),
};
