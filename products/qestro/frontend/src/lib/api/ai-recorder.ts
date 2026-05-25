// AI step recorder and browser recording API methods
import type { ApiFetchFn } from './types';

export function createAiRecorderApi(fetchFn: ApiFetchFn) {
  return {
    // ===== AI STEP RECORDER =====
    async createRecordingSession(
      url: string,
      steps: string[],
      config?: {
        headless?: boolean;
        timeout?: number;
        captureScreenshots?: boolean;
      }
    ) {
      return fetchFn('/api/ai-recorder/sessions', {
        method: 'POST',
        body: JSON.stringify({ url, steps, config }),
      });
    },

    async startRecordingSession(
      sessionId: string,
      config?: { headless?: boolean }
    ) {
      return fetchFn(`/api/ai-recorder/sessions/${sessionId}/start`, {
        method: 'POST',
        body: JSON.stringify({ config }),
      });
    },

    async startRecordingSessionSync(
      sessionId: string,
      config?: { headless?: boolean }
    ) {
      return fetchFn(`/api/ai-recorder/sessions/${sessionId}/start-sync`, {
        method: 'POST',
        body: JSON.stringify({ config }),
      });
    },

    async quickRecord(
      url: string,
      steps: string[],
      config?: {
        headless?: boolean;
        captureScreenshots?: boolean;
      }
    ) {
      return fetchFn('/api/ai-recorder/quick-record', {
        method: 'POST',
        body: JSON.stringify({ url, steps, config }),
      });
    },

    async getRecordingSession(sessionId: string) {
      return fetchFn(`/api/ai-recorder/sessions/${sessionId}`);
    },

    async getRecordingSessionStatus(sessionId: string) {
      return fetchFn(`/api/ai-recorder/sessions/${sessionId}/status`);
    },

    async getGeneratedCode(sessionId: string) {
      return fetchFn(`/api/ai-recorder/sessions/${sessionId}/code`);
    },

    async getRecordingScreenshots(sessionId: string) {
      return fetchFn(`/api/ai-recorder/sessions/${sessionId}/screenshots`);
    },

    async getRecordingScreenshot(sessionId: string, stepId: string) {
      return fetchFn(
        `/api/ai-recorder/sessions/${sessionId}/screenshots/${stepId}`
      );
    },

    async deleteRecordingSession(sessionId: string) {
      return fetchFn(`/api/ai-recorder/sessions/${sessionId}`, {
        method: 'DELETE',
      });
    },

    async listRecordingSessions() {
      return fetchFn('/api/ai-recorder/sessions');
    },

    // ===== BROWSER RECORDING (AI-Powered) =====
    async startBrowserRecording(data: {
      url: string;
      name?: string;
      description?: string;
      framework?: string;
      viewport?: { width: number; height: number };
    }) {
      return fetchFn('/api/recordings/openclaw/start', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async stopBrowserRecording(sessionId: string) {
      return fetchFn(`/api/recordings/openclaw/${sessionId}/stop`, {
        method: 'POST',
      });
    },

    async submitRecordingInteractions(
      sessionId: string,
      interactions: unknown[]
    ) {
      return fetchFn(`/api/recordings/openclaw/${sessionId}/interactions`, {
        method: 'POST',
        body: JSON.stringify({ interactions }),
      });
    },

    async getBrowserRecordingSessions() {
      return fetchFn('/api/recordings/openclaw/sessions');
    },

    async getActiveBrowserRecordings() {
      return fetchFn('/api/recordings/openclaw/sessions/active');
    },

    async getBrowserRecordingSession(sessionId: string) {
      return fetchFn(`/api/recordings/openclaw/${sessionId}`);
    },

    async getBrowserRecordingStats() {
      return fetchFn('/api/recordings/openclaw/stats');
    },

    // ===== CONVERSATIONAL TEST GENERATION =====
    async startTestConversation(
      message: string,
      options?: { channel?: string; notifyOnComplete?: boolean }
    ) {
      return fetchFn('/api/testgen/conversations/start', {
        method: 'POST',
        body: JSON.stringify({ message, ...options }),
      });
    },

    async answerTestGenQuestions(
      sessionId: string,
      answers: Record<string, string | string[]>
    ) {
      return fetchFn(`/api/testgen/conversations/${sessionId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
    },

    async approveTestScenarios(
      sessionId: string,
      approvedIds?: string[],
      modifications?: Record<string, unknown>
    ) {
      return fetchFn(`/api/testgen/conversations/${sessionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approvedIds, modifications }),
      });
    },

    async cancelTestConversation(sessionId: string) {
      return fetchFn(`/api/testgen/conversations/${sessionId}/cancel`, {
        method: 'POST',
      });
    },

    async getTestConversations() {
      return fetchFn('/api/testgen/conversations');
    },

    async getTestConversation(sessionId: string) {
      return fetchFn(`/api/testgen/conversations/${sessionId}`);
    },

    async getTestConversationCode(sessionId: string) {
      return fetchFn(`/api/testgen/conversations/${sessionId}/code`);
    },

    async getTestGenStats() {
      return fetchFn('/api/testgen/stats');
    },

    async scanRepositoryForScenarios(data: {
      repositoryUrl: string;
      branch?: string;
      focus?: string;
      persona?: 'developer' | 'product' | 'business' | 'qa';
    }) {
      return fetchFn('/api/testgen/repository-scan', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  };
}
