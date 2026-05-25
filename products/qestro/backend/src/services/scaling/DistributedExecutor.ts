/**
 * Distributed Test Executor
 * Orchestrates distributed test execution across worker pool
 */

import { logger } from '../../lib/logger.js';
import {
  DistributedOptions,
  DistributedResult,
  ExecutionShard,
  ExecutionStatus,
  ShardResult,
} from './types.js';
import { WorkerPool } from './WorkerPool.js';
import { TestShardManager } from './TestShardManager.js';

interface ExecutionContext {
  executionId: string;
  shards: ExecutionShard[];
  results: Map<string, ShardResult>;
  startedAt: number;
  completedAt?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export class DistributedExecutor {
  private workerPool: WorkerPool;
  private shardManager: TestShardManager;
  private executions: Map<string, ExecutionContext> = new Map();

  constructor(workerPool: WorkerPool, shardManager: TestShardManager) {
    this.workerPool = workerPool;
    this.shardManager = shardManager;
  }

  /**
   * Execute tests in distributed fashion
   */
  async executeDistributed(
    tests: string[],
    options: DistributedOptions
  ): Promise<DistributedResult> {
    const executionId = `exec-${Date.now()}`;
    logger.info(`Starting distributed execution: ${executionId} (${tests.length} tests)`);

    // Create execution context
    const context: ExecutionContext = {
      executionId,
      shards: [],
      results: new Map(),
      startedAt: Date.now(),
      status: 'pending',
    };

    this.executions.set(executionId, context);

    try {
      // Determine worker count
      const poolStatus = this.workerPool.getPoolStatus();
      const workerCount = Math.min(
        options.maxWorkers ?? poolStatus.idle,
        poolStatus.total
      );

      if (workerCount === 0) {
        throw new Error('No available workers');
      }

      // Shard tests
      context.shards = this.shardManager.shardTests(tests, workerCount, options.strategy);
      context.status = 'running';

      logger.info(`Created ${context.shards.length} shards`);

      // Dispatch shards to workers
      const dispatchedShards: ExecutionShard[] = [];
      for (const shard of context.shards) {
        const worker = this.workerPool.getAvailableWorker();
        if (!worker) {
          logger.warn(`No available worker for shard ${shard.id}`);
          continue;
        }

        shard.workerId = worker.id;
        await this.workerPool.assignJob(worker.id, shard.id);
        dispatchedShards.push(shard);

        // Simulate dispatching to worker (in production, call worker gRPC/HTTP)
        this.dispatchShardToWorker(worker.id, shard, options);
      }

      // Wait for results (with timeout)
      const timeout = options.timeout ?? 600000; // 10 minutes default
      const result = await this.waitForResults(executionId, timeout);

      context.completedAt = Date.now();
      context.status = 'completed';

      return result;
    } catch (error) {
      context.status = 'failed';
      context.completedAt = Date.now();
      logger.error(`Execution ${executionId} failed: ${error}`);

      throw error;
    }
  }

  /**
   * Get execution status
   */
  getExecutionStatus(executionId: string): ExecutionStatus {
    const context = this.executions.get(executionId);
    if (!context) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const completedShards = Array.from(context.results.values()).length;
    const progress = context.shards.length > 0
      ? Math.round((completedShards / context.shards.length) * 100)
      : 0;

    const result = context.status === 'completed'
      ? this.buildResult(context)
      : undefined;

    return {
      executionId,
      status: context.status,
      totalShards: context.shards.length,
      completedShards,
      progress,
      startedAt: context.startedAt,
      completedAt: context.completedAt,
      result,
    };
  }

  /**
   * Dispatch shard to worker (gRPC/HTTP call in production)
   */
  private dispatchShardToWorker(
    workerId: string,
    shard: ExecutionShard,
    options: DistributedOptions
  ): void {
    // In production, this would:
    // 1. Call worker gRPC/HTTP endpoint
    // 2. Pass shard details and test files
    // 3. Set up callback for results

    // Simulate async execution
    setTimeout(() => {
      this.recordShardResult(shard.id, {
        shardId: shard.id,
        passed: shard.tests.length,
        failed: 0,
        skipped: 0,
        duration: shard.estimatedDuration,
        results: {},
      });

      this.workerPool.completeJob(workerId, shard.id);
    }, shard.estimatedDuration);
  }

  /**
   * Record result from completed shard
   */
  private recordShardResult(shardId: string, result: ShardResult): void {
    const executions = Array.from(this.executions.values());
    for (const execution of executions) {
      const shard = execution.shards.find((s) => s.id === shardId);
      if (shard) {
        execution.results.set(shardId, result);
        logger.debug(`Shard ${shardId} completed: ${result.passed}/${shard.tests.length}`);
        break;
      }
    }
  }

  /**
   * Wait for all shards to complete with timeout
   */
  private async waitForResults(executionId: string, timeout: number): Promise<DistributedResult> {
    const context = this.executions.get(executionId)!;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;

        // Check if all shards completed
        if (context.results.size === context.shards.length) {
          clearInterval(checkInterval);
          resolve(this.buildResult(context));
          return;
        }

        // Check timeout
        if (elapsed > timeout) {
          clearInterval(checkInterval);
          const result = this.buildResult(context);
          result.status = 'partial';
          resolve(result);
        }
      }, 1000);
    });
  }

  /**
   * Build aggregated result from all shard results
   */
  private buildResult(context: ExecutionContext): DistributedResult {
    const shards = Array.from(context.results.values());
    const duration = (context.completedAt ?? Date.now()) - context.startedAt;

    const result: DistributedResult = {
      executionId: context.executionId,
      totalTests: context.shards.reduce((sum, s) => sum + s.tests.length, 0),
      passed: 0,
      failed: 0,
      skipped: 0,
      duration,
      shards,
      status: 'success',
    };

    for (const shard of shards) {
      result.passed += shard.passed;
      result.failed += shard.failed;
      result.skipped += shard.skipped;

      if (shard.failed > 0) {
        result.status = result.status === 'success' ? 'partial' : 'failed';
      }
    }

    if (result.failed > 0) {
      result.status = 'failed';
    }

    return result;
  }

  /**
   * Retry failed shards
   */
  async retryShard(executionId: string, shardId: string): Promise<void> {
    const context = this.executions.get(executionId);
    if (!context) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const shard = context.shards.find((s) => s.id === shardId);
    if (!shard) {
      throw new Error(`Shard ${shardId} not found`);
    }

    shard.retryCount += 1;
    if (shard.retryCount > 3) {
      throw new Error(`Shard ${shardId} max retries exceeded`);
    }

    logger.info(`Retrying shard ${shardId} (attempt ${shard.retryCount})`);

    const worker = this.workerPool.getAvailableWorker();
    if (!worker) {
      throw new Error('No available worker for retry');
    }

    shard.workerId = worker.id;
    await this.workerPool.assignJob(worker.id, shardId);

    // Re-dispatch to worker
    this.dispatchShardToWorker(worker.id, shard, {
      tests: [],
      strategy: 'round-robin',
    });
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const context = this.executions.get(executionId);
    if (!context) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (context.status === 'completed') {
      throw new Error(`Execution ${executionId} already completed`);
    }

    // Mark all pending shards for cancellation
    for (const shard of context.shards) {
      if (!context.results.has(shard.id)) {
        this.workerPool.completeJob(shard.workerId, shard.id);
      }
    }

    context.status = 'failed';
    context.completedAt = Date.now();
    logger.info(`Execution ${executionId} cancelled`);
  }
}
