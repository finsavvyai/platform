// ============================================================================
// Metrics Types
// Extracted from useMetrics.ts for 200-line compliance
// ============================================================================

export interface DatabaseMetrics {
  id: string;
  connectionID: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  activeConnections: number;
  queriesPerSecond: number;
  averageQueryTime: number;
  timestamp: string;
}

export interface MetricsTimeRange {
  startTime: string;
  endTime: string;
}
