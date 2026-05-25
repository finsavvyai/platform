// Security scanning and API testing methods
import type { ApiFetchFn } from './types';

export function createSecurityApi(fetchFn: ApiFetchFn) {
  return {
    async runSecurityScan(
      targetUrl: string,
      options?: {
        depth?: number;
        scanType?: string;
      }
    ) {
      return fetchFn('/api/security/scan', {
        method: 'POST',
        body: JSON.stringify({ targetUrl, ...options }),
      });
    },

    async getSecurityScans() {
      return fetchFn('/api/security/scans');
    },

    async generateTest(data: {
      description: string;
      framework?: string;
      testType?: string;
      url?: string;
    }) {
      return fetchFn('/api/ai/generate-test', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async executeApiTest(data: {
      endpoint: string;
      method: string;
      headers?: Record<string, string>;
      body?: unknown;
    }) {
      return fetchFn('/api/api-testing/execute', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  };
}
