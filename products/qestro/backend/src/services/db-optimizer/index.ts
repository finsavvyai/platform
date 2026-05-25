/**
 * Database Optimizer Module - Export all components
 */

export { QueryProfiler } from './QueryProfiler.js';
export { ConnectionPoolOptimizer } from './ConnectionPoolOptimizer.js';
export { QueryCache } from './QueryCache.js';
export { createDBOptimizerRoutes } from './routes.js';

export type {
  QueryProfile,
  SlowQuery,
  IndexSuggestion,
  QueryStats,
  PoolMetrics,
  PoolHealth,
  PoolAlert,
  ConnectionPoolConfig,
  QueryPlanAnalysis,
  CacheInvalidationRule,
} from './types.js';
