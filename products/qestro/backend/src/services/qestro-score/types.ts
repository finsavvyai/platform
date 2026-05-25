/**
 * Qestro Score Badge System Types
 * Defines score calculation, badge configuration, and trending data
 */

export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type ScoreComponent = 'coverage' | 'health' | 'cicd' | 'quality' | 'performance';

export interface ScoreBreakdown {
  coverage: number;
  health: number;
  cicd: number;
  quality: number;
  performance: number;
}

export interface QestroScore {
  projectId: string;
  totalScore: number;
  grade: ScoreGrade;
  breakdown: ScoreBreakdown;
  weights: Record<ScoreComponent, number>;
  trend: ScoreTrend;
  lastUpdated: Date;
  nextUpdate?: Date;
}

export interface ScoreTrend {
  direction: 'up' | 'down' | 'stable';
  changePercent: number;
  previousScore: number;
  daysToAnalyze: number;
}

export interface BadgeConfig {
  projectId: string;
  format: 'svg' | 'png' | 'json';
  includeGrade: boolean;
  style?: 'flat' | 'flat-square' | 'plastic';
  colorScheme?: Record<ScoreGrade, string>;
}

export interface ScoreHistory {
  projectId: string;
  timestamp: Date;
  score: number;
  grade: ScoreGrade;
  breakdown: ScoreBreakdown;
}

export interface ScoreMetrics {
  testCoveragePercent: number;
  testPassRate: number;
  flakinessRate: number;
  meanTimeToFix: number;
  pipelineReliability: number;
  deployFrequency: number;
  lintScore: number;
  typeScoreCoverage: number;
  codeComplexity: number;
  avgTestTime: number;
  p95TestTime: number;
}

export interface BadgeData {
  projectId: string;
  score: number;
  grade: ScoreGrade;
  color: string;
  lastUpdated: Date;
}
