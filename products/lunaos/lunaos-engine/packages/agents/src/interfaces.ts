/**
 * Agent Management interfaces and types for Claude Agent Platform
 */

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  version: string;
  description?: string;
  projectId: string;
  config: AgentConfig;
  resourceQuota: ResourceQuota;
  health: AgentHealth;
  status: AgentStatus;
  capabilities: string[];
  dependencies: string[];
  metadata: AgentMetadata;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
}

export interface AgentConfig {
  runtime: AgentRuntime;
  timeout: number;
  retryPolicy: RetryPolicy;
  environment: Record<string, string>;
  capabilities: string[];
  dependencies: AgentDependency[];
  healthCheck: HealthCheckConfig;
  scaling: ScalingConfig;
  security: SecurityConfig;
}

export interface ResourceQuota {
  id?: string;
  cpuCores: number;
  memoryMB: number;
  diskMB: number;
  maxConcurrentTasks: number;
  tokenLimit: number;
  bandwidthMB: number;
  maxInstances: number;
  gpuMemory?: number;
}

export interface AgentHealth {
  status: AgentHealthStatus;
  lastCheck: Date;
  metrics: HealthMetrics;
  checks: HealthCheck[];
  uptime: number;
  restartCount: number;
  errorCount: number;
  lastError?: AgentError;
}

export interface HealthMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  tasks: {
    total: number;
    completed: number;
    failed: number;
    successRate: number;
    avgDuration: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connections: number;
  };
  performance: {
    responseTime: number;
    throughput: number;
    errorRate: number;
  };
}

export interface HealthCheck {
  name: string;
  type: HealthCheckType;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  timestamp: Date;
  details?: Record<string, any>;
  timeout: number;
  interval: number;
}

export interface AgentMetadata {
  tags: string[];
  labels: Record<string, string>;
  category: string;
  owner: string;
  documentation?: string;
  icon?: string;
  color?: string;
  version: string;
  changelog?: string;
  repository?: string;
  examples?: string[];
  pricing?: AgentPricing;
  support: AgentSupport;
}

export interface AgentLifecycle {
  status: AgentStatus;
  transitionHistory: StatusTransition[];
  autoRestart: boolean;
  restartPolicy: RestartPolicy;
  deploymentStrategy: DeploymentStrategy;
  environment: string;
}

export interface AgentVersion {
  version: string;
  agentId: string;
  config: AgentConfig;
  changelog: string;
  createdAt: Date;
  isActive: boolean;
  rollbackFrom?: string;
  deploymentStatus: DeploymentStatus;
  deploymentMetadata?: Record<string, any>;
}

export interface AgentExecution {
  id: string;
  agentId: string;
  taskId: string;
  instanceId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: ExecutionStatus;
  result?: any;
  error?: string;
  logs: ExecutionLog[];
  metrics: ExecutionMetrics;
  resourceUsage: ResourceUsage;
}

export interface ExecutionMetrics {
  cpuTime: number;
  memoryUsage: number;
  diskUsage: number;
  networkIO: number;
  tokensUsed: number;
  requestsProcessed: number;
  errorsEncountered: number;
}

export interface ResourceUsage {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    used: number;
    allocated: number;
    peak: number;
  };
  disk: {
    used: number;
    allocated: number;
  };
  network: {
    inbound: number;
    outbound: number;
  };
}

export interface ExecutionLog {
  timestamp: Date;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  source: string;
}

export interface AgentError {
  code: string;
  message: string;
  timestamp: Date;
  stack?: string;
  context?: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface StatusTransition {
  from: AgentStatus;
  to: AgentStatus;
  timestamp: Date;
  reason?: string;
  triggeredBy: string;
  metadata?: Record<string, any>;
}

// Enums
export type AgentType =
  | 'requirements-analyzer'
  | 'design-architect'
  | 'code-review'
  | 'testing-agent'
  | 'deployment-agent'
  | 'documentation-generator'
  | 'app-generator-openai'
  | 'app-generator-google'
  | 'mobile-generator-expo'
  | 'mobile-generator-swift'
  | 'cloud-migration-agent'
  | 'project-organizer'
  | 'ai-integration-agent'
  | 'rag-processor'
  | 'token-optimizer'
  | 'security-auditor'
  | 'performance-analyzer'
  | 'custom';

export type AgentStatus =
  | 'registered'
  | 'configured'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'updating'
  | 'degraded'
  | 'maintenance'
  | 'archived';

export type AgentHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export type HealthCheckType =
  | 'memory'
  | 'cpu'
  | 'disk'
  | 'network'
  | 'database'
  | 'cache'
  | 'messaging'
  | 'api'
  | 'custom';

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout'
  | 'retrying';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type DeploymentStatus =
  | 'pending'
  | 'deploying'
  | 'deployed'
  | 'failed'
  | 'rolling-back'
  | 'rolled-back'
  | 'cancelled';

export type AgentRuntime =
  | 'nodejs'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'swift'
  | 'docker'
  | 'cloudflare-worker';

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'fixed' | 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
  multiplier?: number;
  retryableErrors: string[];
}

export interface HealthCheckConfig {
  enabled: boolean;
  endpoint?: string;
  interval: number;
  timeout: number;
  checks: HealthCheckDefinition[];
}

export interface HealthCheckDefinition {
  name: string;
  type: HealthCheckType;
  threshold: number;
  critical: boolean;
  script?: string;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  expectedStatus?: number;
  expectedValue?: any;
}

export interface ScalingConfig {
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  targetCPUUtilization: number;
  targetMemoryUtilization: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
  autoScaling: boolean;
}

export interface SecurityConfig {
  enabled: boolean;
  sandboxed: boolean;
  networkPolicy: NetworkPolicy;
  resourceLimits: SecurityLimits;
  permissions: string[];
  allowedDomains: string[];
  encryption: EncryptionConfig;
}

export interface NetworkPolicy {
  inbound: NetworkRule[];
  outbound: NetworkRule[];
  isolated: boolean;
}

export interface NetworkRule {
  protocol: 'tcp' | 'udp' | 'http' | 'https';
  port?: number;
  host?: string;
  path?: string;
  action: 'allow' | 'deny';
}

export interface SecurityLimits {
  maxFileSize: number;
  maxExecutionTime: number;
  maxMemoryUsage: number;
  maxNetworkRequests: number;
  maxFileOperations: number;
}

export interface EncryptionConfig {
  dataAtRest: boolean;
  dataInTransit: boolean;
  algorithm: string;
  keyRotation: boolean;
}

export interface AgentDependency {
  name: string;
  type: 'agent' | 'service' | 'package' | 'external';
  version?: string;
  required: boolean;
  config?: Record<string, any>;
}

export interface RestartPolicy {
  enabled: boolean;
  maxRetries: number;
  delay: number;
  backoffMultiplier: number;
  onFailure: 'restart' | 'stop' | 'escalate';
}

export interface DeploymentStrategy {
  type: 'rolling' | 'blue-green' | 'canary';
  instances: number;
  healthCheckGracePeriod: number;
  rollbackOnFailure: boolean;
  trafficShifting: TrafficShiftingConfig;
}

export interface TrafficShiftingConfig {
  enabled: boolean;
  initialPercentage: number;
  increment: number;
  interval: number;
  healthThreshold: number;
}

export interface AgentPricing {
  model: 'pay-per-use' | 'subscription' | 'hybrid';
  currency: string;
  pricing: PricingTier[];
  freeTier?: FreeTier;
}

export interface PricingTier {
  name: string;
  monthlyPrice: number;
  features: string[];
  limits: {
    requests: number;
    tokens: number;
    concurrentExecutions: number;
    storage: number;
  };
}

export interface FreeTier {
  requestsPerMonth: number;
  tokensPerMonth: number;
  concurrentExecutions: number;
  features: string[];
}

export interface AgentSupport {
  documentation: string;
  examples: string[];
  tutorials: string[];
  community: string;
  email?: string;
  slack?: string;
  responseTime: string;
  availability: string;
}

// Service interfaces
export interface AgentServiceConfig {
  database: {
    url: string;
    poolSize: number;
  };
  cache: {
    enabled: boolean;
    ttl: number;
  };
  messaging: {
    enabled: boolean;
    exchange: string;
    queue: string;
  };
  monitoring: {
    enabled: boolean;
    interval: number;
    retention: number;
  };
  security: {
    encryption: boolean;
    audit: boolean;
  };
}

export interface AgentRegistryConfig {
  autoDiscovery: boolean;
  healthCheckInterval: number;
  maxRetries: number;
  timeout: number;
  cacheEnabled: boolean;
  cacheTTL: number;
}

export interface HealthMonitorConfig {
  interval: number;
  timeout: number;
  thresholds: HealthThresholds;
  alerting: AlertingConfig;
  persistence: boolean;
}

export interface HealthThresholds {
  cpu: number;
  memory: number;
  disk: number;
  responseTime: number;
  errorRate: number;
  uptime: number;
}

export interface AlertingConfig {
  enabled: boolean;
  channels: AlertChannel[];
  severity: AlertSeverity;
  cooldown: number;
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: Record<string, any>;
  enabled: boolean;
}

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

// Resource Management Interfaces
export interface ResourceUsage {
  agentId: string;
  timestamp: Date;
  cpu: {
    used: number;
    allocated: number;
    percentage: number;
  };
  memory: {
    used: number;
    allocated: number;
    percentage: number;
    peak: number;
  };
  disk: {
    used: number;
    allocated: number;
    percentage: number;
  };
  network: {
    inbound: number;
    outbound: number;
  };
  tokens: {
    used: number;
    limit: number;
    remaining: number;
  };
  tasks: {
    running: number;
    maxConcurrent: number;
  };
}

export interface ResourceAlert {
  type: string;
  severity: 'warning' | 'critical' | 'high' | 'medium' | 'low';
  message: string;
  percentage: number;
  timestamp: Date;
}

export interface QuotaViolation {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  actual: number;
  limit: number;
  timestamp: Date;
}

export interface ResourceOptimization {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  suggestions: string[];
  potentialSavings: string;
}

export interface ResourceQuotaExtended extends ResourceQuota {
  maxGpuMemory?: number;
  maxInstances?: number;
}

// Additional Agent Lifecycle interfaces
export interface LifecycleEvent {
  id: string;
  agentId: string;
  action: LifecycleAction;
  status: 'starting' | 'success' | 'failed';
  timestamp: Date;
  metadata?: any;
}

export type LifecycleAction = 'start' | 'stop' | 'restart' | 'pause' | 'resume';

export interface LifecycleConfig {
  autoRestart: boolean;
  maxRestartAttempts: number;
  restartDelayMs: number;
  gracefulShutdownTimeoutMs: number;
  startupTimeoutMs: number;
  healthCheckIntervalMs: number;
}

export interface AgentHealthConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  checks: HealthCheckDefinition[];
}

export interface HealthCheckDefinition {
  name: string;
  type: HealthCheckType;
  threshold: number;
  critical: boolean;
  script?: string;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  expectedStatus?: number;
  expectedValue?: any;
}
