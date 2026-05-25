/**
 * Unit Tests for Horizontal Scaling System
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WorkerPool } from '../../src/services/scaling/WorkerPool.js';
import { AutoScaler } from '../../src/services/scaling/AutoScaler.js';
import { TestShardManager } from '../../src/services/scaling/TestShardManager.js';
import { DistributedExecutor } from '../../src/services/scaling/DistributedExecutor.js';
import { WorkerNode, ScalingPolicy } from '../../src/services/scaling/types.js';

describe('WorkerPool', () => {
  let pool: WorkerPool;

  beforeEach(() => {
    pool = new WorkerPool();
    pool.start();
  });

  afterEach(() => {
    pool.stop();
  });

  it('should register and retrieve workers', () => {
    const worker: WorkerNode = {
      id: 'worker-1',
      endpoint: 'http://localhost:3001',
      status: 'idle',
      capacity: 5,
      activeJobs: 0,
      cpuUsage: 10,
      memoryUsage: 20,
      lastHeartbeat: Date.now(),
    };

    pool.registerWorker(worker);
    const retrieved = pool.getWorker('worker-1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('worker-1');
    expect(retrieved?.status).toBe('idle');
  });

  it('should deregister workers', () => {
    const worker: WorkerNode = {
      id: 'worker-1',
      endpoint: 'http://localhost:3001',
      status: 'idle',
      capacity: 5,
      activeJobs: 0,
      cpuUsage: 10,
      memoryUsage: 20,
      lastHeartbeat: Date.now(),
    };

    pool.registerWorker(worker);
    pool.deregisterWorker('worker-1');

    expect(pool.getWorker('worker-1')).toBeUndefined();
  });

  it('should get available worker with least-loaded selection', () => {
    const worker1: WorkerNode = {
      id: 'worker-1',
      endpoint: 'http://localhost:3001',
      status: 'idle',
      capacity: 5,
      activeJobs: 3,
      cpuUsage: 10,
      memoryUsage: 20,
      lastHeartbeat: Date.now(),
    };

    const worker2: WorkerNode = {
      id: 'worker-2',
      endpoint: 'http://localhost:3002',
      status: 'idle',
      capacity: 5,
      activeJobs: 1,
      cpuUsage: 5,
      memoryUsage: 15,
      lastHeartbeat: Date.now(),
    };

    pool.registerWorker(worker1);
    pool.registerWorker(worker2);

    const available = pool.getAvailableWorker();
    expect(available?.id).toBe('worker-2'); // Least loaded
  });

  it('should assign and complete jobs', async () => {
    const worker: WorkerNode = {
      id: 'worker-1',
      endpoint: 'http://localhost:3001',
      status: 'idle',
      capacity: 5,
      activeJobs: 0,
      cpuUsage: 10,
      memoryUsage: 20,
      lastHeartbeat: Date.now(),
    };

    pool.registerWorker(worker);
    await pool.assignJob('worker-1', 'job-1');

    let assigned = pool.getWorker('worker-1');
    expect(assigned?.activeJobs).toBe(1);
    expect(assigned?.status).toBe('busy');

    pool.completeJob('worker-1', 'job-1');

    assigned = pool.getWorker('worker-1');
    expect(assigned?.activeJobs).toBe(0);
    expect(assigned?.status).toBe('idle');
  });

  it('should return correct pool status', () => {
    const worker1: WorkerNode = {
      id: 'worker-1',
      endpoint: 'http://localhost:3001',
      status: 'idle',
      capacity: 5,
      activeJobs: 2,
      cpuUsage: 10,
      memoryUsage: 20,
      lastHeartbeat: Date.now(),
    };

    const worker2: WorkerNode = {
      id: 'worker-2',
      endpoint: 'http://localhost:3002',
      status: 'idle',
      capacity: 5,
      activeJobs: 0,
      cpuUsage: 5,
      memoryUsage: 15,
      lastHeartbeat: Date.now(),
    };

    pool.registerWorker(worker1);
    pool.registerWorker(worker2);

    const status = pool.getPoolStatus();

    expect(status.total).toBe(2);
    expect(status.idle).toBe(2);
    expect(status.busy).toBe(0);
    expect(status.totalCapacity).toBe(10);
    expect(status.usedCapacity).toBe(2);
    expect(status.utilization).toBeCloseTo(0.2);
  });

  it('should handle worker at capacity', async () => {
    const worker: WorkerNode = {
      id: 'worker-1',
      endpoint: 'http://localhost:3001',
      status: 'idle',
      capacity: 2,
      activeJobs: 2,
      cpuUsage: 10,
      memoryUsage: 20,
      lastHeartbeat: Date.now(),
    };

    pool.registerWorker(worker);

    expect(await expect(pool.assignJob('worker-1', 'job-1')).rejects.toThrow()).toBeTruthy();
  });

  it('should update heartbeat and detect offline workers', (done) => {
    const worker: WorkerNode = {
      id: 'worker-1',
      endpoint: 'http://localhost:3001',
      status: 'idle',
      capacity: 5,
      activeJobs: 0,
      cpuUsage: 10,
      memoryUsage: 20,
      lastHeartbeat: Date.now() - 40000, // 40 seconds ago
    };

    pool.registerWorker(worker);

    // Worker should be marked offline after health check
    setTimeout(() => {
      const retrieved = pool.getWorker('worker-1');
      expect(retrieved?.status).toBe('offline');
      done();
    }, 1500);
  });
});

describe('TestShardManager', () => {
  let manager: TestShardManager;

  beforeEach(() => {
    manager = new TestShardManager();
  });

  it('should shard tests round-robin', () => {
    const tests = ['test1.ts', 'test2.ts', 'test3.ts', 'test4.ts'];
    const shards = manager.shardTests(tests, 2, 'round-robin');

    expect(shards.length).toBe(2);
    expect(shards[0].tests.length).toBe(2);
    expect(shards[1].tests.length).toBe(2);
    expect(shards[0].tests).toContain('test1.ts');
    expect(shards[0].tests).toContain('test3.ts');
    expect(shards[1].tests).toContain('test2.ts');
    expect(shards[1].tests).toContain('test4.ts');
  });

  it('should shard tests by duration (balanced load)', () => {
    const tests = ['test1.ts', 'test2.ts', 'test3.ts', 'test4.ts'];
    manager.registerTestMetadata('test1.ts', 10000);
    manager.registerTestMetadata('test2.ts', 5000);
    manager.registerTestMetadata('test3.ts', 8000);
    manager.registerTestMetadata('test4.ts', 2000);

    const shards = manager.shardTests(tests, 2, 'by-duration');

    expect(shards.length).toBe(2);
    // Longest test (test1: 10s) should be on one shard, balanced with shorter tests
    const shard0Duration = shards[0].estimatedDuration;
    const shard1Duration = shards[1].estimatedDuration;

    expect(Math.abs(shard0Duration - shard1Duration)).toBeLessThan(5000);
  });

  it('should handle single shard', () => {
    const tests = ['test1.ts', 'test2.ts'];
    const shards = manager.shardTests(tests, 1, 'round-robin');

    expect(shards.length).toBe(1);
    expect(shards[0].tests.length).toBe(2);
  });

  it('should throw on zero workers', () => {
    const tests = ['test1.ts'];
    expect(() => manager.shardTests(tests, 0, 'round-robin')).toThrow();
  });

  it('should return empty shards for empty tests', () => {
    const tests: string[] = [];
    const shards = manager.shardTests(tests, 2, 'round-robin');

    expect(shards.length).toBe(0);
  });
});

describe('AutoScaler', () => {
  let pool: WorkerPool;
  let scaler: AutoScaler;

  beforeEach(() => {
    pool = new WorkerPool();
    scaler = new AutoScaler(pool);
  });

  it('should return no action in manual mode', async () => {
    scaler.setPolicy({ mode: 'manual' });
    const decision = await scaler.evaluateScaling();

    expect(decision.action).toBe('none');
  });

  it('should decide to scale up when utilization high', async () => {
    scaler.setPolicy({
      mode: 'reactive',
      minWorkers: 1,
      maxWorkers: 10,
      scaleUpThreshold: 80,
      cooldownMinutes: 0,
    });

    const worker: WorkerNode = {
      id: 'worker-1',
      endpoint: 'http://localhost:3001',
      status: 'busy',
      capacity: 5,
      activeJobs: 5,
      cpuUsage: 90,
      memoryUsage: 80,
      lastHeartbeat: Date.now(),
    };

    pool.registerWorker(worker);
    const decision = await scaler.evaluateScaling();

    expect(decision.action).toBe('scale-up');
    expect(decision.count).toBeGreaterThan(0);
  });

  it('should decide to scale down when idle high', async () => {
    scaler.setPolicy({
      mode: 'reactive',
      minWorkers: 1,
      maxWorkers: 10,
      scaleDownThreshold: 50,
      cooldownMinutes: 0,
    });

    const worker1: WorkerNode = {
      id: 'worker-1',
      endpoint: 'http://localhost:3001',
      status: 'idle',
      capacity: 5,
      activeJobs: 0,
      cpuUsage: 10,
      memoryUsage: 20,
      lastHeartbeat: Date.now(),
    };

    const worker2: WorkerNode = {
      id: 'worker-2',
      endpoint: 'http://localhost:3002',
      status: 'idle',
      capacity: 5,
      activeJobs: 0,
      cpuUsage: 5,
      memoryUsage: 15,
      lastHeartbeat: Date.now(),
    };

    pool.registerWorker(worker1);
    pool.registerWorker(worker2);

    const decision = await scaler.evaluateScaling();
    expect(decision.action).toBe('scale-down');
  });

  it('should respect cooldown period', async () => {
    scaler.setPolicy({
      mode: 'reactive',
      minWorkers: 1,
      maxWorkers: 10,
      scaleUpThreshold: 80,
      cooldownMinutes: 1,
    });

    const worker: WorkerNode = {
      id: 'worker-1',
      endpoint: 'http://localhost:3001',
      status: 'busy',
      capacity: 5,
      activeJobs: 5,
      cpuUsage: 90,
      memoryUsage: 80,
      lastHeartbeat: Date.now(),
    };

    pool.registerWorker(worker);

    // First scaling
    const decision1 = await scaler.evaluateScaling();
    expect(decision1.action).toBe('scale-up');

    // Immediate second evaluation should be blocked by cooldown
    const decision2 = await scaler.evaluateScaling();
    expect(decision2.action).toBe('none');
    expect(decision2.reason).toContain('cooldown');
  });
});

describe('DistributedExecutor', () => {
  let pool: WorkerPool;
  let manager: TestShardManager;
  let executor: DistributedExecutor;

  beforeEach(() => {
    pool = new WorkerPool();
    manager = new TestShardManager();
    executor = new DistributedExecutor(pool, manager);

    const worker: WorkerNode = {
      id: 'worker-1',
      endpoint: 'http://localhost:3001',
      status: 'idle',
      capacity: 10,
      activeJobs: 0,
      cpuUsage: 10,
      memoryUsage: 20,
      lastHeartbeat: Date.now(),
    };

    pool.registerWorker(worker);
  });

  it('should execute distributed tests', async () => {
    const tests = ['test1.ts', 'test2.ts'];

    const result = await executor.executeDistributed(tests, {
      tests,
      strategy: 'round-robin',
      timeout: 5000,
    });

    expect(result.executionId).toBeDefined();
    expect(result.totalTests).toBe(2);
    expect(result.status).toBeDefined();
  });

  it('should get execution status', async () => {
    const tests = ['test1.ts'];

    const result = await executor.executeDistributed(tests, {
      tests,
      strategy: 'round-robin',
      timeout: 5000,
    });

    const status = executor.getExecutionStatus(result.executionId);

    expect(status.executionId).toBe(result.executionId);
    expect(status.status).toBeDefined();
    expect(status.progress).toBeGreaterThanOrEqual(0);
  });

  it('should throw on invalid execution ID', () => {
    expect(() => executor.getExecutionStatus('invalid-id')).toThrow();
  });
});
