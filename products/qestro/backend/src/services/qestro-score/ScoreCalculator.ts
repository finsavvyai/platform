/**
 * Score Calculator
 * Computes project quality score (0-100) from multiple components
 */

import { QestroScore, ScoreBreakdown, ScoreGrade, ScoreTrend, ScoreMetrics } from './types.js';
import { logger } from '../../utils/logger.js';

class ScoreCalculator {
  private history: Map<string, QestroScore[]> = new Map();

  private scoreWeights = {
    coverage: 0.25,
    health: 0.25,
    cicd: 0.2,
    quality: 0.15,
    performance: 0.15,
  };

  /**
   * Calculate overall project score
   */
  async calculateScore(projectId: string, metrics: ScoreMetrics): Promise<QestroScore> {
    const breakdown = this.calculateBreakdown(metrics);
    const totalScore = this.weightedSum(breakdown);
    const grade = this.getGrade(totalScore);
    const trend = await this.calculateTrend(projectId, totalScore);

    const score: QestroScore = {
      projectId,
      totalScore,
      grade,
      breakdown,
      weights: this.scoreWeights,
      trend,
      lastUpdated: new Date(),
    };

    this.storeHistory(projectId, score);
    logger.info(`Score calculated for project ${projectId}: ${totalScore.toFixed(1)} (${grade})`);

    return score;
  }

  /**
   * Calculate score breakdown by component
   */
  private calculateBreakdown(metrics: ScoreMetrics): ScoreBreakdown {
    const coverage = Math.min(25, (metrics.testCoveragePercent / 100) * 25);
    const health =
      Math.min(10, (metrics.testPassRate / 100) * 10) +
      Math.max(0, 15 - metrics.flakinessRate) +
      Math.max(0, Math.min(5, 100 / (metrics.meanTimeToFix || 1)));

    const cicd =
      Math.min(10, metrics.pipelineReliability * 10) +
      Math.min(10, (metrics.deployFrequency / 10) * 10);

    const quality =
      Math.min(5, metrics.lintScore * 0.05) +
      Math.min(5, metrics.typeScoreCoverage * 0.05) +
      Math.min(5, 10 - Math.min(10, metrics.codeComplexity));

    const performance =
      Math.min(10, Math.max(0, 1000 / (metrics.avgTestTime || 1000)) * 10) +
      Math.min(5, Math.max(0, 2000 / (metrics.p95TestTime || 2000)) * 5);

    return {
      coverage: Math.max(0, Math.min(25, coverage)),
      health: Math.max(0, Math.min(25, health)),
      cicd: Math.max(0, Math.min(20, cicd)),
      quality: Math.max(0, Math.min(15, quality)),
      performance: Math.max(0, Math.min(15, performance)),
    };
  }

  /**
   * Calculate weighted sum of breakdown
   */
  private weightedSum(breakdown: ScoreBreakdown): number {
    return (
      breakdown.coverage * this.scoreWeights.coverage +
      breakdown.health * this.scoreWeights.health +
      breakdown.cicd * this.scoreWeights.cicd +
      breakdown.quality * this.scoreWeights.quality +
      breakdown.performance * this.scoreWeights.performance
    );
  }

  /**
   * Get letter grade from score
   */
  private getGrade(score: number): ScoreGrade {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Calculate score trend vs previous period
   */
  private async calculateTrend(projectId: string, currentScore: number): Promise<ScoreTrend> {
    const history = this.history.get(projectId) || [];

    if (history.length < 2) {
      return {
        direction: 'stable',
        changePercent: 0,
        previousScore: currentScore,
        daysToAnalyze: 0,
      };
    }

    const previousScore = history[history.length - 1].totalScore;
    const change = currentScore - previousScore;
    const changePercent = previousScore > 0 ? (change / previousScore) * 100 : 0;

    const daysToAnalyze = Math.floor(
      (Date.now() - history[0].lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
    );

    let direction: 'up' | 'down' | 'stable' = 'stable';
    if (changePercent > 1) direction = 'up';
    else if (changePercent < -1) direction = 'down';

    return {
      direction,
      changePercent: Math.round(changePercent * 100) / 100,
      previousScore,
      daysToAnalyze,
    };
  }

  /**
   * Store score in history
   */
  private storeHistory(projectId: string, score: QestroScore): void {
    const history = this.history.get(projectId) || [];
    history.push(score);

    if (history.length > 365) {
      history.shift();
    }

    this.history.set(projectId, history);
  }

  /**
   * Get score history for project
   */
  async getHistory(projectId: string, days: number = 30): Promise<QestroScore[]> {
    const history = this.history.get(projectId) || [];
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    return history.filter((h) => h.lastUpdated.getTime() >= cutoff);
  }

  /**
   * Get latest score
   */
  async getLatestScore(projectId: string): Promise<QestroScore | null> {
    const history = this.history.get(projectId) || [];
    return history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Calculate score from raw test metrics (default metrics)
   */
  async calculateScoreFromDefaults(projectId: string, overrides?: Partial<ScoreMetrics>): Promise<QestroScore> {
    const defaultMetrics: ScoreMetrics = {
      testCoveragePercent: 65,
      testPassRate: 95,
      flakinessRate: 5,
      meanTimeToFix: 24,
      pipelineReliability: 0.98,
      deployFrequency: 5,
      lintScore: 85,
      typeScoreCoverage: 80,
      codeComplexity: 8,
      avgTestTime: 2500,
      p95TestTime: 5000,
    };

    const metrics = { ...defaultMetrics, ...overrides };
    return this.calculateScore(projectId, metrics);
  }

  /**
   * Clear history for project
   */
  async clearHistory(projectId: string): Promise<void> {
    this.history.delete(projectId);
  }
}

export const scoreCalculator = new ScoreCalculator();
