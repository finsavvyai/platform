// AI Agent (OpenClaw) API methods
import type { ApiFetchFn } from './types';

export function createAiAgentApi(fetchFn: ApiFetchFn) {
  return {
    async getAIDashboard() {
      return fetchFn('/api/openclaw/incoming', {
        method: 'POST',
        body: JSON.stringify({ action: 'dashboard' }),
      });
    },

    async runAITestSuite(suiteName?: string) {
      return fetchFn('/api/openclaw/incoming', {
        method: 'POST',
        body: JSON.stringify({
          action: 'run-suite',
          params: { suite: suiteName || 'default' },
        }),
      });
    },

    async getAIRecentFailures() {
      return fetchFn('/api/openclaw/incoming', {
        method: 'POST',
        body: JSON.stringify({ action: 'failures' }),
      });
    },

    async aiAnalyzeFailure(testId: string) {
      return fetchFn('/api/openclaw/analyze', {
        method: 'POST',
        body: JSON.stringify({ testId }),
      });
    },

    async triggerAISelfHealing() {
      return fetchFn('/api/openclaw/self-healing', {
        method: 'POST',
      });
    },

    async getAIDailySummary() {
      return fetchFn('/api/openclaw/daily-summary');
    },

    async getAIAgentStatus() {
      return fetchFn('/api/openclaw/status');
    },

    async sendAIAgentMessage(
      message: string,
      options?: { channel?: string; thinking?: string }
    ) {
      return fetchFn('/api/openclaw/send', {
        method: 'POST',
        body: JSON.stringify({ message, ...options }),
      });
    },
  };
}
