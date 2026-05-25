/**
 * Policy Analytics Types
 *
 * Types for policy analytics, execution metrics, performance,
 * error tracking, usage, compliance, and trend analysis
 */

export interface PolicyAnalytics {
  policyId: string;
  timeRange: TimeRange;
  executions: ExecutionMetrics;
  performance: PerformanceAnalytics;
  errors: ErrorAnalytics;
  usage: UsageAnalytics;
  compliance: ComplianceAnalytics;
  trends: TrendAnalytics;
}

export interface TimeRange {
  start: Date;
  end: Date;
  granularity: 'minute' | 'hour' | 'day' | 'week' | 'month';
}

export interface ExecutionMetrics {
  total: number;
  successful: number;
  failed: number;
  averageDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  throughput: number;
}

export interface PerformanceAnalytics {
  cpuUsage: TimeSeriesData[];
  memoryUsage: TimeSeriesData[];
  responseTime: TimeSeriesData[];
  errorRate: TimeSeriesData[];
  throughput: TimeSeriesData[];
}

export interface ErrorAnalytics {
  errors: ErrorBreakdown[];
  topErrors: TopError[];
  errorTrends: TimeSeriesData[];
  errorPatterns: ErrorPattern[];
}

export interface ErrorBreakdown {
  type: string;
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
}

export interface TopError {
  message: string;
  count: number;
  lastOccurred: Date;
  affectedUsers: number;
  resolution?: string;
}

export interface ErrorPattern {
  pattern: string;
  frequency: number;
  times: Date[];
  context: string;
  suggestedFix?: string;
}

export interface UsageAnalytics {
  topUsers: UserUsage[];
  topResources: ResourceUsage[];
  apiCalls: TimeSeriesData[];
  dataAccess: DataAccessMetrics[];
}

export interface UserUsage {
  userId: string;
  userName: string;
  calls: number;
  avgResponseTime: number;
  errorRate: number;
  lastUsed: Date;
}

export interface ResourceUsage {
  resourceId: string;
  resourceName: string;
  type: string;
  accessCount: number;
  uniqueUsers: number;
  avgResponseTime: number;
}

export interface DataAccessMetrics {
  resourceType: string;
  readOps: number;
  writeOps: number;
  deleteOps: number;
  dataVolume: number;
  accessPatterns: AccessPattern[];
}

export interface AccessPattern {
  pattern: string;
  frequency: number;
  users: string[];
  timeOfDay: string[];
  risk: 'low' | 'medium' | 'high';
}

export interface ComplianceAnalytics {
  frameworks: FrameworkCompliance[];
  controls: ControlCompliance[];
  violations: ComplianceViolation[];
  auditReadiness: AuditReadinessMetrics;
}

export interface FrameworkCompliance {
  framework: string;
  version: string;
  complianceScore: number;
  compliantControls: number;
  totalControls: number;
  lastAssessed: Date;
  gaps: ComplianceGap[];
}

export interface ControlCompliance {
  controlId: string;
  controlName: string;
  framework: string;
  status: 'compliant' | 'non_compliant' | 'partial';
  lastTested: Date;
  evidence: string[];
  gaps: string[];
}

export interface ComplianceViolation {
  id: string;
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  occurredAt: Date;
  resolvedAt?: Date;
  resolution?: string;
  impact: string;
}

export interface ComplianceGap {
  controlId: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  remediation: string;
  estimatedEffort: number;
  priority: number;
}

export interface AuditReadinessMetrics {
  overallScore: number;
  documentationComplete: number;
  testsPassing: number;
  evidenceCollected: number;
  lastAuditDate: Date;
  nextAuditDate: Date;
  criticalGaps: number;
}

export interface TrendAnalytics {
  executionTrends: TimeSeriesData[];
  performanceTrends: TimeSeriesData[];
  errorTrends: TimeSeriesData[];
  usageTrends: TimeSeriesData[];
  predictions: TrendPrediction[];
}

export interface TrendPrediction {
  metric: string;
  prediction: TimeSeriesData[];
  confidence: number;
  model: string;
  factors: PredictionFactor[];
}

export interface PredictionFactor {
  factor: string;
  weight: number;
  correlation: number;
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  metadata?: Record<string, unknown>;
}
