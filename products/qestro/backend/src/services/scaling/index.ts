/**
 * Scaling Services Export
 * Central export point for all horizontal scaling components
 */

export { WorkerPool } from './WorkerPool.js';
export { AutoScaler } from './AutoScaler.js';
export { TestShardManager } from './TestShardManager.js';
export { DistributedExecutor } from './DistributedExecutor.js';

export type {
  WorkerNode,
  WorkerStatus,
  WorkerCapacity,
  ExecutionShard,
  ShardResult,
  DistributedResult,
  ScalingPolicy,
  ScalingPolicyMode,
  AutoScaleRule,
  ScalingDecision,
  HealthMetric,
  ShardMetrics,
  ExecutionStatus,
  DistributedOptions,
  JobDistribution,
  ShardStrategy,
} from './types.js';
