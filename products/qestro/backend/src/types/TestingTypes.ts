export interface TestResult {
  id: string;
  testId: string;
  status: 'passed' | 'failed' | 'pending' | 'skipped';
  startTime: Date;
  endTime: Date;
  duration: number;
  errors: string[];
  assertions: AssertionResult[];
  metrics: Record<string, any>;
  screenshots: string[];
  logs: string[];
}

export interface AssertionResult {
  id: string;
  type: string;
  expected: any;
  actual: any;
  passed: boolean;
  message?: string;
}

export interface TestMetrics {
  duration: number;
  memoryUsage: number;
  cpuUsage: number;
  networkRequests: number;
  errors: number;
  assertions: number;
}

export interface PerformanceThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  value: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}