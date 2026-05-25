/**
 * Monitoring Components Index
 *
 * Exports all monitoring-related components for easy importing
 */

export { default as TaskMonitoringDashboard } from './TaskMonitoringDashboard';
export { default as PerformanceAnalytics } from './PerformanceAnalytics';

// Re-export types if needed
export type {
  TaskMetrics,
  ResourceMetrics,
  Alert,
  PerformanceData,
  TaskExecutionEvent,
} from './TaskMonitoringDashboard';

export type {
  PerformanceAnalyticsProps,
  AnalyticsSummary,
  TaskTypeDistribution,
  TimeRangeOption,
} from './PerformanceAnalytics';