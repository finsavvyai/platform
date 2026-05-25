/**
 * Visual Regression API module
 * Matches the backend routes in visual-regression.routes.ts
 */

type ApiFetch = (endpoint: string, options?: RequestInit) => Promise<unknown>;

export interface VisualTestRequest {
  projectId: string;
  url: string;
  baselineName: string;
  viewport?: { width: number; height: number };
  threshold?: number;
  fullPage?: boolean;
  selector?: string;
  createIfMissing?: boolean;
}

export interface VisualTestResultResponse {
  id: string;
  projectId: string;
  testName: string;
  status: 'passed' | 'failed' | 'baseline-created';
  mismatchPercentage: number;
  duration: number;
  executedAt: string;
  approvalPending: boolean;
  regions?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    mismatchPercentage: number;
  }>;
  error?: string;
}

export interface BaselineInfo {
  name: string;
  version: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

export function createVisualRegressionApi(fetchFn: ApiFetch) {
  return {
    /** Run a single visual regression test */
    async runVisualTest(params: VisualTestRequest) {
      return fetchFn('/api/visual/test', {
        method: 'POST',
        body: JSON.stringify(params),
      }) as Promise<{ success: boolean; result: VisualTestResultResponse }>;
    },

    /** Run batch visual tests */
    async runVisualBatch(tests: VisualTestRequest[]) {
      return fetchFn('/api/visual/batch', {
        method: 'POST',
        body: JSON.stringify({ tests }),
      }) as Promise<{ success: boolean; results: VisualTestResultResponse[] }>;
    },

    /** List baselines for a project */
    async getBaselines(projectId: string) {
      return fetchFn(`/api/visual/baselines/${projectId}`) as Promise<{
        success: boolean;
        baselines: BaselineInfo[];
      }>;
    },

    /** Approve a result as new baseline */
    async approveBaseline(projectId: string, resultId: string) {
      return fetchFn(`/api/visual/baselines/${projectId}/${resultId}/approve`, {
        method: 'PUT',
      }) as Promise<{ success: boolean }>;
    },

    /** Get detailed result */
    async getVisualResult(resultId: string) {
      return fetchFn(`/api/visual/results/${resultId}`) as Promise<{
        success: boolean;
        result: VisualTestResultResponse;
      }>;
    },

    /** Get image URLs for a result */
    getVisualImageUrls(resultId: string) {
      const base = import.meta.env.VITE_API_URL || '';
      return {
        diff: `${base}/api/visual/results/${resultId}/diff`,
        current: `${base}/api/visual/results/${resultId}/current`,
        baseline: `${base}/api/visual/results/${resultId}/baseline`,
      };
    },
  };
}
