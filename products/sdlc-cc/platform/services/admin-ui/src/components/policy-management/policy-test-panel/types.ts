// @ts-nocheck
/**
 * Types for the Policy Test Panel
 */

import {
  PolicyTestSuite,
  TestScenario,
  TestPolicyResponse,
  TestCoverage
} from '@/types/policy-management';

export interface PolicyTestPanelProps {
  policyId: string;
  version?: number;
  testSuites?: PolicyTestSuite[];
  onTestRun?: (results: TestPolicyResponse) => void;
  onTestSelect?: (scenario: TestScenario) => void;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  input: any;
  expectedOutput: any;
  status: 'idle' | 'running' | 'passed' | 'failed' | 'error' | 'skipped';
  duration?: number;
  error?: string;
  output?: any;
  coverage?: Partial<TestCoverage>;
}

export interface TestExecution {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  testCount: number;
  passedCount: number;
  failedCount: number;
  errorCount: number;
  skippedCount: number;
  currentTest?: string;
  logs: TestLog[];
  metrics: TestExecutionMetrics;
}

export interface TestLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  testId?: string;
  data?: any;
}

export interface TestExecutionMetrics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  coverage: number;
  averageDuration: number;
  maxDuration: number;
  minDuration: number;
  memoryUsage: number;
  cpuUsage: number;
  vulnerabilities: number;
  complianceIssues: number;
}

export const DEFAULT_EXECUTION: TestExecution = {
  id: '',
  status: 'idle',
  testCount: 0,
  passedCount: 0,
  failedCount: 0,
  errorCount: 0,
  skippedCount: 0,
  logs: [],
  metrics: {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    coverage: 0,
    averageDuration: 0,
    maxDuration: 0,
    minDuration: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    vulnerabilities: 0,
    complianceIssues: 0
  }
};
