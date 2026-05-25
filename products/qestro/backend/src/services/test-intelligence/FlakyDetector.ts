/**
 * Flaky Test Detector
 * Identifies flaky tests using statistical analysis and weighted historical patterns.
 * Also supports active stress-testing (flakestress methodology).
 *
 * flakestress reference: https://github.com/bradfitz/flakestress
 */

import {
  FlakyTestReport,
  FlakyTest,
  FailurePattern,
  FailurePatternType,
  TestRun,
  WeightedTestRun,
} from './types.js';

export type StressClassification =
  | 'stable'
  | 'deterministic-fail'
  | 'timing-dependent'
  | 'environment-dependent'
  | 'intermittent';

export interface StressTestResult {
  testId: string;
  iterations: number;
  passed: number;
  failed: number;
  flakinessScore: number;
  classification: StressClassification;
  avgDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
  durationCV: number;
  failurePatterns: string[];
  runs: Array<{ index: number; status: 'pass' | 'fail'; durationMs: number; error?: string }>;
}

export type TestRunner = (testId: string) => Promise<{
  status: 'pass' | 'fail';
  durationMs: number;
  error?: string;
}>;

export class FlakyDetector {
  private readonly MIN_RUNS_FOR_ANALYSIS = 5;
  private readonly RECENT_RUNS_WINDOW = 30; // days
  private readonly FLAKINESS_THRESHOLD = 0.25; // 25% pass rate variation

  /**
   * Detect flaky tests in a project
   * @param projectId Project identifier
   * @param testIds Test identifiers to analyze
   * @param testRunHistory Map of testId to recent runs
   * @returns FlakyTestReport with identified flaky tests
   */
  async detectFlakyTests(
    projectId: string,
    testIds: string[],
    testRunHistory: Map<string, TestRun[]>
  ): Promise<FlakyTestReport> {
    const flakyTests: FlakyTest[] = [];
    const totalTests = testIds.length;

    for (const testId of testIds) {
      const runs = testRunHistory.get(testId) || [];

      if (runs.length < this.MIN_RUNS_FOR_ANALYSIS) {
        continue;
      }

      const flakinessScore = this.calculateFlakinessScore(testId, runs);

      if (flakinessScore > 50) {
        const failurePattern = await this.classifyFailurePattern(testId, runs);
        const recentRuns = this.getRecentRuns(runs);
        const lastFlakeAt = this.findLastFlake(runs);
        const averageFlakeInterval = this.calculateFlakeInterval(runs);

        const passRate = runs.filter((r) => r.status === 'pass').length / runs.length;

        flakyTests.push({
          testId,
          testName: testId,
          flakinessScore,
          passRate,
          failurePattern,
          recentRuns,
          lastFlakeAt,
          averageFlakeInterval,
          recommendedAction: this.getRecommendedAction(flakinessScore, failurePattern),
        });
      }
    }

    const trend = this.analyzeTrend(flakyTests);
    const flakinessPercentage = (flakyTests.length / totalTests) * 100;

    return {
      projectId,
      reportedAt: new Date(),
      flakyTests,
      totalTests,
      flakinessPercentage,
      trend,
    };
  }

  /**
   * Stress-test a single test by running it N times (flakestress methodology)
   * Returns definitive flakiness classification instead of heuristic estimates.
   *
   * @param testId Test identifier
   * @param runner Function that executes the test once
   * @param iterations How many times to run (default 10)
   */
  async stressTest(
    testId: string,
    runner: TestRunner,
    iterations = 10,
  ): Promise<StressTestResult> {
    const runs: StressTestResult['runs'] = [];
    const failurePatterns = new Map<string, number>();

    for (let i = 0; i < iterations; i++) {
      try {
        const result = await runner(testId);
        runs.push({ index: i, ...result });
        if (result.status === 'fail' && result.error) {
          const pattern = this.normalizeError(result.error);
          failurePatterns.set(pattern, (failurePatterns.get(pattern) || 0) + 1);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        runs.push({ index: i, status: 'fail', durationMs: 0, error: errorMsg });
        const pattern = this.normalizeError(errorMsg);
        failurePatterns.set(pattern, (failurePatterns.get(pattern) || 0) + 1);
      }
    }

    const passed = runs.filter((r) => r.status === 'pass').length;
    const failed = runs.length - passed;
    const flakinessScore = (failed / runs.length) * 100;

    const durations = runs.map((r) => r.durationMs).filter((d) => d > 0);
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / (durations.length || 1);
    const maxDuration = Math.max(...durations, 0);
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const durationCV = this.calculateCoefficientOfVariation(durations);

    const classification = this.classifyStressResult(
      passed,
      failed,
      iterations,
      failurePatterns,
      durationCV,
    );

    return {
      testId,
      iterations,
      passed,
      failed,
      flakinessScore,
      classification,
      avgDurationMs: Math.round(avgDuration),
      maxDurationMs: maxDuration,
      minDurationMs: minDuration,
      durationCV,
      failurePatterns: Array.from(failurePatterns.keys()),
      runs,
    };
  }

  /**
   * Classify a stress test result
   */
  private classifyStressResult(
    passed: number,
    failed: number,
    iterations: number,
    failurePatterns: Map<string, number>,
    durationCV: number,
  ): StressClassification {
    if (failed === 0) return 'stable';
    if (failed === iterations) return 'deterministic-fail';

    // All failures have the same error pattern = environment-dependent
    if (failurePatterns.size === 1 && failed > 1) {
      return 'environment-dependent';
    }

    // High duration variance = timing issue
    if (durationCV > 0.5) return 'timing-dependent';

    return 'intermittent';
  }

  /**
   * Normalize error messages to detect duplicate patterns
   */
  private normalizeError(error: string): string {
    return error
      .replace(/\d+/g, 'N')                      // Replace numbers
      .replace(/0x[0-9a-f]+/gi, 'HEX')          // Replace hex
      .replace(/\s+/g, ' ')                      // Collapse whitespace
      .slice(0, 200)                             // Truncate
      .trim();
  }

  /**
   * Calculate flakiness score using coefficient of variation and pass/fail flip rate
   * @param testId Test identifier
   * @param history Historical test runs
   * @returns Flakiness score (0-100)
   */
  calculateFlakinessScore(testId: string, history: TestRun[]): number {
    if (history.length < this.MIN_RUNS_FOR_ANALYSIS) {
      return 0;
    }

    // Weight recent runs more heavily
    const weightedRuns = this.applyWeightedMovingAverage(history);

    // Calculate pass/fail flip rate
    const flipRate = this.calculateFlipRate(weightedRuns);

    // Calculate duration coefficient of variation
    const durations = weightedRuns.map((wr) => wr.run.duration);
    const durationCV = this.calculateCoefficientOfVariation(durations);

    // Calculate pass rate volatility (coefficient of variation for pass/fail windows)
    const passRateVolatility = this.calculatePassRateVolatility(weightedRuns);

    // Weighted combination: flip rate (40%) + duration CV (30%) + pass rate volatility (30%)
    const flakinessScore =
      flipRate * 0.4 + Math.min(durationCV * 100, 100) * 0.3 + passRateVolatility * 0.3;

    return Math.min(Math.round(flakinessScore), 100);
  }

  /**
   * Apply weighted moving average to recent runs
   * @param runs Test runs
   * @returns Weighted runs with recency bias
   */
  private applyWeightedMovingAverage(runs: TestRun[]): WeightedTestRun[] {
    const now = new Date();
    const maxAgeMs = this.RECENT_RUNS_WINDOW * 24 * 60 * 60 * 1000;

    return runs
      .filter((run) => now.getTime() - run.executedAt.getTime() <= maxAgeMs)
      .map((run, index, filtered) => {
        const ageMs = now.getTime() - run.executedAt.getTime();
        const weight = Math.exp(-(ageMs / maxAgeMs) * 0.5); // Exponential decay
        return { run, weight: Math.max(weight, 0.1) };
      });
  }

  /**
   * Calculate pass/fail flip rate
   * @param weightedRuns Weighted test runs
   * @returns Flip rate (0-1)
   */
  private calculateFlipRate(weightedRuns: WeightedTestRun[]): number {
    if (weightedRuns.length < 2) return 0;

    let flips = 0;
    let totalWeight = 0;

    for (let i = 1; i < weightedRuns.length; i++) {
      const prev = weightedRuns[i - 1].run.status === 'pass';
      const current = weightedRuns[i].run.status === 'pass';
      const weight = weightedRuns[i].weight;

      if (prev !== current) {
        flips += weight;
      }
      totalWeight += weight;
    }

    return totalWeight > 0 ? flips / totalWeight : 0;
  }

  /**
   * Calculate coefficient of variation for a dataset
   * @param values Numeric values
   * @returns Coefficient of variation (0-1)
   */
  private calculateCoefficientOfVariation(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) return 0;

    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return stdDev / mean;
  }

  /**
   * Calculate pass rate volatility in sliding windows
   * @param weightedRuns Weighted test runs
   * @returns Volatility score (0-1)
   */
  private calculatePassRateVolatility(weightedRuns: WeightedTestRun[]): number {
    const windowSize = Math.max(Math.ceil(weightedRuns.length / 3), 3);
    const passRates: number[] = [];

    for (let i = 0; i <= weightedRuns.length - windowSize; i++) {
      const window = weightedRuns.slice(i, i + windowSize);
      const passCount = window.filter((wr) => wr.run.status === 'pass').length;
      passRates.push(passCount / windowSize);
    }

    if (passRates.length < 2) return 0;

    const mean = passRates.reduce((a, b) => a + b, 0) / passRates.length;
    const variance = passRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / passRates.length;

    return Math.sqrt(variance);
  }

  /**
   * Classify failure pattern for a test
   * @param testId Test identifier
   * @param runs Test runs
   * @returns FailurePattern with type and confidence
   */
  async classifyFailurePattern(testId: string, runs: TestRun[]): Promise<FailurePattern> {
    const failureRuns = runs.filter((r) => r.status === 'fail');

    if (failureRuns.length === 0) {
      return this.createPattern('unknown', 0, 'No failures recorded', []);
    }

    // Timing: failures cluster at specific times
    if (this.isTimingRelated(failureRuns)) {
      return this.createPattern(
        'timing',
        0.85,
        'Test fails at specific times or with timing-sensitive operations',
        ['Failures clustered around timeouts', 'Duration varies significantly']
      );
    }

    // Race condition: unpredictable order
    if (this.isRaceCondition(runs)) {
      return this.createPattern(
        'race_condition',
        0.75,
        'Random failures suggest race condition',
        ['Inconsistent pass/fail pattern', 'No clear trigger']
      );
    }

    // Environment: failures correlate with specific environments
    if (this.isEnvironmentDependent(failureRuns)) {
      return this.createPattern(
        'environment',
        0.8,
        'Test is sensitive to environment configuration',
        ['Environment-specific error messages', 'OS/browser dependent']
      );
    }

    // Data-dependent: failures with specific data sets
    if (this.isDataDependent(failureRuns)) {
      return this.createPattern(
        'data_dependent',
        0.7,
        'Test fails with specific data patterns',
        ['Error messages reference data', 'Assertion failures on specific values']
      );
    }

    // Resource exhaustion
    if (this.isResourceExhaustion(failureRuns)) {
      return this.createPattern(
        'resource_exhaustion',
        0.65,
        'Test fails due to resource limits',
        ['Memory/timeout errors', 'Failures increase with load']
      );
    }

    // Network issues
    if (this.isNetworkRelated(failureRuns)) {
      return this.createPattern(
        'network',
        0.72,
        'Test is affected by network conditions',
        ['Network timeout errors', 'Connection refused messages']
      );
    }

    // Selector change
    if (this.isSelectorRelated(failureRuns)) {
      return this.createPattern(
        'selector_change',
        0.78,
        'DOM selectors have changed',
        ['Element not found', 'Selector mismatch']
      );
    }

    return this.createPattern(
      'unknown',
      0.4,
      'Pattern classification inconclusive',
      ['Multiple potential causes']
    );
  }

  /**
   * Helper to create a FailurePattern
   */
  private createPattern(
    type: FailurePatternType,
    confidence: number,
    description: string,
    indicators: string[]
  ): FailurePattern {
    return {
      type,
      confidence,
      description,
      indicators,
      suggestedFix: this.suggestFixForPattern(type),
    };
  }

  /**
   * Detect if failures are timing-related
   */
  private isTimingRelated(failureRuns: TestRun[]): boolean {
    const durations = failureRuns.map((r) => r.duration);
    const cv = this.calculateCoefficientOfVariation(durations);
    return cv > 0.4; // High variation in timing
  }

  /**
   * Detect race conditions
   */
  private isRaceCondition(runs: TestRun[]): boolean {
    // Random pass/fail without clear pattern
    const flipRate = this.calculateFlipRate(
      runs.map((r) => ({ run: r, weight: 1 }))
    );
    return flipRate > 0.3; // Frequent flip rate
  }

  /**
   * Detect environment dependencies
   */
  private isEnvironmentDependent(failureRuns: TestRun[]): boolean {
    const errors = failureRuns
      .map((r) => r.errorMessage || '')
      .join(' ')
      .toLowerCase();
    const envKeywords = [
      'os',
      'platform',
      'browser',
      'mobile',
      'window',
      'screen',
      'path',
    ];
    return envKeywords.some((kw) => errors.includes(kw));
  }

  /**
   * Detect data dependencies
   */
  private isDataDependent(failureRuns: TestRun[]): boolean {
    const errors = failureRuns
      .map((r) => r.errorMessage || '')
      .join(' ')
      .toLowerCase();
    const dataKeywords = ['value', 'empty', 'null', 'undefined', 'parse', 'json'];
    return dataKeywords.some((kw) => errors.includes(kw));
  }

  /**
   * Detect resource exhaustion
   */
  private isResourceExhaustion(failureRuns: TestRun[]): boolean {
    const errors = failureRuns
      .map((r) => r.errorMessage || '')
      .join(' ')
      .toLowerCase();
    const resourceKeywords = ['timeout', 'memory', 'out of', 'exhausted', 'limit'];
    return resourceKeywords.some((kw) => errors.includes(kw));
  }

  /**
   * Detect network-related issues
   */
  private isNetworkRelated(failureRuns: TestRun[]): boolean {
    const errors = failureRuns
      .map((r) => r.errorMessage || '')
      .join(' ')
      .toLowerCase();
    const networkKeywords = [
      'network',
      'timeout',
      'econnrefused',
      'socket',
      'request',
      'fetch',
    ];
    return networkKeywords.some((kw) => errors.includes(kw));
  }

  /**
   * Detect selector-related issues
   */
  private isSelectorRelated(failureRuns: TestRun[]): boolean {
    const errors = failureRuns
      .map((r) => r.errorMessage || '')
      .join(' ')
      .toLowerCase();
    const selectorKeywords = ['selector', 'not found', 'no element', 'timed out waiting'];
    return selectorKeywords.some((kw) => errors.includes(kw));
  }

  /**
   * Get suggested fix for failure pattern
   */
  private suggestFixForPattern(type: FailurePatternType): string {
    const fixes: Record<FailurePatternType, string> = {
      timing: 'Add explicit waits and increase timeout thresholds',
      environment: 'Use environment-agnostic selectors and cross-platform APIs',
      data_dependent: 'Add data validation and use test fixtures',
      race_condition: 'Add explicit synchronization points and wait for state',
      resource_exhaustion: 'Increase resources, reduce test concurrency, or optimize code',
      network: 'Add retry logic and increase network timeout thresholds',
      selector_change: 'Update selectors and use more stable identifiers',
      assertion_logic: 'Review assertion conditions and expected values',
      unknown: 'Review failure logs and test implementation',
    };
    return fixes[type];
  }

  /**
   * Get recent runs (last 10)
   */
  private getRecentRuns(runs: TestRun[]): TestRun[] {
    return runs.slice(-10);
  }

  /**
   * Find the date of the last flake
   */
  private findLastFlake(runs: TestRun[]): Date | null {
    for (let i = runs.length - 1; i >= 0; i--) {
      if (runs[i].status === 'fail') {
        return runs[i].executedAt;
      }
    }
    return null;
  }

  /**
   * Calculate average interval between flakes (in days)
   */
  private calculateFlakeInterval(runs: TestRun[]): number {
    const flakeRuns = runs
      .filter((r) => r.status === 'fail')
      .sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime());

    if (flakeRuns.length < 2) return 0;

    const intervals: number[] = [];
    for (let i = 1; i < flakeRuns.length; i++) {
      const diff = flakeRuns[i].executedAt.getTime() - flakeRuns[i - 1].executedAt.getTime();
      intervals.push(diff / (24 * 60 * 60 * 1000)); // Convert to days
    }

    return intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  /**
   * Analyze trend direction
   */
  private analyzeTrend(
    flakyTests: FlakyTest[]
  ): 'improving' | 'declining' | 'stable' {
    if (flakyTests.length === 0) return 'improving';

    const avgInterval =
      flakyTests.reduce((sum, test) => sum + test.averageFlakeInterval, 0) / flakyTests.length;

    // If average interval is increasing, trend is improving
    if (avgInterval > 30) return 'improving';
    if (avgInterval < 5) return 'declining';
    return 'stable';
  }

  /**
   * Get recommended action based on flakiness score and pattern
   */
  private getRecommendedAction(flakinessScore: number, pattern: FailurePattern): string {
    const scoreReco =
      flakinessScore > 75
        ? 'URGENT: Disable test and fix immediately'
        : flakinessScore > 50
          ? 'HIGH: Prioritize for fixing in next sprint'
          : 'MEDIUM: Monitor and add to backlog';

    return `${scoreReco}. Root cause likely: ${pattern.type}. ${pattern.suggestedFix}`;
  }
}
