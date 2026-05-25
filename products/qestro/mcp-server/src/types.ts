/**
 * Shared types for Qestro MCP Server
 */

export interface TestGenerationInput {
  url?: string;
  description?: string;
  testType?: 'e2e' | 'api' | 'visual';
  framework?: 'playwright' | 'cypress';
}

export interface TestGenerationResult {
  success: boolean;
  testId?: string;
  code?: string;
  language?: string;
  error?: string;
  estimatedRuntime?: number;
}

export interface RunTestsInput {
  testId?: string;
  projectId?: string;
  environment?: string;
}

export interface TestRunResult {
  success: boolean;
  runId?: string;
  status?: 'passed' | 'failed' | 'running';
  passedTests?: number;
  failedTests?: number;
  totalTests?: number;
  duration?: number;
  error?: string;
  timestamp?: string;
}

export interface AnalyzeResultsInput {
  runId: string;
}

export interface AnalysisResult {
  success: boolean;
  runId: string;
  summary?: string;
  failureCount?: number;
  failures?: Array<{
    testName: string;
    error: string;
    healingSuggestion?: string;
  }>;
  overallHealth?: 'healthy' | 'degraded' | 'critical';
  error?: string;
}

export interface HealTestInput {
  testId: string;
  failureId?: string;
}

export interface HealTestResult {
  success: boolean;
  testId: string;
  healed?: boolean;
  suggestedFix?: string;
  code?: string;
  error?: string;
}

export interface ProjectInfoInput {
  projectId?: string;
}

export interface ProjectInfoResult {
  success: boolean;
  projectId?: string;
  name?: string;
  testCount?: number;
  passRate?: number;
  recentRuns?: Array<{
    runId: string;
    timestamp: string;
    status: string;
    duration: number;
  }>;
  healthScore?: number;
  lastUpdated?: string;
  error?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface ApiError extends Error {
  statusCode?: number;
  body?: string;
}
