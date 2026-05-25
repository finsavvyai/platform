// Dashboard, missions, explorations, and insights API methods
import type { ApiFetchFn } from './types';

export function createDashboardApi(fetchFn: ApiFetchFn) {
  return {
    // ===== DASHBOARD =====
    async getDashboardStats() {
      return fetchFn('/api/dashboard/stats');
    },

    async getDashboardHealth() {
      return fetchFn('/api/dashboard/health');
    },

    // ===== MISSIONS =====
    async getMissions(filters?: { status?: string; type?: string }) {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.type) params.append('type', filters.type);
      return fetchFn(`/api/missions?${params.toString()}`);
    },

    async getMission(id: string) {
      return fetchFn(`/api/missions/${id}`);
    },

    async createMission(data: {
      type: 'TICKET' | 'SCOUT' | 'CONCIERGE';
      input: string;
    }) {
      return fetchFn('/api/missions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async deleteMission(id: string) {
      return fetchFn(`/api/missions/${id}`, { method: 'DELETE' });
    },

    async cancelMission(id: string) {
      return fetchFn(`/api/missions/${id}/cancel`, { method: 'POST' });
    },

    async getMissionStats() {
      return fetchFn('/api/missions/stats/summary');
    },

    // ===== EXPLORATIONS =====
    async getExplorations(filters?: { status?: string }) {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      return fetchFn(`/api/explorations?${params.toString()}`);
    },

    async getExploration(id: string) {
      return fetchFn(`/api/explorations/${id}`);
    },

    async createExploration(data: {
      name: string;
      milestone?: string;
      mission: string;
      startTime?: string;
    }) {
      return fetchFn('/api/explorations', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateExploration(
      id: string,
      data: {
        name?: string;
        milestone?: string;
        mission?: string;
        status?: string;
        findings?: string[];
      }
    ) {
      return fetchFn(`/api/explorations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteExploration(id: string) {
      return fetchFn(`/api/explorations/${id}`, { method: 'DELETE' });
    },

    async addExplorationFinding(id: string, finding: string) {
      return fetchFn(`/api/explorations/${id}/findings`, {
        method: 'POST',
        body: JSON.stringify({ finding }),
      });
    },

    // ===== INSIGHTS =====
    async getInsightsOverview() {
      return fetchFn('/api/insights/overview');
    },

    async getInsightsWeekly() {
      return fetchFn('/api/insights/weekly');
    },

    async getInsightsTrend() {
      return fetchFn('/api/insights/trend');
    },

    // ===== FLAKY ANALYTICS =====
    async getFlakyTests(projectId: string, limit = 10) {
      return fetchFn(`/api/analytics/flaky?projectId=${projectId}&limit=${limit}`);
    },

    async stressTest(testId: string, iterations = 10) {
      return fetchFn('/api/analytics/flaky/stress', {
        method: 'POST',
        body: JSON.stringify({ testId, iterations }),
      });
    },
  };
}
