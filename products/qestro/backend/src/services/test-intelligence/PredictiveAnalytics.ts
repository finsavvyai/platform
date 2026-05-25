/**
 * Predictive Analytics Engine
 * Predicts test failures, trends, and project health using historical patterns
 */

import {
  PredictiveInsight,
  TestTrend,
  TestHealthScore,
  TestRun,
  FailurePattern,
  RiskAssessment,
  ImpactScore,
} from './types.js';

export class PredictiveAnalytics {
  /**
   * Predict which tests will fail in the next execution
   * @param projectId Project identifier
   * @param testIds Test identifiers
   * @param testRunHistory Historical test runs
   * @returns Array of predictive insights
   */
  async predictFailures(
    projectId: string,
    testIds: string[],
    testRunHistory: Map<string, TestRun[]>
  ): Promise<PredictiveInsight[]> {
    const insights: PredictiveInsight[] = [];

    for (const testId of testIds) {
      const runs = testRunHistory.get(testId) || [];

      if (runs.length < 3) {
        continue; // Not enough data for prediction
      }

      const failureProbability = this.calculateFailureProbability(runs);
      const confidence = this.calculatePredictionConfidence(runs);

      if (failureProbability > 0.3) {
        const patterns = this.identifyFailurePatterns(runs);
        const riskAssessment = this.assessRisk(testId, failureProbability, patterns);

        insights.push({
          testId,
          testName: testId,
          predictedToFail: failureProbability > 0.5,
          failureProbability,
          confidence,
          rationale: this.generateRationale(testId, failureProbability, patterns),
          relatedPatterns: patterns,
          suggestedActions: this.suggestActions(patterns, failureProbability),
          riskAssessment,
        });
      }
    }

    return insights;
  }

  /**
   * Calculate failure probability for a test
   * @param runs Test runs
   * @returns Failure probability (0-1)
   */
  private calculateFailureProbability(runs: TestRun[]): number {
    if (runs.length === 0) return 0;

    // Weight recent runs more heavily
    let totalWeight = 0;
    let failureWeight = 0;

    const recentWindow = Math.min(20, runs.length);
    for (let i = runs.length - recentWindow; i < runs.length; i++) {
      const index = i - (runs.length - recentWindow);
      const weight = 0.5 + (index / recentWindow) * 0.5; // 0.5 to 1.0

      totalWeight += weight;
      if (runs[i].status === 'fail') {
        failureWeight += weight;
      }
    }

    return totalWeight > 0 ? failureWeight / totalWeight : 0;
  }

  /**
   * Calculate confidence in prediction
   * @param runs Test runs
   * @returns Confidence score (0-1)
   */
  private calculatePredictionConfidence(runs: TestRun[]): number {
    // More runs = higher confidence
    const sampleConfidence = Math.min(runs.length / 30, 1.0);

    // Consistent patterns = higher confidence
    const consistency = this.calculateConsistency(runs);

    return (sampleConfidence * 0.6 + consistency * 0.4);
  }

  /**
   * Calculate consistency of failure patterns
   */
  private calculateConsistency(runs: TestRun[]): number {
    if (runs.length < 2) return 0;

    const failures = runs.filter((r) => r.status === 'fail').length;
    const passes = runs.filter((r) => r.status === 'pass').length;

    // If all pass or all fail, high consistency
    if (failures === 0 || passes === 0) return 0.9;

    // If roughly 50/50, low consistency (flaky)
    const ratio = Math.min(failures, passes) / Math.max(failures, passes);
    return 1 - ratio;
  }

  /**
   * Identify failure patterns in run history
   */
  private identifyFailurePatterns(runs: TestRun[]): FailurePattern[] {
    const patterns: FailurePattern[] = [];
    const failureRuns = runs.filter((r) => r.status === 'fail');

    if (failureRuns.length === 0) return patterns;

    // Analyze error messages for patterns
    const errorMessages = failureRuns.map((r) => r.errorMessage || '');

    // Timing pattern
    const timingKeywords = ['timeout', 'waited', 'not ready', 'visible'];
    if (errorMessages.some((msg) => timingKeywords.some((kw) => msg.includes(kw)))) {
      patterns.push({
        type: 'timing',
        confidence: 0.7,
        description: 'Failures often related to timing',
        indicators: ['Timeout errors', 'Visibility issues'],
        suggestedFix: 'Increase wait times and use explicit waits',
      });
    }

    // Selector pattern
    const selectorKeywords = ['selector', 'not found', 'no element'];
    if (errorMessages.some((msg) => selectorKeywords.some((kw) => msg.includes(kw)))) {
      patterns.push({
        type: 'selector_change',
        confidence: 0.8,
        description: 'Failures related to element selectors',
        indicators: ['Selector not found', 'Element mismatch'],
        suggestedFix: 'Update selectors or use data-testid',
      });
    }

    // Data pattern
    const dataKeywords = ['null', 'undefined', 'empty', 'parse', 'json'];
    if (errorMessages.some((msg) => dataKeywords.some((kw) => msg.includes(kw)))) {
      patterns.push({
        type: 'data_dependent',
        confidence: 0.65,
        description: 'Failures depend on data state',
        indicators: ['Null/undefined errors', 'Parse failures'],
        suggestedFix: 'Add data validation and fixtures',
      });
    }

    // Network pattern
    const networkKeywords = ['network', 'econnrefused', 'timeout', 'socket'];
    if (errorMessages.some((msg) => networkKeywords.some((kw) => msg.includes(kw)))) {
      patterns.push({
        type: 'network',
        confidence: 0.75,
        description: 'Network-related failures',
        indicators: ['Connection errors', 'Request timeouts'],
        suggestedFix: 'Add retry logic and increase network timeouts',
      });
    }

    return patterns;
  }

  /**
   * Generate rationale for prediction
   */
  private generateRationale(
    testId: string,
    probability: number,
    patterns: FailurePattern[]
  ): string {
    const probPercent = Math.round(probability * 100);
    const patternDesc =
      patterns.length > 0
        ? `identified patterns: ${patterns.map((p) => p.type).join(', ')}`
        : 'historical failure rate indicates risk';

    return `${testId} has ${probPercent}% predicted failure probability based on ${patternDesc}`;
  }

  /**
   * Suggest actions to mitigate risk
   */
  private suggestActions(patterns: FailurePattern[], probability: number): string[] {
    const actions: string[] = [];

    if (probability > 0.7) {
      actions.push('URGENT: Review and fix test immediately');
    } else if (probability > 0.5) {
      actions.push('HIGH: Prioritize for next sprint');
    }

    patterns.forEach((pattern) => {
      actions.push(pattern.suggestedFix);
    });

    actions.push('Monitor execution closely in next run');

    return actions;
  }

  /**
   * Assess risk for a test
   */
  private assessRisk(
    testId: string,
    failureProbability: number,
    patterns: FailurePattern[]
  ): RiskAssessment {
    const riskLevel =
      failureProbability > 0.75
        ? 'critical'
        : failureProbability > 0.5
          ? 'high'
          : failureProbability > 0.3
            ? 'medium'
            : 'low';

    const impactScore: ImpactScore = {
      businessImpact: failureProbability > 0.5 ? 0.8 : 0.4,
      releaseBlockerRisk: failureProbability > 0.6 ? 0.9 : 0.3,
      userImpactScope: failureProbability > 0.5 ? 0.7 : 0.2,
      costOfFailure: failureProbability > 0.7 ? 0.8 : 0.3,
      overallScore: failureProbability,
    };

    const estimatedTime =
      riskLevel === 'critical'
        ? 120
        : riskLevel === 'high'
          ? 90
          : riskLevel === 'medium'
            ? 60
            : 30;

    return {
      riskLevel,
      impactScore,
      mitigationStrategies: [
        'Add explicit synchronization points',
        'Increase timeout thresholds',
        'Add retry logic',
        'Improve error logging',
      ],
      estimatedResolutionTime: estimatedTime,
    };
  }

  /**
   * Get trend analysis over a time period
   * @param projectId Project identifier
   * @param testRunHistory Test run history
   * @param days Number of days to analyze
   * @returns Trend analysis
   */
  async getTrendAnalysis(
    projectId: string,
    testRunHistory: Map<string, TestRun[]>,
    days: number = 30
  ): Promise<TestTrend> {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const passRateHistory: { date: Date; rate: number }[] = [];
    const flakinessHistory: { date: Date; score: number }[] = [];
    const executionTimeHistory: { date: Date; avgTime: number }[] = [];
    const failureCountHistory: { date: Date; count: number }[] = [];

    // Group runs by day
    const dailyStats = new Map<string, { passes: number; fails: number; duration: number; count: number }>();

    for (const runs of testRunHistory.values()) {
      for (const run of runs) {
        if (run.executedAt < startDate) continue;

        const dateKey = run.executedAt.toISOString().split('T')[0];
        const stat = dailyStats.get(dateKey) || {
          passes: 0,
          fails: 0,
          duration: 0,
          count: 0,
        };

        if (run.status === 'pass') stat.passes++;
        if (run.status === 'fail') stat.fails++;

        stat.duration += run.duration;
        stat.count++;

        dailyStats.set(dateKey, stat);
      }
    }

    // Convert to time series
    const sortedDates = Array.from(dailyStats.keys()).sort();
    for (const dateKey of sortedDates) {
      const stat = dailyStats.get(dateKey)!;
      const date = new Date(dateKey);
      const passRate = stat.passes / (stat.passes + stat.fails);

      passRateHistory.push({ date, rate: passRate });
      flakinessHistory.push({ date, score: 1 - passRate });
      executionTimeHistory.push({ date, avgTime: stat.duration / stat.count });
      failureCountHistory.push({ date, count: stat.fails });
    }

    // Calculate improvement percentage
    let improvementPercentage = 0;
    if (passRateHistory.length >= 2) {
      const oldRate = passRateHistory[0].rate;
      const newRate = passRateHistory[passRateHistory.length - 1].rate;
      improvementPercentage = ((newRate - oldRate) / oldRate) * 100;
    }

    return {
      projectId,
      period: days,
      passRateHistory,
      flakinessHistory,
      executionTimeHistory,
      failureCountHistory,
      improvementPercentage,
    };
  }

  /**
   * Calculate overall health score for a project
   * @param projectId Project identifier
   * @param testRunHistory Test run history
   * @returns Health score (0-100)
   */
  async getHealthScore(
    projectId: string,
    testRunHistory: Map<string, TestRun[]>
  ): Promise<TestHealthScore> {
    const allRuns: TestRun[] = [];
    for (const runs of testRunHistory.values()) {
      allRuns.push(...runs);
    }

    const passRate = allRuns.filter((r) => r.status === 'pass').length / allRuns.length;
    const avgDuration = allRuns.reduce((sum, r) => sum + r.duration, 0) / allRuns.length;

    // Calculate component scores
    const passRateScore = passRate * 100; // 0-100
    const flakinessScore = (1 - this.calculateFlakiness(testRunHistory)) * 100; // 0-100
    const executionTimeScore = Math.max(0, 100 - avgDuration / 100); // Penalize slow tests
    const coverageScore = Math.min(testRunHistory.size * 2, 100); // Estimate from test count
    const maintenanceScore = 50 + (passRate * 50); // Based on pass rate

    // Weighted average
    const overallHealth =
      passRateScore * 0.25 +
      flakinessScore * 0.25 +
      executionTimeScore * 0.2 +
      coverageScore * 0.15 +
      maintenanceScore * 0.15;

    const trend = this.calculateHealthTrend(testRunHistory);
    const recommendations = this.generateRecommendations(
      passRate,
      flakinessScore,
      executionTimeScore
    );

    return {
      projectId,
      overallHealth: Math.round(overallHealth),
      flakinessScore: Math.round(flakinessScore),
      coverageScore: Math.round(coverageScore),
      executionTimeScore: Math.round(executionTimeScore),
      maintenanceScore: Math.round(maintenanceScore),
      trend,
      recommendations,
    };
  }

  /**
   * Calculate flakiness for a project
   */
  private calculateFlakiness(testRunHistory: Map<string, TestRun[]>): number {
    let totalFlakiness = 0;
    let count = 0;

    for (const runs of testRunHistory.values()) {
      if (runs.length < 3) continue;

      const failures = runs.filter((r) => r.status === 'fail').length;
      const passes = runs.filter((r) => r.status === 'pass').length;

      if (failures === 0 || passes === 0) {
        continue; // All pass or all fail = not flaky
      }

      const ratio = Math.min(failures, passes) / Math.max(failures, passes);
      totalFlakiness += ratio;
      count++;
    }

    return count > 0 ? totalFlakiness / count : 0;
  }

  /**
   * Calculate health trend
   */
  private calculateHealthTrend(
    testRunHistory: Map<string, TestRun[]>
  ): 'improving' | 'declining' | 'stable' {
    const allRuns: TestRun[] = [];
    for (const runs of testRunHistory.values()) {
      allRuns.push(...runs);
    }

    const sorted = allRuns.sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime());
    const mid = sorted.length / 2;

    const firstHalf = sorted.slice(0, Math.floor(mid));
    const secondHalf = sorted.slice(Math.floor(mid));

    const firstPassRate = firstHalf.filter((r) => r.status === 'pass').length / firstHalf.length;
    const secondPassRate = secondHalf.filter((r) => r.status === 'pass').length / secondHalf.length;

    if (secondPassRate > firstPassRate + 0.05) return 'improving';
    if (secondPassRate < firstPassRate - 0.05) return 'declining';
    return 'stable';
  }

  /**
   * Generate recommendations based on health metrics
   */
  private generateRecommendations(
    passRate: number,
    flakinessScore: number,
    executionTimeScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (passRate < 0.8) {
      recommendations.push('Investigate and fix failing tests');
    }

    if (flakinessScore < 40) {
      recommendations.push('High flakiness detected - review timing and synchronization');
    }

    if (executionTimeScore < 50) {
      recommendations.push('Test suite is slow - optimize or parallelize execution');
    }

    if (passRate > 0.95 && flakinessScore > 80) {
      recommendations.push('Test suite is healthy - continue current practices');
    }

    return recommendations;
  }

  /**
   * Estimate execution time for tests
   * @param testIds Test identifiers
   * @param testRunHistory Test run history
   * @returns Estimated total execution time in milliseconds
   */
  estimateExecutionTime(
    testIds: string[],
    testRunHistory: Map<string, TestRun[]>
  ): number {
    let totalTime = 0;

    for (const testId of testIds) {
      const runs = testRunHistory.get(testId) || [];
      if (runs.length === 0) {
        totalTime += 5000; // Default estimate
      } else {
        const avgTime = runs.reduce((sum, r) => sum + r.duration, 0) / runs.length;
        totalTime += avgTime;
      }
    }

    return totalTime;
  }
}
