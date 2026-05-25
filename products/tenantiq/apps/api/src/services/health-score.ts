// Barrel re-export — split for 200-line file-size rule
export type { Metrics, HealthScore } from './health-score-types';

export {
  calculateHealthScore,
  calculateComponentScore,
  normalizeMetrics,
  applyWeights,
  aggregateScores
} from './health-score-scoring';

export {
  getHealthTrend,
  identifyRisks,
  getHealthHistory,
  detectAnomalies,
  predictHealthDegradation
} from './health-score-analysis';
