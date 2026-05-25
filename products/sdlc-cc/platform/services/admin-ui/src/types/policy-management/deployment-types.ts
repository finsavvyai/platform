/**
 * Policy Deployment Types - workflows, monitoring, rollback
 */

export type DeploymentStatus =
  | 'not_deployed'
  | 'deploying'
  | 'deployed'
  | 'deployment_failed'
  | 'rollback_in_progress'
  | 'rolled_back';

export type DeploymentEnvironment =
  | 'development'
  | 'testing'
  | 'staging'
  | 'production';

export interface DeploymentInfo {
  environment: DeploymentEnvironment;
  deployedAt: Date;
  deployedBy: string;
  version: number;
  status: DeploymentStatus;
}

export interface PolicyDeployment {
  id: string;
  policyId: string;
  version: number;
  environment: DeploymentEnvironment;
  status: DeploymentStatus;
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  deployedAt?: Date;
  completedAt?: Date;
  rollbackDeadline?: Date;
  config: DeploymentConfig;
  validation: DeploymentValidation;
  monitoring: DeploymentMonitoring;
  rollback?: RollbackInfo;
}

export interface DeploymentConfig {
  strategy: 'blue_green' | 'canary' | 'rolling' | 'immediate';
  canaryPercentage?: number;
  rolloutDuration: number;
  testTraffic?: number;
  validationRequired: boolean;
  autoRollback: boolean;
  rollbackThreshold: number;
  notifications: NotificationConfig[];
}

export interface NotificationConfig {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  recipients: string[];
  events: ('started' | 'approved' | 'deployed' | 'failed' | 'rolled_back')[];
  template?: string;
}

export interface DeploymentValidation {
  healthChecks: HealthCheck[];
  smokeTests: SmokeTest[];
  performanceTests: PerformanceTest[];
  securityTests: SecurityTest[];
  acceptanceTests: AcceptanceTest[];
}

export interface HealthCheck {
  name: string;
  endpoint: string;
  method: string;
  expectedStatus: number;
  timeout: number;
  retries: number;
  interval: number;
}

export interface SmokeTest {
  name: string;
  scenario: string;
  expected: unknown;
  timeout: number;
}

export interface PerformanceTest {
  name: string;
  type: 'load' | 'stress' | 'spike' | 'volume';
  requests: number;
  concurrency: number;
  duration: number;
  thresholds: PerformanceThresholds;
}

export interface PerformanceThresholds {
  responseTime: number;
  errorRate: number;
  throughput: number;
  cpuUsage: number;
  memoryUsage: number;
}

export interface SecurityTest {
  name: string;
  type: 'vulnerability_scan' | 'penetration_test' | 'compliance_check';
  config: Record<string, unknown>;
  expected: unknown;
}

export interface AcceptanceTest {
  name: string;
  criteria: string[];
  automated: boolean;
  required: boolean;
}

export interface DeploymentMonitoring {
  metrics: MetricConfig[];
  logs: LogConfig[];
  alerts: AlertConfig[];
  dashboards: DashboardConfig[];
}

export interface MetricConfig {
  name: string;
  query: string;
  threshold?: number;
  comparison: 'gt' | 'lt' | 'eq';
  aggregation: 'avg' | 'sum' | 'max' | 'min';
  interval: number;
}

export interface LogConfig {
  service: string;
  level: string;
  pattern: string;
  aggregation: boolean;
  alertOnError: boolean;
}

export interface AlertConfig {
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  channels: string[];
  cooldown: number;
  escalation: EscalationConfig[];
}

export interface EscalationConfig {
  level: number;
  delay: number;
  channels: string[];
  message?: string;
}

export interface DashboardConfig {
  name: string;
  widgets: WidgetConfig[];
  refreshInterval: number;
  timeframe: string;
}

export interface WidgetConfig {
  type: string;
  title: string;
  query: string;
  visualization: string;
  position: { x: number; y: number; w: number; h: number };
}

export interface RollbackInfo {
  reason: string;
  triggeredBy: string;
  triggeredAt: Date;
  strategy: 'immediate' | 'graceful' | 'scheduled';
  config: RollbackConfig;
  validation: RollbackValidation;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface RollbackConfig {
  targetVersion: number;
  preserveData: boolean;
  backupRequired: boolean;
  downtimeWindow: number;
  notifications: NotificationConfig[];
}

export interface RollbackValidation {
  dataIntegrityCheck: boolean;
  serviceHealthCheck: boolean;
  userImpactCheck: boolean;
  performanceCheck: boolean;
  securityCheck: boolean;
}