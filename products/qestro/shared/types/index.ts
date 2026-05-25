// Common types used across all Questro components

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: UserRole;
  subscription: Subscription;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  preferences: UserPreferences;
  teams: Team[];
}

export interface UserRole {
  id: string;
  name: 'admin' | 'user' | 'viewer' | 'tester';
  permissions: Permission[];
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: NotificationPreferences;
  aiPreferences: AIPreferences;
  testingPreferences: TestingPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  slack: boolean;
  teams: boolean;
  testResults: boolean;
  securityAlerts: boolean;
  deploymentUpdates: boolean;
}

export interface AIPreferences {
  provider: 'openai' | 'huggingface' | 'local';
  model: string;
  temperature: number;
  maxTokens: number;
  autoGenerate: boolean;
}

export interface TestingPreferences {
  framework: 'jest' | 'mocha' | 'playwright' | 'maestro' | 'auto';
  timeout: number;
  retries: number;
  parallel: boolean;
  coverageThreshold: number;
}

export interface Subscription {
  id: string;
  plan: SubscriptionPlan;
  status: 'active' | 'inactive' | 'canceled' | 'past_due';
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  usage: UsageMetrics;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: PlanFeature[];
  limits: PlanLimits;
}

export interface PlanFeature {
  name: string;
  enabled: boolean;
  description: string;
}

export interface PlanLimits {
  tests: number;
  testRuns: number;
  storage: number; // in bytes
  apiCalls: number;
  aiTokens: number;
  teamMembers: number;
  projects: number;
}

export interface UsageMetrics {
  tests: number;
  testRuns: number;
  storage: number;
  apiCalls: number;
  aiTokens: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  members: TeamMember[];
  projects: Project[];
  createdAt: Date;
  updatedAt: Date;
  settings: TeamSettings;
}

export interface TeamMember {
  id: string;
  user: User;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: Date;
  permissions: Permission[];
}

export interface TeamSettings {
  allowInvites: boolean;
  defaultRole: string;
  requireApproval: boolean;
  sharedProjects: boolean;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  type: ProjectType;
  settings: ProjectSettings;
  repository?: Repository;
  team: Team;
  members: ProjectMember[];
  tests: Test[];
  testRuns: TestRun[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectType {
  id: string;
  name: 'web' | 'mobile' | 'api' | 'database' | 'desktop';
  icon: string;
  supportedPlatforms: string[];
}

export interface ProjectSettings {
  framework: string;
  language: string;
  platform: string;
  autoGenerateTests: boolean;
  securityScanning: boolean;
  performanceTesting: boolean;
  codeCoverage: boolean;
  parallelExecution: boolean;
}

export interface Repository {
  id: string;
  url: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  owner: string;
  name: string;
  branch: string;
  accessToken?: string;
  webhookSecret?: string;
  autoSync: boolean;
}

export interface ProjectMember {
  id: string;
  user: User;
  role: 'owner' | 'admin' | 'developer' | 'tester' | 'viewer';
  permissions: Permission[];
  joinedAt: Date;
}

export interface Test {
  id: string;
  name: string;
  description?: string;
  type: TestType;
  status: TestStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  project: Project;
  createdBy: User;
  tags: string[];
  metadata: TestMetadata;
  content: TestContent;
  execution: TestExecution;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestType {
  id: string;
  name: 'unit' | 'integration' | 'e2e' | 'performance' | 'security' | 'api' | 'database';
  category: 'functional' | 'non-functional' | 'compatibility';
}

export interface TestStatus {
  id: string;
  name: 'draft' | 'active' | 'deprecated' | 'archived';
  description: string;
}

export interface TestMetadata {
  estimatedDuration: number; // in seconds
  complexity: 'simple' | 'medium' | 'complex';
  tags: string[];
  dependencies: string[];
  requirements: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface TestContent {
  format: 'yaml' | 'json' | 'javascript' | 'typescript' | 'python';
  code: string;
  steps: TestStep[];
  assertions: TestAssertion[];
  fixtures: TestFixture[];
  setup?: string;
  teardown?: string;
}

export interface TestStep {
  id: string;
  type: StepType;
  description: string;
  action: string;
  target?: string;
  value?: string;
  timeout?: number;
  retry?: number;
  condition?: string;
}

export type StepType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'scroll'
  | 'wait'
  | 'assert'
  | 'screenshot'
  | 'hover'
  | 'drag'
  | 'upload'
  | 'download'
  | 'execute'
  | 'api_call'
  | 'database_query';

export interface TestAssertion {
  id: string;
  type: AssertionType;
  target: string;
  expected: any;
  operator: AssertionOperator;
  timeout?: number;
  message?: string;
}

export type AssertionType =
  | 'exists'
  | 'visible'
  | 'text'
  | 'value'
  | 'attribute'
  | 'count'
  | 'status_code'
  | 'response_time'
  | 'database_count'
  | 'custom';

export type AssertionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'greater_equal'
  | 'less_equal'
  | 'matches'
  | 'not_matches'
  | 'exists'
  | 'not_exists';

export interface TestFixture {
  id: string;
  name: string;
  type: 'data' | 'mock' | 'setup' | 'cleanup';
  content: any;
  scope: 'test' | 'suite' | 'global';
}

export interface TestExecution {
  platform: ExecutionPlatform;
  browser?: BrowserConfig;
  device?: DeviceConfig;
  environment: string;
  parallel: boolean;
  timeout: number;
  retries: number;
  beforeAll?: string;
  afterAll?: string;
  beforeEach?: string;
  afterEach?: string;
}

export interface ExecutionPlatform {
  name: 'playwright' | 'maestro' | 'jest' | 'mocha' | 'pytest';
  version: string;
  capabilities: string[];
}

export interface BrowserConfig {
  name: 'chromium' | 'firefox' | 'webkit' | 'chrome' | 'edge' | 'safari';
  version?: string;
  headless: boolean;
  viewport: Viewport;
  userAgent?: string;
  locale?: string;
  timezone?: string;
}

export interface DeviceConfig {
  platform: 'ios' | 'android';
  version: string;
  model: string;
  orientation: 'portrait' | 'landscape';
  emulator?: boolean;
  deviceName?: string;
}

export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
}

export interface TestRun {
  id: string;
  test: Test;
  status: TestRunStatus;
  result: TestRunResult;
  execution: TestRunExecution;
  artifacts: TestArtifact[];
  metrics: TestRunMetrics;
  logs: TestLog[];
  triggeredBy: User;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TestRunStatus {
  id: string;
  name: 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'cancelled';
  description: string;
}

export interface TestRunResult {
  status: 'passed' | 'failed' | 'skipped' | 'cancelled';
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number; // in milliseconds
  coverage?: CoverageReport;
  performance?: PerformanceReport;
  security?: SecurityReport;
}

export interface CoverageReport {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
  files: CoverageFile[];
}

export interface CoverageFile {
  path: string;
  lines: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  statements: CoverageMetric;
}

export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
}

export interface PerformanceReport {
  loadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  totalBlockingTime: number;
  memoryUsage: number;
  networkRequests: number;
  bundleSize: number;
}

export interface SecurityReport {
  vulnerabilities: SecurityVulnerability[];
  score: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export interface SecurityVulnerability {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: string;
  cwe?: string;
  cve?: string;
}

export interface TestRunExecution {
  platform: ExecutionPlatform;
  environment: string;
  config: any;
  startedAt: Date;
  completedAt?: Date;
  duration: number;
  retries: number;
  parallel: boolean;
}

export interface TestArtifact {
  id: string;
  name: string;
  type: 'screenshot' | 'video' | 'log' | 'trace' | 'coverage' | 'report';
  url: string;
  size: number;
  mimeType: string;
  createdAt: Date;
}

export interface TestRunMetrics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  totalDuration: number;
  averageTestDuration: number;
  successRate: number;
  reliabilityScore: number;
  performanceScore?: number;
  securityScore?: number;
}

export interface TestLog {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  source: string;
  metadata?: any;
  trace?: string;
}

// WebSocket message types
export interface WebSocketMessage {
  id: string;
  type: string;
  payload: any;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

export interface RecordingSession {
  id: string;
  type: 'web' | 'mobile';
  status: 'active' | 'paused' | 'completed' | 'error';
  userId: string;
  projectId: string;
  settings: RecordingSettings;
  actions: RecordedAction[];
  metadata: RecordingMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordingSettings {
  platform: ExecutionPlatform;
  browser?: BrowserConfig;
  device?: DeviceConfig;
  captureNetwork: boolean;
  captureConsole: boolean;
  captureScreenshots: boolean;
  captureVideo: boolean;
  autoGenerate: boolean;
}

export interface RecordedAction {
  id: string;
  type: StepType;
  timestamp: Date;
  data: any;
  screenshot?: string;
  metadata?: any;
}

export interface RecordingMetadata {
  url?: string;
  userAgent?: string;
  viewport?: Viewport;
  duration?: number;
  actionsCount?: number;
  environment?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  pagination?: PaginationInfo;
  meta?: Record<string, any>;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
  timestamp: Date;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Event types
export interface SystemEvent {
  id: string;
  type: EventType;
  source: string;
  userId?: string;
  data: any;
  timestamp: Date;
}

export type EventType =
  | 'test.created'
  | 'test.updated'
  | 'test.deleted'
  | 'test_run.started'
  | 'test_run.completed'
  | 'test_run.failed'
  | 'recording.started'
  | 'recording.completed'
  | 'user.created'
  | 'user.updated'
  | 'team.created'
  | 'team.updated'
  | 'project.created'
  | 'project.updated'
  | 'subscription.created'
  | 'subscription.updated'
  | 'deployment.started'
  | 'deployment.completed';

// Plugin system types
export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: PluginCategory;
  type: PluginType;
  status: PluginStatus;
  permissions: string[];
  dependencies: PluginDependency[];
  config: PluginConfig;
  hooks: PluginHook[];
  manifest: PluginManifest;
}

export type PluginCategory =
  | 'testing'
  | 'ai'
  | 'analytics'
  | 'security'
  | 'performance'
  | 'integration'
  | 'ui'
  | 'automation';

export type PluginType = 'extension' | 'theme' | 'integration' | 'service';

export type PluginStatus = 'active' | 'inactive' | 'error' | 'updating';

export interface PluginDependency {
  name: string;
  version: string;
  optional: boolean;
}

export interface PluginConfig {
  schema: any;
  values: Record<string, any>;
  required: string[];
}

export interface PluginHook {
  name: string;
  event: string;
  handler: string;
  priority: number;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  main: string;
  icon?: string;
  homepage?: string;
  repository?: string;
  keywords: string[];
  license: string;
  engines: Record<string, string>;
  permissions: string[];
}

export default {
  User,
  Project,
  Test,
  TestRun,
  Team,
  Subscription,
  Plugin,
  ApiResponse,
  WebSocketMessage,
  RecordingSession,
  SystemEvent
};