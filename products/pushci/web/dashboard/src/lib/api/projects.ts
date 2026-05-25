import { apiFetch } from '../api-client';
import type {
  GitHubRepoRecord,
  Project,
  ProjectAccess,
  ProjectMembership,
} from './types';

export const projectsApi = {
  list: async (): Promise<Project[]> => {
    const data = await apiFetch<{ projects: Project[] }>('/api/projects');
    return data.projects;
  },
  listGitHubRepos: async (): Promise<GitHubRepoRecord[]> => {
    const data = await apiFetch<{ repos: GitHubRepoRecord[] }>('/api/repos/github');
    return data.repos;
  },
  disconnect: (projectId: string) =>
    apiFetch<{ ok: boolean; disconnected: string }>(`/api/settings/${projectId}`, {
      method: 'DELETE',
    }),
  create: (input: { repo: string; platform: Project['platform'] }) =>
    apiFetch<{ project: Project; membership: ProjectMembership }>('/api/governance/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  bootstrapAccess: (repo: string) =>
    apiFetch<{ project: Project; membership: ProjectMembership }>('/api/governance/projects/bootstrap', {
      method: 'POST',
      body: JSON.stringify({ repo }),
    }),
  getAccess: (projectId: string) =>
    apiFetch<ProjectAccess>(`/api/governance/projects/${projectId}/access`),
  listMemberships: async (projectId: string): Promise<ProjectMembership[]> => {
    const data = await apiFetch<{ memberships: ProjectMembership[] }>(
      `/api/governance/projects/${projectId}/memberships`,
    );
    return data.memberships;
  },
};
