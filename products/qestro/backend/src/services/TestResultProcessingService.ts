/**
 * Test Result Processing Service - Phase 8
 * Processes, analyzes, and stores test execution results
 */

import { TestResult } from './TestExecutionEngine.js';

export interface ProcessedResult {
  testId: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  timestamp: Date;
  analysis: {
    failureReason?: string;
    performanceIssues: string[];
    recommendations: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  };
  artifacts: {
    screenshots: string[];
    logs: string[];
    videos?: string[];
    traces?: string[];
  };
  metrics: {
    memory: number;
    cpu: number;
    network?: number;
  };
}

export interface TestReport {
  id: string;
  suiteId: string;
  timestamp: Date;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
    duration: number;
    passRate: number;
  };
  results: ProcessedResult[];
  trends: {
    passRateTrend: number;
    durationTrend: number;
    flakiness: number;
  };
}

export class TestResultProcessingService {
  private results: Map<string, ProcessedResult> = new Map();
  private historicalData: Map<string, ProcessedResult[]> = new Map();

  /**
   * Process a single test result
   */
  async processResult(result: TestResult): Promise<ProcessedResult> {
    const analysis = this.analyzeResult(result);
    const artifacts = this.collectArtifacts(result);

    const processed: ProcessedResult = {
      testId: result.testId,
      status: result.status,
      duration: result.duration,
      timestamp: result.endTime,
      analysis,
      artifacts,
      metrics: result.metrics || { memory: 0, cpu: 0 }
    };

    // Store result
    this.results.set(result.testId, processed);

    // Update historical data
    this.updateHistoricalData(result.testId, processed);

    return processed;
  }

  /**
   * Process multiple test results
   */
  async processBatch(results: TestResult[]): Promise<ProcessedResult[]> {
    const processed = await Promise.all(
      results.map(result => this.processResult(result))
    );

    return processed;
  }

  /**
   * Analyze test result for issues and recommendations
   */
  private analyzeResult(result: TestResult): ProcessedResult['analysis'] {
    const performanceIssues: string[] = [];
    const recommendations: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check duration
    if (result.duration > 60000) {
      performanceIssues.push('Test execution time exceeds 60 seconds');
      recommendations.push('Consider breaking down the test into smaller units');
      severity = 'medium';
    }

    // Check memory usage
    if (result.metrics && result.metrics.memory > 500 * 1024 * 1024) {
      performanceIssues.push('High memory usage detected');
      recommendations.push('Review memory leaks and optimize resource usage');
      severity = 'high';
    }

    // Analyze failure
    let failureReason: string | undefined;
    if (result.status === 'failed' || result.status === 'error') {
      failureReason = this.categorizeFailure(result);
      severity = result.status === 'error' ? 'critical' : 'high';

      if (result.error?.includes('timeout')) {
        recommendations.push('Increase timeout or optimize test performance');
      } else if (result.error?.includes('element not found')) {
        recommendations.push('Add explicit waits or verify element selectors');
      } else if (result.error?.includes('network')) {
        recommendations.push('Check network connectivity and API availability');
      }
    }

    return {
      failureReason,
      performanceIssues,
      recommendations,
      severity
    };
  }

  /**
   * Categorize failure reason
   */
  private categorizeFailure(result: TestResult): string {
    if (!result.error) return 'Unknown failure';

    const error = result.error.toLowerCase();

    if (error.includes('timeout')) return 'Timeout';
    if (error.includes('element not found')) return 'Element Not Found';
    if (error.includes('assertion')) return 'Assertion Failed';
    if (error.includes('network')) return 'Network Error';
    if (error.includes('permission')) return 'Permission Denied';
    if (error.includes('memory')) return 'Out of Memory';

    return 'Unknown Error';
  }

  /**
   * Collect test artifacts
   */
  private collectArtifacts(result: TestResult): ProcessedResult['artifacts'] {
    return {
      screenshots: result.screenshots || [],
      logs: result.logs || [],
      videos: [],
      traces: []
    };
  }

  /**
   * Update historical data for trend analysis
   */
  private updateHistoricalData(testId: string, result: ProcessedResult): void {
    if (!this.historicalData.has(testId)) {
      this.historicalData.set(testId, []);
    }

    const history = this.historicalData.get(testId)!;
    history.push(result);

    // Keep only last 100 results
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Generate comprehensive test report
   */
  generateReport(
    suiteId: string,
    results: ProcessedResult[]
  ): TestReport {
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'error').length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    const summary = {
      total: results.length,
      passed,
      failed,
      skipped,
      errors,
      duration: totalDuration,
      passRate: results.length > 0 ? (passed / results.length) * 100 : 0
    };

    const trends = this.calculateTrends(results);

    return {
      id: `report-${Date.now()}`,
      suiteId,
      timestamp: new Date(),
      summary,
      results,
      trends
    };
  }

  /**
   * Calculate trends from historical data
   */
  private calculateTrends(results: ProcessedResult[]): TestReport['trends'] {
    // Simple trend calculation (can be enhanced)
    const recentResults = results.slice(-10);
    const olderResults = results.slice(-20, -10);

    const recentPassRate = recentResults.length > 0
      ? (recentResults.filter(r => r.status === 'passed').length / recentResults.length) * 100
      : 0;

    const olderPassRate = olderResults.length > 0
      ? (olderResults.filter(r => r.status === 'passed').length / olderResults.length) * 100
      : 0;

    const passRateTrend = recentPassRate - olderPassRate;

    const recentAvgDuration = recentResults.length > 0
      ? recentResults.reduce((sum, r) => sum + r.duration, 0) / recentResults.length
      : 0;

    const olderAvgDuration = olderResults.length > 0
      ? olderResults.reduce((sum, r) => sum + r.duration, 0) / olderResults.length
      : 0;

    const durationTrend = recentAvgDuration - olderAvgDuration;

    // Calculate flakiness (tests that alternate between pass/fail)
    const flakiness = this.calculateFlakiness(results);

    return {
      passRateTrend,
      durationTrend,
      flakiness
    };
  }

  /**
   * Calculate test flakiness score
   */
  private calculateFlakiness(results: ProcessedResult[]): number {
    if (results.length < 2) return 0;

    let transitions = 0;
    for (let i = 1; i < results.length; i++) {
      if (results[i].status !== results[i - 1].status) {
        transitions++;
      }
    }

    return (transitions / (results.length - 1)) * 100;
  }

  /**
   * Get test insights
   */
  getTestInsights(testId: string): any {
    const history = this.historicalData.get(testId) || [];
    
    if (history.length === 0) {
      return {
        testId,
        message: 'No historical data available'
      };
    }

    const totalRuns = history.length;
    const passed = history.filter(r => r.status === 'passed').length;
    const failed = history.filter(r => r.status === 'failed').length;
    const avgDuration = history.reduce((sum, r) => sum + r.duration, 0) / totalRuns;
    const flakiness = this.calculateFlakiness(history);

    const commonIssues = this.findCommonIssues(history);

    return {
      testId,
      totalRuns,
      passed,
      failed,
      passRate: (passed / totalRuns) * 100,
      avgDuration,
      flakiness,
      stability: flakiness < 10 ? 'stable' : flakiness < 30 ? 'moderate' : 'unstable',
      commonIssues,
      lastRun: history[history.length - 1]
    };
  }

  /**
   * Find common issues across test runs
   */
  private findCommonIssues(results: ProcessedResult[]): string[] {
    const issueCount = new Map<string, number>();

    results.forEach(result => {
      if (result.analysis.failureReason) {
        const count = issueCount.get(result.analysis.failureReason) || 0;
        issueCount.set(result.analysis.failureReason, count + 1);
      }
    });

    return Array.from(issueCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count]) => `${issue} (${count} occurrences)`);
  }

  /**
   * Get all processed results
   */
  getAllResults(): ProcessedResult[] {
    return Array.from(this.results.values());
  }

  /**
   * Get result by test ID
   */
  getResult(testId: string): ProcessedResult | undefined {
    return this.results.get(testId);
  }

  /**
   * Clear all results
   */
  clearResults(): void {
    this.results.clear();
  }

  /**
   * Export results to JSON
   */
  exportResults(): string {
    return JSON.stringify({
      results: Array.from(this.results.values()),
      timestamp: new Date().toISOString()
    }, null, 2);
  }
}

export default TestResultProcessingService;
