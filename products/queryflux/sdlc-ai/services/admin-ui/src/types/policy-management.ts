/**
 * Policy Management Types
 *
 * Enterprise-grade policy management system types for OPA policies
 * with comprehensive security, versioning, and approval workflows
 */

export interface Policy {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  status: PolicyStatus;
  priority: PolicyPriority;
  regoCode: string;
  visualPolicy?: VisualPolicy;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  tenantId: string;
  tags: string[];
  metadata: PolicyMetadata;
  approvalStatus: ApprovalStatus;
  deploymentStatus: DeploymentStatus;
  lastTested?: Date;
  testResults?: PolicyTestResult[];
  versionHistory: PolicyVersion[];
  dependencies: PolicyDependency[];
  impact: PolicyImpact;
  securityContext: PolicySecurityContext;
}

export interface VisualPolicy {
  nodes: PolicyNode[];
  edges: PolicyEdge[];
  layout: LayoutConfig;
}

export interface PolicyNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
  config: NodeConfig;
  security: NodeSecurity;
}

export interface PolicyEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  condition?: string;
  config: EdgeConfig;
  security: EdgeSecurity;
}

export type NodeType =
  | 'input'
  | 'condition'
  | 'action'
  | 'rule'
  | 'function'
  | 'transform'
  | 'validation'
  | 'output'
  | 'decision'
  | 'compliance';

export type EdgeType =
  | 'success'
  | 'failure'
  | 'conditional'
  | 'transform'
  | 'validate';

export interface NodeData {
  label: string;
  description?: string;
  parameters: Record<string, any>;
  logic?: string;
  output?: any;
  errors?: string[];
}

export interface NodeConfig {
  timeout?: number;
  retries?: number;
  cacheable?: boolean;
  parallel?: boolean;
  async?: boolean;
}

export interface NodeSecurity {
  accessLevel: SecurityLevel;
  requiredPermissions: string[];
  auditLog: boolean;
  encryptionRequired: boolean;
  validateInput: boolean;
  sanitizeOutput: boolean;
}

export interface EdgeConfig {
  weight?: number;
  priority?: number;
  condition?: string;
  transform?: string;
}

export interface EdgeSecurity {
  validateData: boolean;
  encryptTransit: boolean;
  auditTransit: boolean;
  rateLimit?: number;
}

export interface LayoutConfig {
  direction: 'TB' | 'BT' | 'LR' | 'RL';
  spacing: { x: number; y: number };
  alignment: 'center' | 'left' | 'right';
  zoom: number;
  viewport: { x: number; y: number; zoom: number };
}

export type PolicyCategory =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'api_security'
  | 'compliance'
  | 'privacy'
  | 'resource_management'
  | 'audit'
  | 'custom';

export type PolicyStatus =
  | 'draft'
  | 'testing'
  | 'review'
  | 'approved'
  | 'deployed'
  | 'deprecated'
  | 'disabled';

export type PolicyPriority =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low';

export type ApprovalStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'requires_changes'
  | 'escalated';

export type DeploymentStatus =
  | 'not_deployed'
  | 'deploying'
  | 'deployed'
  | 'deployment_failed'
  | 'rollback_in_progress'
  | 'rolled_back';

export type SecurityLevel =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'secret'
  | 'top_secret';

export interface PolicyMetadata {
  version: string;
  schema: string;
  compatibility: string[];
  requirements: string[];
  limitations: string[];
  performance: PerformanceMetrics;
  compliance: ComplianceInfo;
  risk: RiskAssessment;
}

export interface PerformanceMetrics {
  maxExecutionTime: number;
  averageExecutionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  throughput: number;
  errorRate: number;
}

export interface ComplianceInfo {
  frameworks: ComplianceFramework[];
  controls: string[];
  certifications: string[];
  lastAudit: Date;
  nextAudit: Date;
  auditScore?: number;
}

export interface ComplianceFramework {
  name: string;
  version: string;
  controls: string[];
  status: 'compliant' | 'non_compliant' | 'partial';
  evidence: string[];
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  factors: RiskFactor[];
  mitigations: string[];
  lastAssessed: Date;
}

export interface RiskFactor {
  type: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  likelihood: 'low' | 'medium' | 'high';
}

export interface PolicyVersion {
  version: number;
  createdAt: Date;
  createdBy: string;
  changelog: string;
  regoCode: string;
  visualPolicy?: VisualPolicy;
  metadata: PolicyMetadata;
  testResults?: PolicyTestResult[];
  checksum: string;
  signature?: string;
  approvedBy?: string;
  approvedAt?: Date;
  deploymentInfo?: DeploymentInfo;
}

export interface PolicyDependency {
  policyId: string;
  policyName: string;
  version: string;
  type: 'hard' | 'soft';
  required: boolean;
  impact: string;
}

export interface PolicyImpact {
  affectedResources: ResourceImpact[];
  estimatedChanges: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  downtimeRisk: 'none' | 'minimal' | 'moderate' | 'significant';
  rollbackComplexity: 'simple' | 'moderate' | 'complex';
  userImpact: UserImpact;
  systemImpact: SystemImpact;
}

export interface ResourceImpact {
  type: 'api' | 'database' | 'service' | 'user' | 'data';
  id: string;
  name: string;
  impact: 'none' | 'read' | 'write' | 'delete' | 'admin';
  description: string;
}

export interface UserImpact {
  affectedUsers: number;
  impactLevel: 'none' | 'minimal' | 'moderate' | 'significant';
  notifications: string[];
  trainingRequired: boolean;
  downtimeWindows: DowntimeWindow[];
}

export interface SystemImpact {
  services: string[];
  databases: string[];
  apis: string[];
  performance: PerformanceImpact;
  availability: AvailabilityImpact;
  security: SecurityImpact;
}

export interface PerformanceImpact {
  latencyIncrease?: number;
  throughputDecrease?: number;
  memoryIncrease?: number;
  cpuIncrease?: number;
}

export interface AvailabilityImpact {
  downtimeRisk: string;
  recoveryTime: number;
  failoverRequired: boolean;
  backupRequired: boolean;
}

export interface SecurityImpact {
  authenticationChanges: string[];
  authorizationChanges: string[];
  dataAccessChanges: string[];
  auditChanges: string[];
  newRisks: string[];
  mitigations: string[];
}

export interface DowntimeWindow {
  start: Date;
  end: Date;
  duration: number;
  affectedServices: string[];
  reason: string;
}

export interface PolicySecurityContext {
  classification: SecurityLevel;
  accessControls: AccessControl[];
  encryption: EncryptionConfig;
  auditLogging: AuditConfig;
  dataRetention: RetentionConfig;
  complianceRequirements: string[];
  securityChecks: SecurityCheck[];
}

export interface AccessControl {
  type: 'RBAC' | 'ABAC' | 'ACL';
  permissions: string[];
  conditions: string[];
  exemptions: string[];
}

export interface EncryptionConfig {
  atRest: boolean;
  inTransit: boolean;
  algorithm: string;
  keyRotation: number;
  keyManagement: string;
}

export interface AuditConfig {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logRetention: number;
  logDestinations: string[];
  sensitiveDataMasking: boolean;
  realTimeAlerts: boolean;
}

export interface RetentionConfig {
  policyData: number;
  auditLogs: number;
  testResults: number;
  versions: number;
  autoDelete: boolean;
}

export interface SecurityCheck {
  type: string;
  enabled: boolean;
  threshold?: number;
  action: 'warn' | 'block' | 'escalate';
  schedule?: string;
}

export interface PolicyTestResult {
  id: string;
  testSuite: string;
  scenario: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  duration: number;
  timestamp: Date;
  input: any;
  expectedOutput: any;
  actualOutput: any;
  errors: TestError[];
  coverage: TestCoverage;
  performance: TestPerformance;
  security: TestSecurity;
}

export interface TestError {
  type: string;
  message: string;
  stack?: string;
  location?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface TestCoverage {
  lines: number;
  branches: number;
  functions: number;
  statements: number;
  scenarios: number;
  uncoveredPaths: string[];
}

export interface TestPerformance {
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  requests: number;
  throughput: number;
}

export interface TestSecurity {
  vulnerabilities: SecurityVulnerability[];
  complianceChecks: ComplianceCheck[];
  dataLeaks: DataLeak[];
}

export interface SecurityVulnerability {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
  cve?: string;
  owasp?: string;
}

export interface ComplianceCheck {
  framework: string;
  control: string;
  status: 'pass' | 'fail' | 'warning';
  evidence: string;
  gap?: string;
}

export interface DataLeak {
  type: string;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  masked: boolean;
}

export interface PolicyTestSuite {
  id: string;
  name: string;
  description: string;
  scenarios: TestScenario[];
  fixtures: TestFixture[];
  config: TestConfig;
  security: TestSecurityConfig;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  given: any;
  when: any;
  then: any;
  tags: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  timeout: number;
  retries: number;
  security: TestScenarioSecurity;
}

export interface TestFixture {
  name: string;
  type: 'data' | 'mock' | 'service';
  content: any;
  dependencies: string[];
}

export interface TestConfig {
  timeout: number;
  parallel: boolean;
  stopOnFailure: boolean;
  environment: Record<string, any>;
  hooks: TestHooks;
  reporting: ReportingConfig;
}

export interface TestHooks {
  beforeAll?: string;
  afterAll?: string;
  beforeEach?: string;
  afterEach?: string;
  onSuccess?: string;
  onFailure?: string;
}

export interface ReportingConfig {
  format: 'json' | 'xml' | 'html' | 'junit';
  destination: string;
  includeCoverage: boolean;
  includePerformance: boolean;
  includeSecurity: boolean;
}

export interface TestSecurityConfig {
  sandbox: boolean;
  isolation: boolean;
  resourceLimits: ResourceLimits;
  networkPolicy: NetworkPolicy;
  dataMasking: boolean;
  auditTest: boolean;
}

export interface ResourceLimits {
  memory: number;
  cpu: number;
  disk: number;
  network: number;
  duration: number;
}

export interface NetworkPolicy {
  allowOutbound: boolean;
  allowedHosts: string[];
  blockedHosts: string[];
  proxyRequired: boolean;
}

export interface TestScenarioSecurity {
  requireAuth: boolean;
  permissions: string[];
  dataClassification: SecurityLevel;
  sanitizeInput: boolean;
  sanitizeOutput: boolean;
  auditScenario: boolean;
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

export type DeploymentEnvironment =
  | 'development'
  | 'testing'
  | 'staging'
  | 'production';

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
  expected: any;
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
  config: any;
  expected: any;
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

export interface PolicyApproval {
  id: string;
  policyId: string;
  version: number;
  type: ApprovalType;
  status: ApprovalStatus;
  requestedBy: string;
  requestedAt: Date;
  reviewers: Reviewer[];
  decisions: ApprovalDecision[];
  deadline?: Date;
  escalationPolicy?: EscalationPolicy;
  conditions: ApprovalCondition[];
  comments: ApprovalComment[];
}

export type ApprovalType =
  | 'deployment'
  | 'change'
  | 'security'
  | 'compliance'
  | 'emergency';

export interface Reviewer {
  id: string;
  name: string;
  email: string;
  role: string;
  required: boolean;
  order?: number;
  delegatedTo?: string;
  votedAt?: Date;
}

export interface ApprovalDecision {
  reviewerId: string;
  decision: 'approve' | 'reject' | 'request_changes';
  comment?: string;
  conditions?: string[];
  timestamp: Date;
  signature?: string;
}

export interface ApprovalCondition {
  type: string;
  description: string;
  required: boolean;
  met: boolean;
  evidence?: string;
}

export interface ApprovalComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: Date;
  type: 'comment' | 'suggestion' | 'issue' | 'approval';
  visibility: 'public' | 'reviewers' | 'private';
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface EscalationPolicy {
  levels: EscalationLevel[];
  enabled: boolean;
  notifyStakeholders: boolean;
  autoApproveAfter?: Date;
  conditions: EscalationCondition[];
}

export interface EscalationLevel {
  level: number;
  delay: number;
  recipients: string[];
  message?: string;
  requireAll: boolean;
}

export interface EscalationCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq';
  value: number;
  action: 'notify' | 'escalate' | 'auto_approve';
}

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  templateType: TemplateType;
  regoTemplate: string;
  visualTemplate?: VisualPolicy;
  parameters: TemplateParameter[];
  metadata: TemplateMetadata;
  security: TemplateSecurity;
  usage: TemplateUsage;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags: string[];
}

export type TemplateType =
  | 'starter'
  | 'advanced'
  | 'compliance'
  | 'security'
  | 'custom';

export interface TemplateParameter {
  name: string;
  type: ParameterType;
  required: boolean;
  defaultValue?: any;
  description: string;
  validation: ParameterValidation;
  options?: ParameterOption[];
  group?: string;
}

export type ParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'enum'
  | 'json'
  | 'rego';

export interface ParameterValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  required: boolean;
  custom?: string;
}

export interface ParameterOption {
  value: any;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface TemplateMetadata {
  version: string;
  compatibility: string[];
  dependencies: string[];
  limitations: string[];
  examples: TemplateExample[];
  documentation: string;
  changelog: TemplateChangelog[];
}

export interface TemplateExample {
  name: string;
  description: string;
  parameters: Record<string, any>;
  result: string;
}

export interface TemplateChangelog {
  version: string;
  date: Date;
  changes: string[];
  breaking: boolean;
}

export interface TemplateSecurity {
  classification: SecurityLevel;
  requiredPermissions: string[];
  accessControls: string[];
  auditRequirements: string[];
  complianceFrameworks: string[];
  securityReview: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface TemplateUsage {
  usedBy: number;
  lastUsed?: Date;
  popularity: number;
  rating: number;
  feedback: TemplateFeedback[];
}

export interface TemplateFeedback {
  userId: string;
  rating: number;
  comment?: string;
  timestamp: Date;
  helpful: boolean;
}

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
  metadata?: Record<string, any>;
}

// API Request/Response Types
export interface CreatePolicyRequest {
  name: string;
  description: string;
  category: PolicyCategory;
  priority: PolicyPriority;
  regoCode: string;
  visualPolicy?: VisualPolicy;
  tags: string[];
  metadata: Partial<PolicyMetadata>;
  templateId?: string;
  parameters?: Record<string, any>;
}

export interface UpdatePolicyRequest {
  name?: string;
  description?: string;
  category?: PolicyCategory;
  priority?: PolicyPriority;
  regoCode?: string;
  visualPolicy?: VisualPolicy;
  tags?: string[];
  metadata?: Partial<PolicyMetadata>;
  version?: number;
}

export interface PolicyListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  filter?: PolicyFilter;
  search?: string;
}

export interface PolicyFilter {
  category?: PolicyCategory[];
  status?: PolicyStatus[];
  priority?: PolicyPriority[];
  tenantId?: string;
  tags?: string[];
  createdBy?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  approvalStatus?: ApprovalStatus[];
  deploymentStatus?: DeploymentStatus[];
}

export interface PolicyListResponse {
  policies: Policy[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ValidatePolicyRequest {
  regoCode: string;
  category: PolicyCategory;
  context?: any;
  strict?: boolean;
}

export interface ValidatePolicyResponse {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  metrics: ValidationMetrics;
}

export interface ValidationError {
  line: number;
  column: number;
  message: string;
  type: 'syntax' | 'semantic' | 'security' | 'performance';
  severity: 'error' | 'warning';
  rule?: string;
  fix?: string;
}

export interface ValidationWarning {
  line: number;
  column: number;
  message: string;
  type: string;
  suggestion?: string;
}

export interface ValidationSuggestion {
  type: string;
  message: string;
  code: string;
  description: string;
}

export interface ValidationMetrics {
  complexity: number;
  maintainability: number;
  testability: number;
  security: number;
  performance: number;
}

export interface TestPolicyRequest {
  policyId: string;
  version?: number;
  testSuite?: string;
  scenarios?: string[];
  context?: any;
  config?: TestConfig;
}

export interface TestPolicyResponse {
  testRun: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  results: PolicyTestResult[];
  summary: TestSummary;
  coverage: TestCoverage;
  artifacts: TestArtifact[];
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  duration: number;
  passRate: number;
  coverage: number;
}

export interface TestArtifact {
  type: 'log' | 'report' | 'trace' | 'screenshot';
  name: string;
  url: string;
  size: number;
  createdAt: Date;
}

export interface DeployPolicyRequest {
  policyId: string;
  version: number;
  environment: DeploymentEnvironment;
  config: Partial<DeploymentConfig>;
  approvalRequired?: boolean;
  approvers?: string[];
}

export interface DeployPolicyResponse {
  deployment: PolicyDeployment;
  status: DeploymentStatus;
  estimatedDuration: number;
  rollbackDeadline: Date;
  monitoring: DeploymentMonitoring;
}

export interface RollbackPolicyRequest {
  deploymentId: string;
  reason: string;
  strategy: 'immediate' | 'graceful' | 'scheduled';
  scheduledAt?: Date;
  config?: Partial<RollbackConfig>;
}

export interface RollbackPolicyResponse {
  rollback: RollbackInfo;
  status: DeploymentStatus;
  estimatedDuration: number;
  impact: PolicyImpact;
}

// UI Component Props Types
export interface PolicyBuilderProps {
  policy?: Policy;
  template?: PolicyTemplate;
  readOnly?: boolean;
  onSave?: (policy: Partial<Policy>) => void;
  onValidate?: (valid: boolean, errors: ValidationError[]) => void;
  onTest?: (policy: Policy) => void;
  onDeploy?: (policy: Policy) => void;
}

export interface RegoEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  readOnly?: boolean;
  theme?: 'light' | 'dark';
  fontSize?: number;
  wordWrap?: boolean;
  minimap?: boolean;
  validation?: ValidatePolicyResponse;
  onValidationChange?: (validation: ValidatePolicyResponse) => void;
}

export interface PolicyTestPanelProps {
  policyId: string;
  version?: number;
  testSuites?: PolicyTestSuite[];
  onTestRun?: (results: TestPolicyResponse) => void;
  onTestSelect?: (scenario: TestScenario) => void;
}

export interface PolicyDeploymentPanelProps {
  policy: Policy;
  deployments: PolicyDeployment[];
  environments: DeploymentEnvironment[];
  onDeploy?: (request: DeployPolicyRequest) => void;
  onRollback?: (request: RollbackPolicyRequest) => void;
  onApproval?: (approval: PolicyApproval) => void;
}

export interface PolicyImpactAnalysisProps {
  policy: Policy;
  compareTo?: Policy;
  onAnalyze?: (impact: PolicyImpact) => void;
}

export interface PolicyVersionHistoryProps {
  policyId: string;
  versions: PolicyVersion[];
  onVersionSelect?: (version: PolicyVersion) => void;
  onVersionCompare?: (v1: PolicyVersion, v2: PolicyVersion) => void;
  onVersionRestore?: (version: PolicyVersion) => void;
}

export interface PolicyApprovalWorkflowProps {
  policy: Policy;
  approval?: PolicyApproval;
  onSubmit?: (approval: PolicyApproval) => void;
  onApprove?: (decision: ApprovalDecision) => void;
  onReject?: (decision: ApprovalDecision) => void;
  onRequestChanges?: (decision: ApprovalDecision) => void;
  onEscalate?: (reason: string) => void;
}
