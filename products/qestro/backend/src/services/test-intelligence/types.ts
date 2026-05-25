/**
 * AI Test Intelligence Engine Types
 * Provides type definitions for flaky detection, prioritization, auto-fix, and predictive analytics
 */

// Failure pattern classification
export type FailurePatternType =
  | 'timing'
  | 'environment'
  | 'data_dependent'
  | 'race_condition'
  | 'resource_exhaustion'
  | 'network'
  | 'selector_change'
  | 'assertion_logic'
  | 'unknown';

// Auto-fix suggestion categories
export type FixCategory =
  | 'selector_update'
  | 'timing_adjustment'
  | 'assertion_correction'
  | 'data_refresh'
  | 'environment_config'
  | 'retry_logic'
  | 'wait_strategy';

// Test priority levels
export type TestPriorityLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Report of flaky tests in a project
 */
export interface FlakyTestReport {
  projectId: string;
  reportedAt: Date;
  flakyTests: FlakyTest[];
  totalTests: number;
  flakinessPercentage: number;
  trend: 'improving' | 'declining' | 'stable';
}

/**
 * Individual flaky test with detailed analysis
 */
export interface FlakyTest {
  testId: string;
  testName: string;
  flakinessScore: number; // 0-100, higher = flakier
  passRate: number; // 0-1
  failurePattern: FailurePattern;
  recentRuns: TestRun[];
  lastFlakeAt: Date | null;
  averageFlakeInterval: number; // days between failures
  recommendedAction: string;
}

/**
 * Failure pattern analysis
 */
export interface FailurePattern {
  type: FailurePatternType;
  confidence: number; // 0-1
  description: string;
  indicators: string[];
  suggestedFix: string;
}

/**
 * Code change context for impact analysis
 */
export interface CodeChange {
  filePath: string;
  added: string[];
  removed: string[];
  modified: string[];
  testCoverage?: string[]; // test IDs that cover this file
}

/**
 * Test change context
 */
export interface ChangeContext {
  recentCommits: number;
  lastAuthor: string;
  codeChangesAffecting: CodeChange[];
  businessCriticalityScore: number; // 0-1
}

/**
 * Prioritized test with scoring
 */
export interface TestPriority {
  testId: string;
  testName: string;
  priority: TestPriorityLevel;
  riskScore: number; // 0-1
  estimatedExecutionTime: number; // milliseconds
  failureProbability: number; // 0-1
  historicalFailureRate: number; // 0-1
  executionOrder: number; // 1-based index
}

/**
 * Test run history entry
 */
export interface TestRun {
  runId: string;
  testId: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number; // milliseconds
  executedAt: Date;
  errorMessage?: string;
  screenshot?: string;
}

/**
 * Test failure details
 */
export interface TestFailure {
  testId: string;
  failureMessage: string;
  stackTrace: string;
  screenshot?: Buffer;
  environment: {
    os: string;
    browser?: string;
    node: string;
  };
  timestamp: Date;
}

/**
 * Auto-fix suggestion with confidence and preview
 */
export interface AutoFixSuggestion {
  fixId: string;
  category: FixCategory;
  description: string;
  confidence: number; // 0-1
  suggestedCode: string;
  currentCode: string;
  rationale: string;
  riskLevel: 'low' | 'medium' | 'high';
  estimatedSuccessRate: number; // 0-1
}

/**
 * Result of applying a fix
 */
export interface ApplyResult {
  success: boolean;
  testId: string;
  fixedCode: string;
  previousCode: string;
  appliedAt: Date;
  message: string;
}

/**
 * Validation result for fixed code
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  syntaxValid: boolean;
  semanticValid: boolean;
}

/**
 * Test health score for a project
 */
export interface TestHealthScore {
  projectId: string;
  overallHealth: number; // 0-100
  flakinessScore: number; // 0-100 (lower is better)
  coverageScore: number; // 0-100
  executionTimeScore: number; // 0-100
  maintenanceScore: number; // 0-100
  trend: 'improving' | 'declining' | 'stable';
  recommendations: string[];
}

/**
 * Trend analysis over time
 */
export interface TestTrend {
  projectId: string;
  period: number; // days
  passRateHistory: { date: Date; rate: number }[];
  flakinessHistory: { date: Date; score: number }[];
  executionTimeHistory: { date: Date; avgTime: number }[];
  failureCountHistory: { date: Date; count: number }[];
  improvementPercentage: number; // % change over period
}

/**
 * Predictive insight about future failures
 */
export interface PredictiveInsight {
  testId: string;
  testName: string;
  predictedToFail: boolean;
  failureProbability: number; // 0-1
  confidence: number; // 0-1
  rationale: string;
  relatedPatterns: FailurePattern[];
  suggestedActions: string[];
  riskAssessment: RiskAssessment;
}

/**
 * Risk assessment for a test
 */
export interface RiskAssessment {
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  impactScore: ImpactScore;
  mitigationStrategies: string[];
  estimatedResolutionTime: number; // minutes
}

/**
 * Impact score breakdown
 */
export interface ImpactScore {
  businessImpact: number; // 0-1
  releaseBlockerRisk: number; // 0-1
  userImpactScope: number; // 0-1
  costOfFailure: number; // 0-1 (relative)
  overallScore: number; // 0-1
}

/**
 * Interface for test runner service
 */
export interface ITestRunner {
  execute(testId: string): Promise<TestRun>;
  validateEnvironment(): Promise<void>;
}

/**
 * Weighted test run for flakiness calculation
 */
export interface WeightedTestRun {
  run: TestRun;
  weight: number; // 0-1, more recent = higher
}
