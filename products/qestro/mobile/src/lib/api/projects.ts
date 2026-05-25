import { apiFetch } from './client';
import type { ApiResponse, Project, PaginatedResponse } from '../../types';

export async function getProjects(): Promise<ApiResponse<PaginatedResponse<Project>>> {
  return apiFetch('/api/projects');
}

export async function createProject(
  data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ApiResponse<Project>> {
  return apiFetch('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
