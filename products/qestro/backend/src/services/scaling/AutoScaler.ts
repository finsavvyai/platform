/**
 * Auto Scaler
 * Dynamically scales worker pool based on load and policy
 */

import { logger } from '../../lib/logger.js';
import {
  ScalingPolicy,
  ScalingDecision,
  WorkerNode,
  AutoScaleRule,
} from './types.js';
import { WorkerPool } from './WorkerPool.js';

const DEFAULT_POLICY: ScalingPolicy = {
  mode: 'reactive',
  minWorkers: 2,
  maxWorkers: 20,
  scaleUpThreshold: 80, // %
  scaleDownThreshold: 30, // %
  cooldownMinutes: 5,
  targetUtilization: 0.75,
};

export class AutoScaler {
  private policy: ScalingPolicy = DEFAULT_POLICY;
  private workerPool: WorkerPool;
  private lastScalingEvent: number = 0;
  private rules: AutoScaleRule[] = [];
  private queueDepth: number = 0;

  constructor(workerPool: WorkerPool) {
    this.workerPool = workerPool;
    this.initializeDefaultRules();
  }

  /**
   * Set scaling policy
   */
  setPolicy(policy: Partial<ScalingPolicy>): void {
    this.policy = { ...this.policy, ...policy };
    logger.info(`Policy updated: mode=${this.policy.mode}, max=${this.policy.maxWorkers}`);
  }

  /**
   * Update queue depth (called by job queue)
   */
  updateQueueDepth(depth: number): void {
    this.queueDepth = depth;
  }

  /**
   * Evaluate if scaling is needed
   */
  async evaluateScaling(): Promise<ScalingDecision> {
    if (this.policy.mode === 'manual') {
      return {
        action: 'none',
        count: 0,
        reason: 'Manual mode',
        timestamp: Date.now(),
      };
    }

    // Check cooldown period
    const timeSinceLastScaling = Date.now() - this.lastScalingEvent;
    const cooldownMs = this.policy.cooldownMinutes * 60 * 1000;

    if (timeSinceLastScaling < cooldownMs) {
      return {
        action: 'none',
        count: 0,
        reason: `In cooldown period (${Math.ceil((cooldownMs - timeSinceLastScaling) / 1000)}s remaining)`,
        timestamp: Date.now(),
      };
    }

    const status = this.workerPool.getPoolStatus();

    // Scale down if too many idle workers
    const idlePercentage = (status.idle / status.total) * 100;
    if (
      idlePercentage > this.policy.scaleDownThreshold &&
      status.total > this.policy.minWorkers
    ) {
      const targetWorkers = Math.max(
        this.policy.minWorkers,
        Math.ceil(status.total * 0.7)
      );
      const workersToRemove = status.total - targetWorkers;

      return {
        action: 'scale-down',
        count: workersToRemove,
        reason: `Idle workers at ${idlePercentage.toFixed(1)}% (threshold: ${this.policy.scaleDownThreshold}%)`,
        timestamp: Date.now(),
      };
    }

    // Scale up if utilization high or queue backing up
    const utilization = status.utilization * 100;
    if (
      (utilization > this.policy.scaleUpThreshold || this.queueDepth > status.totalCapacity * 0.8) &&
      status.total < this.policy.maxWorkers
    ) {
      const targetWorkers = Math.min(
        this.policy.maxWorkers,
        Math.ceil(status.total * 1.5)
      );
      const workersToAdd = targetWorkers - status.total;

      return {
        action: 'scale-up',
        count: workersToAdd,
        reason: `Utilization at ${utilization.toFixed(1)}% or queue backing up (${this.queueDepth} jobs)`,
        timestamp: Date.now(),
      };
    }

    return {
      action: 'none',
      count: 0,
      reason: 'Healthy utilization',
      timestamp: Date.now(),
    };
  }

  /**
   * Scale up by adding workers
   */
  async scaleUp(count: number): Promise<WorkerNode[]> {
    const status = this.workerPool.getPoolStatus();
    const maxAllowed = this.policy.maxWorkers - status.total;

    if (maxAllowed <= 0) {
      logger.warn('Already at max worker limit');
      return [];
    }

    const actualCount = Math.min(count, maxAllowed);
    logger.info(`Scaling up by ${actualCount} workers`);

    // Simulate creating new workers (in production, this would provision VMs/containers)
    const newWorkers: WorkerNode[] = [];
    for (let i = 0; i < actualCount; i++) {
      const workerId = `worker-${Date.now()}-${i}`;
      const worker: WorkerNode = {
        id: workerId,
        endpoint: `http://worker-${i}:3000`, // Would be real endpoint
        status: 'idle',
        capacity: 10,
        activeJobs: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        lastHeartbeat: Date.now(),
        region: 'us-east-1',
      };

      this.workerPool.registerWorker(worker);
      newWorkers.push(worker);
      logger.info(`Created worker: ${workerId}`);
    }

    this.lastScalingEvent = Date.now();
    return newWorkers;
  }

  /**
   * Scale down by removing workers
   */
  async scaleDown(count: number): Promise<void> {
    const status = this.workerPool.getPoolStatus();
    const minAllowed = status.total - this.policy.minWorkers;

    if (minAllowed <= 0) {
      logger.warn('Already at min worker limit');
      return;
    }

    const actualCount = Math.min(count, minAllowed);
    logger.info(`Scaling down by ${actualCount} workers`);

    const workers = this.workerPool.getAllWorkers()
      .filter((w) => w.status !== 'offline')
      .sort((a, b) => a.activeJobs - b.activeJobs)
      .slice(0, actualCount);

    for (const worker of workers) {
      await this.workerPool.drainWorker(worker.id);
      this.workerPool.deregisterWorker(worker.id);
      logger.info(`Removed worker: ${worker.id}`);
    }

    this.lastScalingEvent = Date.now();
  }

  /**
   * Add a custom scaling rule
   */
  addRule(rule: AutoScaleRule): void {
    this.rules.push(rule);
    logger.info(`Rule added: ${rule.condition} ${rule.threshold} -> ${rule.action}`);
  }

  /**
   * Clear all custom rules
   */
  clearRules(): void {
    this.rules = [];
    this.initializeDefaultRules();
  }

  /**
   * Initialize default rules
   */
  private initializeDefaultRules(): void {
    this.rules = [
      {
        condition: 'queue-depth',
        threshold: 100,
        action: 'scale-up',
        delta: 5,
      },
      {
        condition: 'cpu-usage',
        threshold: 90,
        action: 'scale-up',
        delta: 3,
      },
      {
        condition: 'memory-usage',
        threshold: 85,
        action: 'scale-up',
        delta: 2,
      },
    ];
  }

  /**
   * Get current policy
   */
  getPolicy(): ScalingPolicy {
    return { ...this.policy };
  }

  /**
   * Get last scaling decision timestamp
   */
  getLastScalingTimestamp(): number {
    return this.lastScalingEvent;
  }
}
