// Test cases, test plans, cycles, and automation runs API methods
import type { ApiFetchFn } from './types';

export function createTestingApi(fetchFn: ApiFetchFn) {
  return {
    // ===== CYCLES =====
    async getCycles(filters?: {
      projectId?: string;
      status?: string;
      environment?: string;
    }) {
      const params = new URLSearchParams();
      if (filters?.projectId) params.append('projectId', filters.projectId);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.environment)
        params.append('environment', filters.environment);
      return fetchFn(`/api/cycles?${params.toString()}`);
    },

    async getCycle(id: string) {
      return fetchFn(`/api/cycles/${id}`);
    },

    async createCycle(data: Record<string, unknown>) {
      return fetchFn('/api/cycles', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateCycle(id: string, data: Record<string, unknown>) {
      return fetchFn(`/api/cycles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteCycle(id: string) {
      return fetchFn(`/api/cycles/${id}`, { method: 'DELETE' });
    },

    async getCycleStats() {
      return fetchFn('/api/cycles/stats/summary');
    },

    // ===== TEST PLANS =====
    async getTestPlans(filters?: {
      projectId?: string;
      status?: string;
    }) {
      const params = new URLSearchParams();
      if (filters?.projectId) params.append('projectId', filters.projectId);
      if (filters?.status) params.append('status', filters.status);
      return fetchFn(`/api/test-plans?${params.toString()}`);
    },

    async getTestPlan(id: string) {
      return fetchFn(`/api/test-plans/${id}`);
    },

    async createTestPlan(data: Record<string, unknown>) {
      return fetchFn('/api/test-plans', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateTestPlan(id: string, data: {
      name?: string;
      description?: string;
      status?: string;
      testCaseCount?: number;
      coverage?: number;
    }) {
      return fetchFn(`/api/test-plans/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteTestPlan(id: string) {
      return fetchFn(`/api/test-plans/${id}`, { method: 'DELETE' });
    },

    async runTestPlan(id: string) {
      return fetchFn(`/api/test-plans/${id}/run`, { method: 'POST' });
    },

    // ===== TEST CASES =====
    async getTestCases(filters?: {
      projectId?: string;
      status?: string;
    }) {
      const params = new URLSearchParams();
      if (filters?.projectId) params.append('projectId', filters.projectId);
      if (filters?.status) params.append('status', filters.status);
      return fetchFn(`/api/test-cases?${params.toString()}`);
    },

    async getTestCase(id: string) {
      return fetchFn(`/api/test-cases/${id}`);
    },

    async createTestCase(data: Record<string, unknown>) {
      return fetchFn('/api/test-cases', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateTestCase(id: string, data: Record<string, unknown>) {
      return fetchFn(`/api/test-cases/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    async deleteTestCase(id: string) {
      return fetchFn(`/api/test-cases/${id}`, { method: 'DELETE' });
    },

    // ===== AUTOMATION RUNS =====
    async getAutomationRuns(filters?: {
      projectId?: string;
      userId?: string;
      status?: string;
    }) {
      const params = new URLSearchParams();
      if (filters?.projectId) params.append('projectId', filters.projectId);
      if (filters?.userId) params.append('userId', filters.userId);
      if (filters?.status) params.append('status', filters.status);
      return fetchFn(`/api/automation-runs?${params.toString()}`);
    },

    async getAutomationRun(runId: string) {
      return fetchFn(`/api/automation-runs/${runId}`);
    },

    async createAutomationRun(data: {
      name: string;
      testPlanId?: string;
      projectId: string;
      userId: string;
      testCases: unknown[];
      config: {
        parallel: boolean;
        environment: string;
        retryFailedTests?: boolean;
        captureScreenshots?: boolean;
        captureVideo?: boolean;
      };
      metadata?: Record<string, unknown>;
    }) {
      return fetchFn('/api/automation-runs', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async startAutomationRun(runId: string) {
      return fetchFn(`/api/automation-runs/${runId}/start`, {
        method: 'POST',
      });
    },

    async pauseAutomationRun(runId: string) {
      return fetchFn(`/api/automation-runs/${runId}/pause`, {
        method: 'POST',
      });
    },

    async cancelAutomationRun(runId: string) {
      return fetchFn(`/api/automation-runs/${runId}/cancel`, {
        method: 'POST',
      });
    },

    async getAutomationRunResults(runId: string) {
      return fetchFn(`/api/automation-runs/${runId}/results`);
    },

    async getActiveAutomationRuns() {
      return fetchFn('/api/automation-runs/status/active');
    },
  };
}
