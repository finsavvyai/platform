# Scaling System Implementation Guide

Step-by-step guide to integrate the horizontal scaling system into Qestro.

## Phase 1: Core Setup

### 1.1 Initialize Services in Application Startup

**File:** `src/app.ts` or `src/server.ts`

```typescript
import { WorkerPool } from './services/scaling/WorkerPool.js';
import { AutoScaler } from './services/scaling/AutoScaler.js';
import { TestShardManager } from './services/scaling/TestShardManager.js';
import { DistributedExecutor } from './services/scaling/DistributedExecutor.js';
import scalingRouter, { initializeScalingRoutes } from './routes/scaling.routes.js';

// Initialize scaling components
const workerPool = new WorkerPool();
const autoScaler = new AutoScaler(workerPool);
const shardManager = new TestShardManager();
const executor = new DistributedExecutor(workerPool, shardManager);

// Start pool health monitoring
workerPool.start();

// Configure scaling policy
autoScaler.setPolicy({
  mode: 'reactive',
  minWorkers: 2,
  maxWorkers: 20,
  scaleUpThreshold: 80,
  scaleDownThreshold: 30,
  cooldownMinutes: 5,
});

// Initialize routes with dependencies
initializeScalingRoutes(workerPool, autoScaler, shardManager, executor);

// Mount scaling routes
app.use('/api/scaling', scalingRouter);

// Export for use in other modules
export { workerPool, autoScaler, shardManager, executor };
```

### 1.2 Configure Job Queue Integration

**File:** `src/queue/test-job.queue.ts`

```typescript
import { Queue, Worker } from 'bullmq';
import { executor, autoScaler, workerPool } from '../app.js';

const testQueue = new Queue('test-execution', {
  connection: redis,
});

const worker = new Worker('test-execution', async (job) => {
  // Update queue depth for scaling decisions
  const queueSize = await testQueue.count();
  autoScaler.updateQueueDepth(queueSize);

  const { tests, options } = job.data;

  // Execute tests distributed
  const result = await executor.executeDistributed(tests, {
    tests,
    strategy: options.strategy ?? 'round-robin',
    maxWorkers: options.maxWorkers,
    timeout: options.timeout ?? 600000,
    retries: options.retries ?? 3,
  });

  return result;
}, {
  connection: redis,
  concurrency: 1,
});

export default testQueue;
```

### 1.3 Setup Auto-Scaling Cron Job

**File:** `src/jobs/autoscale.cron.ts`

```typescript
import cron from 'node-cron';
import { autoScaler } from '../app.js';
import { Logger } from '../lib/logger.js';

const logger = new Logger('AutoScaleCron');

// Run scaling evaluation every minute
cron.schedule('* * * * *', async () => {
  try {
    const decision = await autoScaler.evaluateScaling();

    if (decision.action === 'scale-up') {
      const newWorkers = await autoScaler.scaleUp(decision.count);
      logger.info(`Scaled up: +${newWorkers.length} workers (${decision.reason})`);
    } else if (decision.action === 'scale-down') {
      await autoScaler.scaleDown(decision.count);
      logger.info(`Scaled down: -${decision.count} workers (${decision.reason})`);
    }
  } catch (error) {
    logger.error(`Auto-scaling failed: ${error}`);
  }
});
```

## Phase 2: Test Metadata Collection

### 2.1 Collect Test Duration Estimates

**File:** `src/services/test-engine.ts`

```typescript
import { shardManager } from '../app.js';

export class TestEngine {
  async loadTests(projectId: string): Promise<TestFile[]> {
    const tests = await db.tests.findMany({ projectId });

    // Register duration estimates
    for (const test of tests) {
      const duration = test.estimatedDuration ?? 5000;
      shardManager.registerTestMetadata(
        test.path,
        duration,
        test.tags
      );
    }

    return tests;
  }
}
```

### 2.2 Update Duration Estimates After Execution

**File:** `src/services/test-analytics.ts`

```typescript
export class TestAnalytics {
  async recordExecution(
    testPath: string,
    duration: number,
    passed: boolean
  ): Promise<void> {
    // Update in database
    await db.tests.update(
      { path: testPath },
      {
        estimatedDuration: Math.round(
          (await db.tests.findOne({ path: testPath }))?.estimatedDuration * 0.8 +
          duration * 0.2 // Exponential moving average
        ),
      }
    );

    // Update in shard manager for future runs
    const test = await db.tests.findOne({ path: testPath });
    shardManager.registerTestMetadata(
      testPath,
      test.estimatedDuration,
      test.tags
    );
  }
}
```

## Phase 3: Worker Management

### 3.1 Worker Registration Service

**File:** `src/services/worker-registry.ts`

```typescript
import { workerPool } from '../app.js';
import { WorkerNode } from '../services/scaling/types.js';

export class WorkerRegistry {
  async registerWorker(
    workerId: string,
    endpoint: string,
    capacity: number,
    tags: string[] = []
  ): Promise<WorkerNode> {
    const worker: WorkerNode = {
      id: workerId,
      endpoint,
      status: 'idle',
      capacity,
      activeJobs: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      lastHeartbeat: Date.now(),
      tags,
    };

    workerPool.registerWorker(worker);
    return worker;
  }

  async deregisterWorker(workerId: string, graceful: boolean = true): Promise<void> {
    if (graceful) {
      await workerPool.drainWorker(workerId);
    }
    workerPool.deregisterWorker(workerId);
  }

  async getPoolStatus() {
    return workerPool.getPoolStatus();
  }
}
```

### 3.2 Worker Heartbeat Middleware

**File:** `src/middleware/worker-heartbeat.ts`

```typescript
import { Router, Request, Response } from 'express';
import { workerPool } from '../app.js';

const router = Router();

// Middleware to process worker heartbeats
router.use((req: Request, res: Response, next) => {
  // Extract worker ID from header
  const workerId = req.headers['x-worker-id'] as string;

  if (workerId) {
    // Parse metrics from body
    const cpuUsage = req.body?.cpuUsage;
    const memoryUsage = req.body?.memoryUsage;

    workerPool.updateHeartbeat(workerId, {
      cpuUsage: cpuUsage ?? 0,
      memoryUsage: memoryUsage ?? 0,
    });

    // Set worker ID in request for logging
    req.workerId = workerId;
  }

  next();
});

export default router;
```

## Phase 4: API Integration

### 4.1 Update Test Execution Endpoint

**File:** `src/controllers/test.controller.ts`

```typescript
import { executor } from '../app.js';
import { Request, Response } from 'express';

export class TestController {
  async executeDistributed(req: Request, res: Response): Promise<void> {
    try {
      const { tests, strategy = 'round-robin', maxWorkers, timeout } = req.body;

      const result = await executor.executeDistributed(tests, {
        tests,
        strategy,
        maxWorkers,
        timeout: timeout ?? 600000,
      });

      res.status(202).json({
        success: true,
        executionId: result.executionId,
        result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getExecutionStatus(req: Request, res: Response): Promise<void> {
    try {
      const { executionId } = req.params;
      const status = executor.getExecutionStatus(executionId);

      res.json({
        success: true,
        status,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: 'Execution not found',
      });
    }
  }
}
```

### 4.2 Add Scaling Status Endpoint

**File:** `src/controllers/scaling.controller.ts`

```typescript
import { workerPool, autoScaler } from '../app.js';
import { Request, Response } from 'express';

export class ScalingController {
  async getSystemStatus(req: Request, res: Response): Promise<void> {
    const poolStatus = workerPool.getPoolStatus();
    const policy = autoScaler.getPolicy();

    res.json({
      success: true,
      pool: poolStatus,
      policy,
      timestamp: Date.now(),
    });
  }
}
```

## Phase 5: Monitoring & Observability

### 5.1 Add Metrics Collection

**File:** `src/services/scaling-metrics.ts`

```typescript
import { workerPool, executor } from '../app.js';
import { Logger } from '../lib/logger.js';

const logger = new Logger('ScalingMetrics');

export class ScalingMetrics {
  private metricsInterval: NodeJS.Timer | null = null;

  start(): void {
    this.metricsInterval = setInterval(() => {
      const poolStatus = workerPool.getPoolStatus();

      // Log metrics
      logger.info('Pool Status', {
        total: poolStatus.total,
        idle: poolStatus.idle,
        busy: poolStatus.busy,
        utilization: `${(poolStatus.utilization * 100).toFixed(1)}%`,
        capacity: `${poolStatus.usedCapacity}/${poolStatus.totalCapacity}`,
      });

      // Push to monitoring system (e.g., Prometheus, Datadog)
      // prometheus.gauge('qestro_worker_pool_size', poolStatus.total);
      // prometheus.gauge('qestro_worker_utilization', poolStatus.utilization);
      // prometheus.gauge('qestro_worker_capacity_used', poolStatus.usedCapacity);
    }, 30000); // Every 30 seconds
  }

  stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }
}
```

### 5.2 Setup Alerts

**File:** `src/services/scaling-alerts.ts`

```typescript
import { workerPool, autoScaler } from '../app.js';
import { Logger } from '../lib/logger.js';

const logger = new Logger('ScalingAlerts');

export class ScalingAlerts {
  checkAndAlert(): void {
    const poolStatus = workerPool.getPoolStatus();

    // Alert if no workers available
    if (poolStatus.total === 0) {
      logger.error('CRITICAL: No workers in pool');
      // Send alert to on-call
    }

    // Alert if utilization > 95%
    if (poolStatus.utilization > 0.95) {
      logger.warn('CRITICAL: Pool utilization critical (>95%)');
      // Send alert
    }

    // Alert if many offline workers
    if (poolStatus.offline > poolStatus.idle) {
      logger.warn('WARNING: More offline than idle workers');
      // Send alert
    }
  }
}
```

## Phase 6: Testing & Validation

### 6.1 End-to-End Test

**File:** `tests/scaling-e2e.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { WorkerPool } from '../src/services/scaling/WorkerPool.js';
import { DistributedExecutor } from '../src/services/scaling/DistributedExecutor.js';
import { TestShardManager } from '../src/services/scaling/TestShardManager.js';

describe('End-to-End Scaling', () => {
  let pool: WorkerPool;
  let executor: DistributedExecutor;

  beforeAll(() => {
    pool = new WorkerPool();
    pool.start();

    const manager = new TestShardManager();
    executor = new DistributedExecutor(pool, manager);

    // Register test workers
    for (let i = 1; i <= 3; i++) {
      pool.registerWorker({
        id: `worker-${i}`,
        endpoint: `http://localhost:300${i}`,
        capacity: 5,
        status: 'idle',
        activeJobs: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        lastHeartbeat: Date.now(),
      });
    }
  });

  afterAll(() => {
    pool.stop();
  });

  it('should execute tests across multiple workers', async () => {
    const tests = [
      'test1.ts',
      'test2.ts',
      'test3.ts',
      'test4.ts',
    ];

    const result = await executor.executeDistributed(tests, {
      tests,
      strategy: 'round-robin',
      timeout: 10000,
    });

    expect(result.status).toBe('success');
    expect(result.totalTests).toBe(4);
    expect(result.shards.length).toBeGreaterThan(0);
  });
});
```

## Phase 7: Production Deployment

### 7.1 Environment Variables

**File:** `.env.production`

```bash
# Scaling
SCALING_MODE=reactive
SCALING_MIN_WORKERS=5
SCALING_MAX_WORKERS=50
SCALING_SCALE_UP_THRESHOLD=80
SCALING_SCALE_DOWN_THRESHOLD=30
SCALING_COOLDOWN_MINUTES=5

# Worker Configuration
WORKER_CAPACITY=10
WORKER_HEARTBEAT_TIMEOUT=30000

# Queue
QUEUE_MAX_RETRIES=3
```

### 7.2 Kubernetes Deployment

**File:** `k8s/scaling-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: qestro-orchestrator
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: orchestrator
        image: qestro:latest
        env:
        - name: SCALING_MODE
          value: "reactive"
        - name: SCALING_MIN_WORKERS
          value: "5"
        - name: SCALING_MAX_WORKERS
          value: "50"

---
apiVersion: HorizontalPodAutoscaler
metadata:
  name: qestro-worker-scaler
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: qestro-worker
  minReplicas: 5
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 80
```

## Validation Checklist

- [ ] All services initialized in application startup
- [ ] Job queue integration complete
- [ ] Auto-scaling cron job running
- [ ] Test metadata collection working
- [ ] Worker registration API working
- [ ] Heartbeat endpoint receiving updates
- [ ] Test execution returning distributed results
- [ ] Scaling decisions being made correctly
- [ ] Metrics being collected and logged
- [ ] Alerts configured and tested
- [ ] E2E tests passing
- [ ] Load tests showing proper scaling behavior

## Common Issues & Solutions

### Issue: Workers Not Registering

**Solution:** Check worker endpoint is accessible from orchestrator
```bash
curl http://worker:3000/health
```

### Issue: Scaling Not Triggering

**Solution:** Verify autoscaling cron is running and policy is set
```bash
ps aux | grep autoscale
# Check logs for "evaluateScaling" entries
```

### Issue: Uneven Load Distribution

**Solution:** Use `by-duration` sharding strategy with test metadata
```typescript
manager.registerTestMetadata('test.ts', estimatedDuration);
```

### Issue: Worker Crashes During Drain

**Solution:** Increase drain timeout and monitor graceful shutdown
```typescript
await workerPool.drainWorker(workerId); // Max 5 min timeout
```

## Next Steps

1. Deploy to staging environment
2. Run load tests to validate scaling behavior
3. Monitor metrics in production
4. Gather feedback from users
5. Fine-tune scaling policy based on usage patterns
