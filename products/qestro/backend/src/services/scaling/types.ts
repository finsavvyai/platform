/**
 * Horizontal Scaling & Worker Pool Types
 * Defines data structures for distributed test execution
 */

export type WorkerStatus = 'idle' | 'busy' | 'draining' | 'offline';

export interface WorkerNode {
  id: string;
  endpoint: string; // gRPC or HTTP endpoint
  status: WorkerStatus;
  capacity: number; // max parallel jobs
  activeJobs: number;
  cpuUsage: number; // 0-100%
  memoryUsage: number; // 0-100%
  lastHeartbeat: number; // timestamp ms
  region?: string;
  tags?: string[]; // e.g., ['browser', 'api', 'mobile']
}

export interface WorkerCapacity {
  workerId: string;
  available: number;
  used: number;
  total: number;
  utilization: number; // 0-1
}

export type ShardStrategy = 'round-robin' | 'by-duration' | 'by-file' | 'by-tag';

export interface ExecutionShard {
  id: string;
  workerId: string;
  tests: string[]; // test file paths or IDs
  estimatedDuration: number; // ms
  tags?: string[];
  retryCount: number;
}

export interface ShardResult {
  shardId: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number; // ms
  results: Record<string, { passed: boolean; duration: number; error?: string }>;
}

export interface DistributedResult {
  executionId: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number; // total wall-clock ms
  shards: ShardResult[];
  status: 'success' | 'partial' | 'failed';
}

export type ScalingPolicyMode = 'manual' | 'reactive' | 'predictive';

export interface ScalingPolicy {
  mode: ScalingPolicyMode;
  minWorkers: number;
  maxWorkers: number;
  scaleUpThreshold: number; // queue depth %
  scaleDownThreshold: number; // idle %
  cooldownMinutes: number;
  targetUtilization: number; // 0-1
}

export interface AutoScaleRule {
  condition: 'queue-depth' | 'cpu-usage' | 'memory-usage';
  threshold: number;
  action: 'scale-up' | 'scale-down';
  delta: number; // number of workers to add/remove
}

export interface ScalingDecision {
  action: 'none' | 'scale-up' | 'scale-down';
  count: number;
  reason: string;
  timestamp: number;
}

export interface HealthMetric {
  workerId: string;
  metric: 'cpu' | 'memory' | 'job-processing-time' | 'error-rate';
  value: number;
  timestamp: number;
}

export interface ShardMetrics {
  shardId: string;
  actualDuration: number;
  testCount: number;
  passed: number;
  failed: number;
}

export interface ExecutionStatus {
  executionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalShards: number;
  completedShards: number;
  progress: number; // 0-100%
  startedAt: number;
  completedAt?: number;
  result?: DistributedResult;
}

export interface DistributedOptions {
  tests: string[];
  strategy: ShardStrategy;
  maxWorkers?: number;
  timeout?: number; // ms
  retries?: number;
  tags?: string[];
}

export interface JobDistribution {
  jobId: string;
  workerId: string;
  dispatchedAt: number;
  expectedCompletionTime: number;
  priority: 'low' | 'normal' | 'high';
}
