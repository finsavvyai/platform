export interface AIRequest {
  userId: string;
  type:
  | "test_generation"
  | "bug_analysis"
  | "performance_analysis"
  | "visual_testing"
  | "code_optimization";
  feature: string;
  data: unknown;
  planId?: string;
}

export interface AIResponse {
  success: boolean;
  result: unknown;
  cost: number;
  model: string;
  tokensUsed?: number;
  processingTime: number;
}

export interface TestGenerationRequest {
  description: string;
  platform: "web" | "mobile" | "api";
  framework?: "puppeteer" | "playwright" | "cypress" | "selenium" | "maestro";
  complexity: "simple" | "medium" | "complex";
}

export interface BugAnalysisRequest {
  title: string;
  description: string;
  stackTrace?: string;
  browserInfo?: Record<string, unknown>;
  reproductionSteps?: string[];
  severity?: "low" | "medium" | "high" | "critical";
}

export interface PerformanceAnalysisRequest {
  metrics: unknown[];
  timeRange: string;
  baseline?: Record<string, unknown>;
  platform: "web" | "mobile";
}

export interface FailoverResult {
  content: string;
  model: string;
  tokensUsed: number;
  cost: number;
}
