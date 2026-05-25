# Horizontal Scaling & Worker Pool System

Production-grade distributed test execution infrastructure for Qestro.

## Overview

The scaling system enables Qestro to:

- **Distribute tests across multiple workers** for parallel execution
- **Automatically scale worker pools** based on demand
- **Balance execution load** intelligently across workers
- **Handle worker failures** gracefully with retry logic
- **Monitor health** and maintain pool integrity

## Architecture

### Components

1. **WorkerPool** — Manages worker registration, health monitoring, job assignment
2. **AutoScaler** — Evaluates scaling decisions and provisions/decommissions workers
3. **TestShardManager** — Splits test suites across workers using configurable strategies
4. **DistributedExecutor** — Orchestrates end-to-end distributed test execution

### Execution Pipeline

```
User Request (execute tests)
    ↓
DistributedExecutor.executeDistributed()
    ↓
    ├─ Get available workers from pool
    ├─ Shard tests using TestShardManager
    ├─ Dispatch shards to workers
    ├─ Wait for results with timeout
    └─ Aggregate and return results
```

## Key Classes

### WorkerPool

Manages a pool of test execution workers.

#### Methods

```typescript
// Registration
registerWorker(node: WorkerNode): void
deregisterWorker(workerId: string): void
updateHeartbeat(workerId: string, metrics?: {...}): void

// Job Management
getAvailableWorker(): WorkerNode | null
assignJob(workerId: string, jobId: string): Promise<void>
completeJob(workerId: string, jobId: string): void

// Monitoring
getPoolStatus(): PoolStatus
getWorkerCapacity(workerId: string): WorkerCapacity | null

// Lifecycle
drainWorker(workerId: string): Promise<void>
start(): void
stop(): void
```

#### Example

```typescript
const pool = new WorkerPool();
pool.start();

// Register worker
const worker: WorkerNode = {
  id: 'worker-1',
  endpoint: 'http://worker-1:3000',
  capacity: 10,
  // ...
};

pool.registerWorker(worker);

// Assign job
await pool.assignJob('worker-1', 'job-123');

// Complete job
pool.completeJob('worker-1', 'job-123');

// Get status
const status = pool.getPoolStatus();
console.log(status);
// {
//   total: 1,
//   idle: 1,
//   busy: 0,
//   offline: 0,
//   totalCapacity: 10,
//   usedCapacity: 0,
//   utilization: 0
// }
```

### AutoScaler

Dynamically scales worker pool based on load and policy.

#### Policies

```typescript
type ScalingPolicyMode = 'manual' | 'reactive' | 'predictive';

interface ScalingPolicy {
  mode: ScalingPolicyMode;
  minWorkers: number;        // Min pool size
  maxWorkers: number;        // Max pool size
  scaleUpThreshold: number;  // Utilization % to trigger scale-up
  scaleDownThreshold: number; // Idle % to trigger scale-down
  cooldownMinutes: number;   // Time between scaling events
  targetUtilization: number; // Target utilization (0-1)
}
```

#### Methods

```typescript
setPolicy(policy: Partial<ScalingPolicy>): void
evaluateScaling(): Promise<ScalingDecision>
scaleUp(count: number): Promise<WorkerNode[]>
scaleDown(count: number): Promise<void>
getPolicy(): ScalingPolicy
addRule(rule: AutoScaleRule): void
```

#### Example

```typescript
const scaler = new AutoScaler(pool);

// Set policy: reactive scaling, 2-20 workers
scaler.setPolicy({
  mode: 'reactive',
  minWorkers: 2,
  maxWorkers: 20,
  scaleUpThreshold: 80,
  scaleDownThreshold: 30,
  cooldownMinutes: 5,
});

// Evaluate and execute scaling decision
const decision = await scaler.evaluateScaling();

if (decision.action === 'scale-up') {
  const newWorkers = await scaler.scaleUp(decision.count);
  console.log(`Added ${newWorkers.length} workers`);
} else if (decision.action === 'scale-down') {
  await scaler.scaleDown(decision.count);
  console.log(`Removed ${decision.count} workers`);
}

// decision = {
//   action: 'scale-up',
//   count: 3,
//   reason: 'Utilization at 85.0%',
//   timestamp: 1234567890
// }
```

### TestShardManager

Splits test suites across workers for parallel execution.

#### Sharding Strategies

- **round-robin**: Even distribution of tests
- **by-duration**: Balance execution time (requires test metadata)
- **by-file**: Group tests by source file
- **by-tag**: Group tests by tags

#### Methods

```typescript
registerTestMetadata(path: string, estimatedDuration: number, tags?: string[]): void
shardTests(tests: string[], workerCount: number, strategy: ShardStrategy): ExecutionShard[]
collectResults(shards: ExecutionShard[]): Promise<ShardResult[]>
rebalanceShards(shards: ExecutionShard[], metrics: ShardMetrics[]): ExecutionShard[]
```

#### Example

```typescript
const manager = new TestShardManager();

// Register test metadata
manager.registerTestMetadata('tests/auth.spec.ts', 5000);
manager.registerTestMetadata('tests/api.spec.ts', 8000);
manager.registerTestMetadata('tests/ui.spec.ts', 3000);

// Shard for 3 workers with duration-balanced strategy
const shards = manager.shardTests(
  ['tests/auth.spec.ts', 'tests/api.spec.ts', 'tests/ui.spec.ts'],
  3,
  'by-duration'
);

// shards[0] = { tests: ['tests/api.spec.ts'], estimatedDuration: 8000 }
// shards[1] = { tests: ['tests/auth.spec.ts'], estimatedDuration: 5000 }
// shards[2] = { tests: ['tests/ui.spec.ts'], estimatedDuration: 3000 }
```

### DistributedExecutor

Orchestrates distributed test execution across the worker pool.

#### Methods

```typescript
executeDistributed(tests: string[], options: DistributedOptions): Promise<DistributedResult>
getExecutionStatus(executionId: string): ExecutionStatus
retryShard(executionId: string, shardId: string): Promise<void>
cancelExecution(executionId: string): Promise<void>
```

#### Example

```typescript
const executor = new DistributedExecutor(pool, manager);

// Execute tests distributed
const result = await executor.executeDistributed(
  ['test1.ts', 'test2.ts', 'test3.ts'],
  {
    strategy: 'by-duration',
    maxWorkers: 5,
    timeout: 600000, // 10 minutes
    retries: 3,
  }
);

// result = {
//   executionId: 'exec-1234567890',
//   totalTests: 3,
//   passed: 3,
//   failed: 0,
//   skipped: 0,
//   duration: 8000,
//   shards: [...],
//   status: 'success'
// }

// Get status during execution
const status = executor.getExecutionStatus(result.executionId);
console.log(status);
// {
//   executionId: 'exec-1234567890',
//   status: 'running',
//   totalShards: 3,
//   completedShards: 2,
//   progress: 67,
//   startedAt: 1234567890,
//   result: undefined
// }
```

## API Endpoints

### Workers

#### List Workers
```
GET /api/scaling/workers
Response: { workers: WorkerNode[], count: number }
```

#### Register Worker
```
POST /api/scaling/workers
Body: {
  id: string,
  endpoint: string,
  capacity: number,
  region?: string,
  tags?: string[]
}
Response: { worker: WorkerNode }
```

#### Get Worker Details
```
GET /api/scaling/workers/:id
Response: { worker: WorkerNode, capacity: WorkerCapacity }
```

#### Deregister Worker
```
DELETE /api/scaling/workers/:id?graceful=true
Response: { message: string }
```

#### Worker Heartbeat
```
POST /api/scaling/workers/:id/heartbeat
Body: { cpuUsage: number, memoryUsage: number }
Response: { message: string }
```

### Pool

#### Get Pool Status
```
GET /api/scaling/pool/status
Response: {
  status: {
    total: number,
    idle: number,
    busy: number,
    offline: number,
    totalCapacity: number,
    usedCapacity: number,
    utilization: number
  }
}
```

### Test Execution

#### Execute Tests Distributed
```
POST /api/scaling/execute
Body: {
  tests: string[],
  strategy: 'round-robin' | 'by-duration' | 'by-file' | 'by-tag',
  maxWorkers?: number,
  timeout?: number,
  retries?: number
}
Response: {
  result: DistributedResult
}
```

#### Get Execution Status
```
GET /api/scaling/execute/:id
Response: { status: ExecutionStatus }
```

#### Retry Shard
```
POST /api/scaling/execute/:id/retry/:shardId
Response: { message: string }
```

#### Cancel Execution
```
POST /api/scaling/execute/:id/cancel
Response: { message: string }
```

### Auto-Scaling

#### Get Scaling Policy
```
GET /api/scaling/autoscale/policy
Response: { policy: ScalingPolicy }
```

#### Update Scaling Policy
```
PUT /api/scaling/autoscale/policy
Body: Partial<ScalingPolicy>
Response: { policy: ScalingPolicy }
```

#### Evaluate Scaling
```
POST /api/scaling/autoscale/evaluate
Response: { decision: ScalingDecision }
```

## Integration with Job Queue

The DistributedExecutor integrates with Bull job queue:

```typescript
// In job processor
testQueue.process(async (job: Job<TestExecutionPayload>) => {
  const { tests, options } = job.data;

  // Update queue depth for scaling decisions
  const queueSize = await testQueue.count();
  autoScaler.updateQueueDepth(queueSize);

  // Execute distributed
  const result = await executor.executeDistributed(tests, options);

  return result;
});
```

## Worker Communication

Workers communicate with the orchestrator via:

1. **Registration**: POST to `/api/scaling/workers`
2. **Heartbeat**: POST to `/api/scaling/workers/:id/heartbeat` every 10s
3. **Results Callback**: POST back to orchestrator with shard results

Example worker heartbeat loop:

```typescript
setInterval(async () => {
  await fetch('http://orchestrator:3000/api/scaling/workers/worker-1/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cpuUsage: os.cpus().reduce(...),
      memoryUsage: process.memoryUsage().heapUsed / os.totalmem(),
    }),
  });
}, 10000);
```

## Scaling Strategies

### Reactive Scaling

Responds to current load metrics:

```typescript
scaler.setPolicy({
  mode: 'reactive',
  scaleUpThreshold: 80,     // Scale up at 80% utilization
  scaleDownThreshold: 30,   // Scale down at 30% idle
  cooldownMinutes: 5,       // Wait 5 min between changes
});
```

### Predictive Scaling

Pre-scales based on queue depth and historical patterns:

```typescript
scaler.setPolicy({
  mode: 'predictive',
  // Requires historical metrics
});
```

### Manual Scaling

No automatic scaling:

```typescript
scaler.setPolicy({
  mode: 'manual',
});

// Manual provisioning
const newWorkers = await scaler.scaleUp(5);
```

## Testing

Run tests:

```bash
# Unit tests
npm test -- tests/services/scaling.test.ts

# Integration tests
npm test -- tests/routes/scaling.routes.test.ts

# Coverage
npm run test:coverage
```

## Performance Considerations

- **Worker Capacity**: Default 10 jobs/worker. Adjust based on test type
- **Heartbeat Timeout**: 30 seconds. Workers offline after no heartbeat
- **Scaling Cooldown**: 5 minutes between scaling events to prevent thrashing
- **Shard Rebalancing**: After execution, optimize future sharding
- **Queue Depth Monitoring**: Triggers scale-up at 80% capacity utilization

## Troubleshooting

### Workers Going Offline

Check heartbeat endpoint:

```bash
curl -X POST http://orchestrator:3000/api/scaling/workers/worker-1/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"cpuUsage": 50, "memoryUsage": 60}'
```

### Scaling Not Happening

Check policy and utilization:

```bash
curl http://orchestrator:3000/api/scaling/autoscale/policy
curl http://orchestrator:3000/api/scaling/pool/status
```

### Uneven Shard Distribution

Use `by-duration` strategy with registered test metadata:

```typescript
manager.registerTestMetadata('test.ts', 5000); // 5 second estimate
```

## Future Enhancements

- [ ] Predictive scaling using ML
- [ ] Worker affinity/tagging (browser, mobile, API tests)
- [ ] Distributed cache for test dependencies
- [ ] Live test redistribution during execution
- [ ] Cost optimization (spot instances)
