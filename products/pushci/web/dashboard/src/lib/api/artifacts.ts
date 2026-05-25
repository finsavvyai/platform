import { apiFetch } from '../api-client';
import type { ArtifactRecord } from './types';

export const artifactsApi = {
  listSizes: async (): Promise<ArtifactRecord[]> => {
    const data = await apiFetch<{ artifacts: ArtifactRecord[] }>('/api/artifacts/sizes');
    return data.artifacts;
  },
};
