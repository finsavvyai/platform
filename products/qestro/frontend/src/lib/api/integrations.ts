// Integrations and Jira API methods
import type { ApiFetchFn } from './types';

export function createIntegrationsApi(fetchFn: ApiFetchFn) {
  return {
    // ===== JIRA =====
    async getJiraAuthURL() {
      return fetchFn('/api/jira/auth/url');
    },

    async getJiraConnectionStatus() {
      return fetchFn('/api/jira/connection');
    },

    async disconnectJira() {
      return fetchFn('/api/jira/connection', { method: 'DELETE' });
    },

    async importJiraProject(
      projectKey: string,
      options?: {
        importEpics?: boolean;
        importIssues?: boolean;
      }
    ) {
      return fetchFn('/api/jira/import/project', {
        method: 'POST',
        body: JSON.stringify({
          jiraProjectKey: projectKey,
          importEpics: options?.importEpics ?? true,
          importIssues: options?.importIssues ?? true,
        }),
      });
    },

    async getJiraProjects() {
      return fetchFn('/api/jira/projects');
    },

    async getJiraProjectIssues(projectId: string) {
      return fetchFn(`/api/jira/projects/${projectId}/issues`);
    },

    async getJiraIssue(issueKey: string) {
      return fetchFn(`/api/jira/issues/${issueKey}`);
    },

    // ===== INTEGRATIONS =====
    async getIntegrations(filters?: {
      type?: string;
      status?: string;
    }) {
      const params = new URLSearchParams();
      if (filters?.type) params.append('type', filters.type);
      if (filters?.status) params.append('status', filters.status);
      return fetchFn(`/api/integrations?${params.toString()}`);
    },

    async getAvailableIntegrations() {
      return fetchFn('/api/integrations/available');
    },

    async getIntegration(id: string) {
      return fetchFn(`/api/integrations/${id}`);
    },

    async createIntegration(data: {
      type: string;
      name: string;
      config?: Record<string, unknown>;
    }) {
      return fetchFn('/api/integrations', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateIntegration(
      id: string,
      data: {
        name?: string;
        config?: Record<string, unknown>;
        status?: string;
      }
    ) {
      return fetchFn(`/api/integrations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteIntegration(id: string) {
      return fetchFn(`/api/integrations/${id}`, { method: 'DELETE' });
    },

    async syncIntegration(id: string) {
      return fetchFn(`/api/integrations/${id}/sync`, { method: 'POST' });
    },
  };
}
