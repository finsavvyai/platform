// Barrel re-export — public API unchanged
export type { MetricRecord } from './metrics-store';
export {
  collectMetrics,
  storeMetrics,
  getMetrics,
  deleteOldMetrics
} from './metrics-store';
export {
  aggregateMetrics,
  getMetricHistory,
  calculateBaselines,
  compareMetrics
} from './metrics-analysis';
export { exportMetrics } from './metrics-export';
