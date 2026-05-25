export type LoadProfile = 'constant' | 'ramp_up' | 'spike' | 'step';

export interface VirtualUser {
  id: string;
  scenario: TestScenario;
  startTime: number;
  lastRequestTime: number;
  requestCount: number;
  errorCount: number;
  isActive: boolean;
}

export interface RequestMetric {
  timestamp: number;
  responseTime: number;
  statusCode: number;
  method: string;
  url: string;
  success: boolean;
  error?: string;
  userId: string;
}

export interface LoadTestMetrics {
  timestamp: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  throughput: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  minLatency: number;
  maxLatency: number;
  activeVirtualUsers: number;
}

export interface ThresholdRule {
  metric: 'errorRate' | 'p95Latency' | 'throughput' | 'avgLatency';
  operator: '>' | '<' | '=' | '>=' | '<=';
  value: number;
  action?: 'stop' | 'alert';
}

export interface LoadTestConfig {
  testId: string;
  projectId: string;
  userId: string;
  name: string;
  description?: string;
  targetUrl: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  loadProfile: LoadProfile;
  initialVirtualUsers: number;
  maxVirtualUsers: number;
  rampUpDurationMs?: number;
  rampDownDurationMs?: number;
  spikeDurationMs?: number;
  stepIncrement?: number;
  stepDurationMs?: number;
  testDurationMs: number;
  thinkTimeMs?: number;
  thresholdRules?: ThresholdRule[];
}

export interface LoadTestResult {
  runId: string;
  testId: string;
  projectId: string;
  userId: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  config: LoadTestConfig;
  finalMetrics: LoadTestMetrics;
  metricsTimeSeries: LoadTestMetrics[];
  peakVirtualUsers: number;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  error?: string;
  thresholdViolations: { rule: ThresholdRule; value: number }[];
}

export interface TestScenario {
  steps: TestStep[];
  iterations?: number;
}

export interface TestStep {
  name: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  assertions?: StepAssertion[];
  thinkTimeMs?: number;
}

export interface StepAssertion {
  type: 'statusCode' | 'responseTime' | 'body' | 'header';
  expected: unknown;
  actual?: unknown;
  passed?: boolean;
}
