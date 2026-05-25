/**
 * Scaling & Worker Pool Routes
 * API endpoints for distributed test execution
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger.js';
import { WorkerPool } from '../services/scaling/WorkerPool.js';
import { AutoScaler } from '../services/scaling/AutoScaler.js';
import { TestShardManager } from '../services/scaling/TestShardManager.js';
import { DistributedExecutor } from '../services/scaling/DistributedExecutor.js';
import {
  WorkerNode,
  ScalingPolicy,
  DistributedOptions,
  ShardStrategy,
} from '../services/scaling/types.js';

const router = Router();

// Dependency injection (normally from container)
let workerPool: WorkerPool;
let autoScaler: AutoScaler;
let shardManager: TestShardManager;
let executor: DistributedExecutor;

/**
 * Initialize dependencies
 */
export function initializeScalingRoutes(
  pool: WorkerPool,
  scaler: AutoScaler,
  manager: TestShardManager,
  exec: DistributedExecutor
): void {
  workerPool = pool;
  autoScaler = scaler;
  shardManager = manager;
  executor = exec;
}

/**
 * GET /api/scaling/workers
 * List all workers and their status
 */
router.get('/workers', (req: Request, res: Response): void => {
  try {
    const workers = workerPool.getAllWorkers();
    res.json({
      success: true,
      workers,
      count: workers.length,
    });
  } catch (error) {
    logger.error(`Failed to list workers: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to list workers',
    });
  }
});

/**
 * POST /api/scaling/workers
 * Register a new worker
 */
router.post('/workers', (req: Request, res: Response): void => {
  try {
    const { id, endpoint, capacity, region, tags } = req.body;

    if (!id || !endpoint || !capacity) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: id, endpoint, capacity',
      });
      return;
    }

    const worker: WorkerNode = {
      id,
      endpoint,
      status: 'idle',
      capacity,
      activeJobs: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      lastHeartbeat: Date.now(),
      region,
      tags,
    };

    workerPool.registerWorker(worker);
    res.status(201).json({
      success: true,
      worker,
    });
  } catch (error) {
    logger.error(`Failed to register worker: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to register worker',
    });
  }
});

/**
 * DELETE /api/scaling/workers/:id
 * Deregister a worker
 */
router.delete('/workers/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const graceful = req.query.graceful === 'true';

    if (graceful) {
      await workerPool.drainWorker(id);
    }

    workerPool.deregisterWorker(id);
    res.json({
      success: true,
      message: `Worker ${id} deregistered`,
    });
  } catch (error) {
    logger.error(`Failed to deregister worker: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to deregister worker',
    });
  }
});

/**
 * GET /api/scaling/workers/:id
 * Get worker details
 */
router.get('/workers/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const worker = workerPool.getWorker(id);

    if (!worker) {
      res.status(404).json({
        success: false,
        error: `Worker ${id} not found`,
      });
      return;
    }

    const capacity = workerPool.getWorkerCapacity(id);
    res.json({
      success: true,
      worker,
      capacity,
    });
  } catch (error) {
    logger.error(`Failed to get worker: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get worker',
    });
  }
});

/**
 * GET /api/scaling/pool/status
 * Get pool health summary
 */
router.get('/pool/status', (req: Request, res: Response): void => {
  try {
    const status = workerPool.getPoolStatus();
    res.json({
      success: true,
      status,
    });
  } catch (error) {
    logger.error(`Failed to get pool status: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get pool status',
    });
  }
});

/**
 * POST /api/scaling/execute
 * Execute tests distributed across workers
 */
router.post('/execute', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tests, strategy = 'round-robin', maxWorkers, timeout, retries } = req.body as {
      tests: string[];
      strategy: ShardStrategy;
      maxWorkers?: number;
      timeout?: number;
      retries?: number;
    };

    if (!tests || !Array.isArray(tests) || tests.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Missing or empty tests array',
      });
      return;
    }

    const options: DistributedOptions = {
      tests,
      strategy,
      maxWorkers,
      timeout,
      retries,
    };

    const result = await executor.executeDistributed(tests, options);
    res.status(202).json({
      success: true,
      result,
    });
  } catch (error) {
    logger.error(`Failed to execute distributed tests: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to execute distributed tests',
    });
  }
});

/**
 * GET /api/scaling/execute/:id
 * Get execution status
 */
router.get('/execute/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const status = executor.getExecutionStatus(id);
    res.json({
      success: true,
      status,
    });
  } catch (error) {
    logger.error(`Failed to get execution status: ${error}`);
    res.status(404).json({
      success: false,
      error: 'Execution not found',
    });
  }
});

/**
 * POST /api/scaling/execute/:id/retry/:shardId
 * Retry a failed shard
 */
router.post('/execute/:id/retry/:shardId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, shardId } = req.params;
    await executor.retryShard(id, shardId);
    res.json({
      success: true,
      message: `Shard ${shardId} queued for retry`,
    });
  } catch (error) {
    logger.error(`Failed to retry shard: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retry shard',
    });
  }
});

/**
 * POST /api/scaling/execute/:id/cancel
 * Cancel execution
 */
router.post('/execute/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await executor.cancelExecution(id);
    res.json({
      success: true,
      message: `Execution ${id} cancelled`,
    });
  } catch (error) {
    logger.error(`Failed to cancel execution: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel execution',
    });
  }
});

/**
 * POST /api/scaling/autoscale/evaluate
 * Trigger scaling evaluation
 */
router.post('/autoscale/evaluate', async (req: Request, res: Response): Promise<void> => {
  try {
    const decision = await autoScaler.evaluateScaling();

    if (decision.action === 'scale-up') {
      await autoScaler.scaleUp(decision.count);
    } else if (decision.action === 'scale-down') {
      await autoScaler.scaleDown(decision.count);
    }

    res.json({
      success: true,
      decision,
    });
  } catch (error) {
    logger.error(`Failed to evaluate scaling: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to evaluate scaling',
    });
  }
});

/**
 * GET /api/scaling/autoscale/policy
 * Get current autoscaling policy
 */
router.get('/autoscale/policy', (req: Request, res: Response): void => {
  try {
    const policy = autoScaler.getPolicy();
    res.json({
      success: true,
      policy,
    });
  } catch (error) {
    logger.error(`Failed to get autoscale policy: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get autoscale policy',
    });
  }
});

/**
 * PUT /api/scaling/autoscale/policy
 * Update autoscaling policy
 */
router.put('/autoscale/policy', (req: Request, res: Response): void => {
  try {
    const policy = req.body as Partial<ScalingPolicy>;

    if (!policy || typeof policy !== 'object') {
      res.status(400).json({
        success: false,
        error: 'Invalid policy object',
      });
      return;
    }

    autoScaler.setPolicy(policy);
    const updatedPolicy = autoScaler.getPolicy();

    res.json({
      success: true,
      policy: updatedPolicy,
    });
  } catch (error) {
    logger.error(`Failed to update autoscale policy: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to update autoscale policy',
    });
  }
});

/**
 * POST /api/scaling/workers/:id/heartbeat
 * Worker heartbeat endpoint
 */
router.post('/workers/:id/heartbeat', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { cpuUsage, memoryUsage } = req.body;

    workerPool.updateHeartbeat(id, { cpuUsage, memoryUsage });
    res.json({
      success: true,
      message: `Heartbeat received from ${id}`,
    });
  } catch (error) {
    logger.error(`Failed to process heartbeat: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to process heartbeat',
    });
  }
});

export default router;
