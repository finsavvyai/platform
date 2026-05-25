/**
 * Test Prioritizer
 * Intelligently orders tests for faster feedback based on code changes and risk scoring
 */

import {
  TestPriority,
  TestPriorityLevel,
  CodeChange,
  ChangeContext,
  TestRun,
} from './types.js';

export class TestPrioritizer {
  /**
   * Prioritize tests based on code changes and historical data
   * @param tests Test identifiers
   * @param codeChanges Recent code changes
   * @param testRunHistory Historical test runs
   * @param testMetadata Test metadata including execution time
   * @returns Prioritized tests in execution order
   */
  async prioritizeTests(
    tests: string[],
    codeChanges: CodeChange[],
    testRunHistory: Map<string, TestRun[]>,
    testMetadata: Map<string, { name: string; executionTime: number; businessCritical: boolean }>
  ): Promise<TestPriority[]> {
    const priorities: TestPriority[] = [];

    for (let i = 0; i < tests.length; i++) {
      const testId = tests[i];
      const runs = testRunHistory.get(testId) || [];
      const metadata = testMetadata.get(testId) || {
        name: testId,
        executionTime: 5000,
        businessCritical: false,
      };

      const changeContext = this.buildChangeContext(codeChanges, testId, metadata);
      const riskScore = this.calculateRiskScore(testId, changeContext, runs);
      const failureProbability = this.getFailureProbability(testId, runs);
      const historicalFailureRate = this.calculateHistoricalFailureRate(runs);

      priorities.push({
        testId,
        testName: metadata.name,
        priority: this.classifyPriority(riskScore),
        riskScore,
        estimatedExecutionTime: metadata.executionTime,
        failureProbability,
        historicalFailureRate,
        executionOrder: 0, // Will be set after sorting
      });
    }

    // Sort by priority: critical tests first, then by risk score, then by execution time
    priorities.sort((a, b) => {
      const priorityOrder: Record<TestPriorityLevel, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };

      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      const riskDiff = b.riskScore - a.riskScore;
      if (riskDiff !== 0) return riskDiff;

      return a.estimatedExecutionTime - b.estimatedExecutionTime;
    });

    // Set execution order after sorting
    priorities.forEach((p, index) => {
      p.executionOrder = index + 1;
    });

    return priorities;
  }

  /**
   * Build change context for impact analysis
   */
  private buildChangeContext(
    codeChanges: CodeChange[],
    testId: string,
    metadata: { name: string; executionTime: number; businessCritical: boolean }
  ): ChangeContext {
    const relevantChanges = codeChanges.filter((change) => {
      // Check if test covers this file
      return change.testCoverage?.includes(testId) || this.testNameMatches(testId, change.filePath);
    });

    return {
      recentCommits: codeChanges.length,
      lastAuthor: 'recent', // Simplified; would come from git
      codeChangesAffecting: relevantChanges,
      businessCriticalityScore: metadata.businessCritical ? 1.0 : 0.3,
    };
  }

  /**
   * Check if test name matches file path
   */
  private testNameMatches(testId: string, filePath: string): boolean {
    const testNameParts = testId.toLowerCase().split('-');
    const filePathLower = filePath.toLowerCase();
    return testNameParts.some((part) => filePathLower.includes(part));
  }

  /**
   * Calculate risk score for a test
   * @param testId Test identifier
   * @param changeContext Code change context
   * @param runs Test runs
   * @returns Risk score (0-1)
   */
  calculateRiskScore(testId: string, changeContext: ChangeContext, runs: TestRun[] = []): number {
    // Weight factors
    const codeChangeImpact = this.calculateCodeChangeImpact(changeContext);
    const historicalFailureRate = this.calculateHistoricalFailureRate(runs);
    const businessCriticalityFactor = changeContext.businessCriticalityScore;

    // Composite risk score: code impact (40%) + failure rate (35%) + criticality (25%)
    const riskScore = codeChangeImpact * 0.4 + historicalFailureRate * 0.35 + businessCriticalityFactor * 0.25;

    return Math.min(riskScore, 1.0);
  }

  /**
   * Calculate impact of code changes on test
   */
  private calculateCodeChangeImpact(changeContext: ChangeContext): number {
    if (changeContext.codeChangesAffecting.length === 0) {
      return 0.1; // No direct impact, low risk
    }

    // More code changes = higher impact
    const changeCount = Math.min(changeContext.codeChangesAffecting.length, 5);
    const changeMagnitude = changeContext.codeChangesAffecting.reduce((sum, change) => {
      return sum + (change.modified.length + change.added.length);
    }, 0);

    // Normalize to 0-1
    const countScore = Math.min(changeCount / 5, 1.0);
    const magnitudeScore = Math.min(changeMagnitude / 20, 1.0);

    return (countScore + magnitudeScore) / 2;
  }

  /**
   * Calculate historical failure rate for a test
   */
  private calculateHistoricalFailureRate(runs: TestRun[]): number {
    if (runs.length === 0) return 0.1; // Assume 10% risk if no history

    const failures = runs.filter((r) => r.status === 'fail').length;
    return failures / runs.length;
  }

  /**
   * Get failure probability for a test
   * @param testId Test identifier
   * @param runs Test runs
   * @returns Failure probability (0-1)
   */
  getFailureProbability(testId: string, runs: TestRun[]): number {
    if (runs.length < 3) {
      return 0.2; // Default probability if insufficient data
    }

    // Recent runs weighted more heavily
    const recentRuns = runs.slice(-10);
    const recentFailures = recentRuns.filter((r) => r.status === 'fail').length;
    const recentProbability = recentFailures / recentRuns.length;

    // Overall failure rate
    const overallFailureRate = this.calculateHistoricalFailureRate(runs);

    // Weight recent runs more (70%) than overall trend (30%)
    return recentProbability * 0.7 + overallFailureRate * 0.3;
  }

  /**
   * Classify priority level based on risk score
   */
  private classifyPriority(riskScore: number): TestPriorityLevel {
    if (riskScore >= 0.75) return 'critical';
    if (riskScore >= 0.5) return 'high';
    if (riskScore >= 0.25) return 'medium';
    return 'low';
  }

  /**
   * Estimate total execution time for a set of tests
   * @param testIds Test identifiers
   * @param testMetadata Test metadata
   * @returns Total estimated execution time in milliseconds
   */
  estimateExecutionTime(
    testIds: string[],
    testMetadata: Map<string, { name: string; executionTime: number; businessCritical: boolean }>
  ): number {
    return testIds.reduce((total, testId) => {
      const metadata = testMetadata.get(testId);
      return total + (metadata?.executionTime || 5000);
    }, 0);
  }

  /**
   * Get optimal test execution plan for faster feedback
   * @param allTests All available tests
   * @param codeChanges Recent code changes
   * @param testRunHistory Historical runs
   * @param testMetadata Test metadata
   * @param timeLimit Maximum execution time (milliseconds)
   * @returns Subset of tests to run for fast feedback
   */
  async getFastFeedbackPlan(
    allTests: string[],
    codeChanges: CodeChange[],
    testRunHistory: Map<string, TestRun[]>,
    testMetadata: Map<string, { name: string; executionTime: number; businessCritical: boolean }>,
    timeLimit: number = 300000 // 5 minutes default
  ): Promise<TestPriority[]> {
    const allPrioritized = await this.prioritizeTests(allTests, codeChanges, testRunHistory, testMetadata);

    let totalTime = 0;
    const selectedTests: TestPriority[] = [];

    for (const test of allPrioritized) {
      if (totalTime + test.estimatedExecutionTime <= timeLimit) {
        selectedTests.push(test);
        totalTime += test.estimatedExecutionTime;
      }
    }

    return selectedTests;
  }

  /**
   * Calculate correlation between test and code changes
   * @param testId Test identifier
   * @param changes Code changes
   * @returns Correlation score (0-1)
   */
  getTestCodeCorrelation(testId: string, changes: CodeChange[]): number {
    if (changes.length === 0) return 0;

    const affectingChanges = changes.filter((change) => {
      return change.testCoverage?.includes(testId) || this.testNameMatches(testId, change.filePath);
    });

    return affectingChanges.length / changes.length;
  }
}
