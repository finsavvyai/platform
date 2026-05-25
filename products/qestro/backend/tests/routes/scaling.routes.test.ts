/**
 * Integration Tests for Scaling Routes
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { WorkerPool } from '../../src/services/scaling/WorkerPool.js';
import { AutoScaler } from '../../src/services/scaling/AutoScaler.js';
import { TestShardManager } from '../../src/services/scaling/TestShardManager.js';
import { DistributedExecutor } from '../../src/services/scaling/DistributedExecutor.js';
import scalingRouter, { initializeScalingRoutes } from '../../src/routes/scaling.routes.js';
import { WorkerNode } from '../../src/services/scaling/types.js';

describe('Scaling Routes', () => {
  let app: Express;
  let pool: WorkerPool;
  let scaler: AutoScaler;
  let manager: TestShardManager;
  let executor: DistributedExecutor;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    pool = new WorkerPool();
    pool.start();

    scaler = new AutoScaler(pool);
    manager = new TestShardManager();
    executor = new DistributedExecutor(pool, manager);

    initializeScalingRoutes(pool, scaler, manager, executor);
    app.use('/api/scaling', scalingRouter);
  });

  describe('GET /api/scaling/workers', () => {
    it('should return empty worker list', async () => {
      const response = await request(app).get('/api/scaling/workers');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.workers).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should return registered workers', async () => {
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

      const response = await request(app).get('/api/scaling/workers');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.workers[0].id).toBe('worker-1');
    });
  });

  describe('POST /api/scaling/workers', () => {
    it('should register a new worker', async () => {
      const response = await request(app).post('/api/scaling/workers').send({
        id: 'worker-1',
        endpoint: 'http://localhost:3001',
        capacity: 5,
        region: 'us-east-1',
        tags: ['browser', 'api'],
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.worker.id).toBe('worker-1');
      expect(response.body.worker.status).toBe('idle');
    });

    it('should validate required fields', async () => {
      const response = await request(app).post('/api/scaling/workers').send({
        id: 'worker-1',
        // missing endpoint and capacity
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/scaling/workers/:id', () => {
    it('should return worker details', async () => {
      const worker: WorkerNode = {
        id: 'worker-1',
        endpoint: 'http://localhost:3001',
        status: 'idle',
        capacity: 5,
        activeJobs: 2,
        cpuUsage: 10,
        memoryUsage: 20,
        lastHeartbeat: Date.now(),
      };

      pool.registerWorker(worker);

      const response = await request(app).get('/api/scaling/workers/worker-1');

      expect(response.status).toBe(200);
      expect(response.body.worker.id).toBe('worker-1');
      expect(response.body.capacity.used).toBe(2);
      expect(response.body.capacity.total).toBe(5);
    });

    it('should return 404 for unknown worker', async () => {
      const response = await request(app).get('/api/scaling/workers/unknown');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/scaling/workers/:id', () => {
    it('should deregister a worker', async () => {
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

      const response = await request(app).delete('/api/scaling/workers/worker-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const listResponse = await request(app).get('/api/scaling/workers');
      expect(listResponse.body.count).toBe(0);
    });
  });

  describe('GET /api/scaling/pool/status', () => {
    it('should return pool status', async () => {
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
        status: 'busy',
        capacity: 5,
        activeJobs: 5,
        cpuUsage: 90,
        memoryUsage: 80,
        lastHeartbeat: Date.now(),
      };

      pool.registerWorker(worker1);
      pool.registerWorker(worker2);

      const response = await request(app).get('/api/scaling/pool/status');

      expect(response.status).toBe(200);
      expect(response.body.status.total).toBe(2);
      expect(response.body.status.idle).toBe(1);
      expect(response.body.status.busy).toBe(1);
      expect(response.body.status.totalCapacity).toBe(10);
      expect(response.body.status.usedCapacity).toBe(7);
    });
  });

  describe('POST /api/scaling/execute', () => {
    beforeEach(() => {
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
      const response = await request(app).post('/api/scaling/execute').send({
        tests: ['test1.ts', 'test2.ts'],
        strategy: 'round-robin',
        timeout: 5000,
      });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.result.executionId).toBeDefined();
      expect(response.body.result.totalTests).toBe(2);
    });

    it('should validate tests array', async () => {
      const response = await request(app).post('/api/scaling/execute').send({
        tests: [],
        strategy: 'round-robin',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/scaling/execute/:id', () => {
    it('should get execution status', async () => {
      const execResponse = await request(app).post('/api/scaling/execute').send({
        tests: ['test1.ts'],
        strategy: 'round-robin',
        timeout: 5000,
      });

      const executionId = execResponse.body.result.executionId;

      const response = await request(app).get(`/api/scaling/execute/${executionId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status.executionId).toBe(executionId);
      expect(response.body.status.status).toBeDefined();
      expect(response.body.status.progress).toBeGreaterThanOrEqual(0);
    });

    it('should return 404 for unknown execution', async () => {
      const response = await request(app).get('/api/scaling/execute/unknown-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/scaling/autoscale/policy', () => {
    it('should return autoscale policy', async () => {
      const response = await request(app).get('/api/scaling/autoscale/policy');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.policy.mode).toBeDefined();
      expect(response.body.policy.minWorkers).toBeDefined();
      expect(response.body.policy.maxWorkers).toBeDefined();
    });
  });

  describe('PUT /api/scaling/autoscale/policy', () => {
    it('should update autoscale policy', async () => {
      const response = await request(app).put('/api/scaling/autoscale/policy').send({
        mode: 'predictive',
        minWorkers: 1,
        maxWorkers: 50,
        scaleUpThreshold: 70,
        cooldownMinutes: 2,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.policy.mode).toBe('predictive');
      expect(response.body.policy.maxWorkers).toBe(50);
    });

    it('should validate policy object', async () => {
      const response = await request(app).put('/api/scaling/autoscale/policy').send(null);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/scaling/workers/:id/heartbeat', () => {
    beforeEach(() => {
      const worker: WorkerNode = {
        id: 'worker-1',
        endpoint: 'http://localhost:3001',
        status: 'offline',
        capacity: 5,
        activeJobs: 0,
        cpuUsage: 10,
        memoryUsage: 20,
        lastHeartbeat: Date.now() - 60000,
      };

      pool.registerWorker(worker);
    });

    it('should process worker heartbeat', async () => {
      const response = await request(app)
        .post('/api/scaling/workers/worker-1/heartbeat')
        .send({
          cpuUsage: 45,
          memoryUsage: 60,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
