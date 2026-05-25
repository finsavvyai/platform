/**
 * Policy Test Types
 *
 * Types for policy testing including test results, suites,
 * scenarios, fixtures, and security configurations
 */

import type { SecurityLevel } from './policy-types';

export interface PolicyTestResult {
  id: string;
  testSuite: string;
  scenario: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  duration: number;
  timestamp: Date;
  input: any;
  expectedOutput: any;
  actualOutput: any;
  errors: TestError[];
  coverage: TestCoverage;
  performance: TestPerformance;
  security: TestSecurity;
}

export interface TestError {
  type: string;
  message: string;
  stack?: string;
  location?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface TestCoverage {
  lines: number;
  branches: number;
  functions: number;
  statements: number;
  scenarios: number;
  uncoveredPaths: string[];
}

export interface TestPerformance {
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  requests: number;
  throughput: number;
}

export interface TestSecurity {
  vulnerabilities: SecurityVulnerability[];
  complianceChecks: ComplianceCheck[];
  dataLeaks: DataLeak[];
}

export interface SecurityVulnerability {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
  cve?: string;
  owasp?: string;
}

export interface ComplianceCheck {
  framework: string;
  control: string;
  status: 'pass' | 'fail' | 'warning';
  evidence: string;
  gap?: string;
}

export interface DataLeak {
  type: string;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  masked: boolean;
}

export interface PolicyTestSuite {
  id: string;
  name: string;
  description: string;
  scenarios: TestScenario[];
  fixtures: TestFixture[];
  config: TestConfig;
  security: TestSecurityConfig;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  given: any;
  when: any;
  then: any;
  tags: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  timeout: number;
  retries: number;
  security: TestScenarioSecurity;
}

export interface TestFixture {
  name: string;
  type: 'data' | 'mock' | 'service';
  content: any;
  dependencies: string[];
}

export interface TestConfig {
  timeout: number;
  parallel: boolean;
  stopOnFailure: boolean;
  environment: Record<string, any>;
  hooks: TestHooks;
  reporting: ReportingConfig;
}

export interface TestHooks {
  beforeAll?: string;
  afterAll?: string;
  beforeEach?: string;
  afterEach?: string;
  onSuccess?: string;
  onFailure?: string;
}

export interface ReportingConfig {
  format: 'json' | 'xml' | 'html' | 'junit';
  destination: string;
  includeCoverage: boolean;
  includePerformance: boolean;
  includeSecurity: boolean;
}

export interface TestSecurityConfig {
  sandbox: boolean;
  isolation: boolean;
  resourceLimits: ResourceLimits;
  networkPolicy: NetworkPolicy;
  dataMasking: boolean;
  auditTest: boolean;
}

export interface ResourceLimits {
  memory: number;
  cpu: number;
  disk: number;
  network: number;
  duration: number;
}

export interface NetworkPolicy {
  allowOutbound: boolean;
  allowedHosts: string[];
  blockedHosts: string[];
  proxyRequired: boolean;
}

export interface TestScenarioSecurity {
  requireAuth: boolean;
  permissions: string[];
  dataClassification: SecurityLevel;
  sanitizeInput: boolean;
  sanitizeOutput: boolean;
  auditScenario: boolean;
}
