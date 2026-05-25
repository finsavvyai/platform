/**
 * Worker Pool Manager
 * Manages registration, health monitoring, and load balancing across workers
 */

import { EventEmitter } from 'events';
import { logger } from '../../lib/logger.js';
import { WorkerNode, WorkerStatus, WorkerCapacity } from './types.js';

const HEARTBEAT_TIMEOUT = 30000; // 30 seconds

export class WorkerPool extends EventEmitter {
  private workers: Map<string, WorkerNode> = new Map();
  private jobAssignments: Map<string, Set<string>> = new Map(); // workerId -> jobIds
  private heartbeatCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
  }

  /**
   * Start health monitoring
   */
  start(): void {
    this.heartbeatCheckInterval = setInterval(() => {
      this.checkWorkerHealth();
    }, 10000);
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
      this.heartbeatCheckInterval = null;
    }
  }

  /**
   * Register a new worker node
   */
  registerWorker(node: WorkerNode): void {
    if (this.workers.has(node.id)) {
      logger.warn(`Worker ${node.id} already registered, updating...`);
    }

    const worker: WorkerNode = {
      ...node,
      status: 'idle',
      activeJobs: 0,
      lastHeartbeat: Date.now(),
    };

    this.workers.set(node.id, worker);
    this.jobAssignments.set(node.id, new Set());

    logger.info(`Worker registered: ${node.id} (capacity: ${node.capacity})`);
    this.emit('worker-registered', worker);
  }

  /**
   * Deregister a worker node
   */
  deregisterWorker(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) {
      logger.warn(`Worker ${workerId} not found`);
      return;
    }

    this.workers.delete(workerId);
    this.jobAssignments.delete(workerId);

    logger.info(`Worker deregistered: ${workerId}`);
    this.emit('worker-deregistered', workerId);
  }

  /**
   * Update worker heartbeat
   */
  updateHeartbeat(workerId: string, metrics?: {
    cpuUsage: number;
    memoryUsage: number;
  }): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    worker.lastHeartbeat = Date.now();
    if (metrics) {
      worker.cpuUsage = metrics.cpuUsage;
      worker.memoryUsage = metrics.memoryUsage;
    }

    if (worker.status === 'offline') {
      worker.status = 'idle';
      logger.info(`Worker ${workerId} came online`);
      this.emit('worker-online', workerId);
    }
  }

  /**
   * Get available worker using least-loaded selection
   */
  getAvailableWorker(): WorkerNode | null {
    const available = Array.from(this.workers.values()).filter(
      (w) => w.status === 'idle' && w.activeJobs < w.capacity
    );

    if (available.length === 0) return null;

    // Least-loaded: select worker with lowest utilization
    return available.reduce((min, worker) => {
      const minUtil = min.activeJobs / min.capacity;
      const workerUtil = worker.activeJobs / worker.capacity;
      return workerUtil < minUtil ? worker : min;
    });
  }

  /**
   * Assign job to worker
   */
  async assignJob(workerId: string, jobId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    if (worker.activeJobs >= worker.capacity) {
      throw new Error(`Worker ${workerId} at capacity`);
    }

    worker.activeJobs += 1;
    const jobs = this.jobAssignments.get(workerId)!;
    jobs.add(jobId);

    if (worker.activeJobs === 1) {
      worker.status = 'busy';
    }

    logger.debug(`Job ${jobId} assigned to ${workerId}`);
    this.emit('job-assigned', { workerId, jobId });
  }

  /**
   * Mark job as complete
   */
  completeJob(workerId: string, jobId: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    worker.activeJobs = Math.max(0, worker.activeJobs - 1);
    const jobs = this.jobAssignments.get(workerId);
    if (jobs) {
      jobs.delete(jobId);
    }

    if (worker.activeJobs === 0 && worker.status === 'busy') {
      worker.status = 'idle';
      logger.debug(`Worker ${workerId} idle`);
      this.emit('worker-idle', workerId);
    }
  }

  /**
   * Get pool status summary
   */
  getPoolStatus(): {
    total: number;
    idle: number;
    busy: number;
    offline: number;
    totalCapacity: number;
    usedCapacity: number;
    utilization: number;
  } {
    const workers = Array.from(this.workers.values());
    const total = workers.length;
    const idle = workers.filter((w) => w.status === 'idle').length;
    const busy = workers.filter((w) => w.status === 'busy').length;
    const offline = workers.filter((w) => w.status === 'offline').length;

    const totalCapacity = workers.reduce((sum, w) => sum + w.capacity, 0);
    const usedCapacity = workers.reduce((sum, w) => sum + w.activeJobs, 0);

    return {
      total,
      idle,
      busy,
      offline,
      totalCapacity,
      usedCapacity,
      utilization: totalCapacity > 0 ? usedCapacity / totalCapacity : 0,
    };
  }

  /**
   * Get capacity of a specific worker
   */
  getWorkerCapacity(workerId: string): WorkerCapacity | null {
    const worker = this.workers.get(workerId);
    if (!worker) return null;

    return {
      workerId,
      available: worker.capacity - worker.activeJobs,
      used: worker.activeJobs,
      total: worker.capacity,
      utilization: worker.activeJobs / worker.capacity,
    };
  }

  /**
   * Gracefully drain a worker (stop accepting new jobs)
   */
  async drainWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    worker.status = 'draining';
    logger.info(`Worker ${workerId} draining...`);
    this.emit('worker-draining', workerId);

    // Wait for all jobs to complete or timeout after 5 minutes
    return new Promise((resolve) => {
      const checkDrained = setInterval(() => {
        if (worker.activeJobs === 0) {
          clearInterval(checkDrained);
          worker.status = 'offline';
          logger.info(`Worker ${workerId} drained and offline`);
          resolve();
        }
      }, 1000);

      setTimeout(() => {
        clearInterval(checkDrained);
        worker.status = 'offline';
        logger.warn(`Worker ${workerId} drain timeout, forced offline`);
        resolve();
      }, 300000);
    });
  }

  /**
   * Check health of all workers
   */
  private checkWorkerHealth(): void {
    const now = Date.now();
    const workers = Array.from(this.workers.values());

    for (const worker of workers) {
      if (worker.status === 'offline') continue;

      const timeSinceHeartbeat = now - worker.lastHeartbeat;
      if (timeSinceHeartbeat > HEARTBEAT_TIMEOUT) {
        worker.status = 'offline';
        logger.warn(`Worker ${worker.id} offline (no heartbeat for ${timeSinceHeartbeat}ms)`);
        this.emit('worker-offline', worker.id);
      }
    }
  }

  /**
   * Get all workers
   */
  getAllWorkers(): WorkerNode[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get worker by ID
   */
  getWorker(workerId: string): WorkerNode | undefined {
    return this.workers.get(workerId);
  }
}
