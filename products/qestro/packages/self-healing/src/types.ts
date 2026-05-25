/**
 * Public types for @qestro/self-healing
 *
 * Zero runtime dependencies. These describe the shape of test results you pass in
 * and healing suggestions you get out.
 */

export type FailureType =
  | 'selector_changed'
  | 'timing_issue'
  | 'assertion_drift'
  | 'api_schema_change'
  | 'unknown';

export interface AssertionResult {
  id: string;
  type: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
  message?: string;
}

/**
 * Shape of a test run that the engine can analyze.
 * Structurally compatible with Playwright `TestResult` output — map your
 * framework's result into this shape.
 */
export interface TestResult {
  id: string;
  testId: string;
  status: 'passed' | 'failed' | 'pending' | 'skipped';
  startTime: Date;
  endTime: Date;
  duration: number;
  errors: string[];
  assertions: AssertionResult[];
  metrics?: Record<string, unknown>;
  screenshots?: string[];
  logs?: string[];
}

export interface FailureAnalysis {
  type: FailureType;
  originalError: string;
  errorPatterns: string[];
  diagnosis: string;
  severity: 'low' | 'medium' | 'high';
}

export interface HealingSuggestion {
  id: string;
  type: string;
  originalValue: string;
  suggestedValue: string;
  /** Confidence in the range [0, 1]. >= auto-apply threshold triggers healing. */
  confidence: number;
  rationale: string;
  beforeAfterDiff: string;
}

export interface HealingRecord {
  timestamp: Date;
  fixType: string;
  confidence: number;
  applied: boolean;
  originalValue: string;
  suggestedValue: string;
}

export interface HealingResult {
  testId: string;
  healed: boolean;
  appliedFix?: HealingSuggestion;
  suggestions: HealingSuggestion[];
  analysis: FailureAnalysis;
  confidenceScore: number;
  timestamp: Date;
  healingHistory: HealingRecord[];
}

export interface Logger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

/**
 * Called when the engine has a suggestion but its confidence falls below the
 * auto-apply threshold. Useful for forwarding to a human review queue, Slack,
 * or any custom notifier.
 */
export type LowConfidenceNotifier = (payload: {
  testId: string;
  analysis: FailureAnalysis;
  suggestion: HealingSuggestion;
  confidence: number;
}) => void | Promise<void>;

export interface SelfHealingEngineOptions {
  /** Minimum confidence to auto-apply a fix. Default: 0.85 */
  autoApplyThreshold?: number;
  /** Optional structured logger. Defaults to a no-op. */
  logger?: Logger;
  /** Optional notifier called on below-threshold suggestions. */
  onLowConfidence?: LowConfidenceNotifier;
}

export interface Healer {
  heal(testResult: TestResult, testCode?: string): HealingSuggestion[];
}
