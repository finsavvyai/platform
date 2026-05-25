// Export all Electron hooks
export { useElectronDatabase } from './useElectronDatabase';
export { useElectronStorage } from './useElectronStorage';
export { useElectronAI } from './useElectronAI';
export { useElectronUpdater } from './useElectronUpdater';
export { useElectronMetrics } from './useElectronMetrics';
export { useElectronIntegration } from './useElectronIntegration';

// Re-export types for convenience
export type {
  DatabaseConfig,
  DatabaseConnection,
  QueryResult,
  TableInfo,
  ColumnInfo,
  IndexInfo
} from './useElectronDatabase';

export type {
  DatabaseSchema,
  ConversionResult,
  OptimizationResult,
  ExplanationResult,
  GenerationResult,
  AnalysisResult
} from './useElectronAI';

export type {
  UpdateInfo,
  UpdateStatus
} from './useElectronUpdater';

export type {
  DatabaseMetrics,
  Alert,
  AlertStats,
  MonitoringStatus
} from './useElectronMetrics';