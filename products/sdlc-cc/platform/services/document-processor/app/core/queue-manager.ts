import Bull, { Queue, Job, JobOptions } from 'bull';
import { policyFromEnv, type QueuePolicy } from '../queue/backpressure';
import Redis from 'ioredis';
import { Logger } from '../utils/logger';
import { QueueError } from '../utils/error-handler';
import { EventEmitter } from 'events';

export interface ProcessingJobData {
  documentId: string;
  filePath: string;
  documentType: string;
  operations: ProcessingOperation[];
  options: ProcessingOptions;
  userId?: string;
  /**
   * Tenant the document belongs to. Optional so legacy callers don't
   * need to be migrated in lockstep, but the progress-bridge skips
   * emitting events when this is unset because the realtime channel
   * is keyed by tenant.
   */
  tenantId?: string;
  priority?: number;
}

export interface ProcessingOperation {
  type: 'extract' | 'ocr' | 'chunk' | 'assess' | 'clean';
  params?: Record<string, unknown>;
}

export interface ProcessingOptions {
  language?: string;
  chunkingStrategy?: 'semantic' | 'fixed' | 'token' | 'hierarchical';
  chunkSize?: number;
  chunkOverlap?: number;
  includeMetadata?: boolean;
  qualityThreshold?: number;
  ocrEnabled?: boolean;
}

export interface JobResult {
  success: boolean;
  documentId: string;
  operation: string;
  result?: unknown;
  error?: string;
  duration: number;
  metadata: Record<string, unknown>;
}

export class QueueManager extends EventEmitter {
  private logger: Logger;
  private redis!: Redis;
  private documentQueue!: Queue<ProcessingJobData>;
  private ocrQueue!: Queue<ProcessingJobData>;
  private batchQueue!: Queue<ProcessingJobData[]>;
  private redisConfig: Record<string, unknown>;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.logger = new Logger('QueueManager');
    this.redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };
  }

  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing queue manager...');

      // Initialize Redis connection
      this.redis = new Redis(this.redisConfig);
      this.redis.on('error', (error) => {
        this.logger.error('Redis connection error:', error);
      });
      this.redis.on('connect', () => {
        this.logger.info('Redis connected successfully');
      });

      await this.redis.connect();

      // Initialize queues
      await this.initializeQueues();

      this.isInitialized = true;
      this.logger.info('Queue manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize queue manager:', error);
      throw new QueueError('Failed to initialize queue manager', error);
    }
  }

  private async initializeQueues(): Promise<void> {
    // Day 14: env-driven backpressure config replaces hard-coded
    // attempts/backoff/concurrency. Bull v3 uses a slightly different
    // option shape than BullMQ v5, so we map the policy onto Bull's
    // QueueOptions explicitly here.
    const policy: QueuePolicy = policyFromEnv();
    const queueConfig: Bull.QueueOptions = {
      redis: this.redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: policy.maxAttempts,
        backoff: {
          type: 'exponential',
          delay: (policy.backoffSeconds[0] ?? 30) * 1000,
        },
      },
    };

    // Document processing queue
    this.documentQueue = new Bull('document processing', queueConfig);
    this.setupQueueEventHandlers(this.documentQueue, 'document');

    // OCR processing queue (separate for resource-intensive operations)
    this.ocrQueue = new Bull('ocr processing', queueConfig);
    this.setupQueueEventHandlers(this.ocrQueue, 'ocr');

    // Batch processing queue
    this.batchQueue = new Bull('batch processing', queueConfig);
    this.setupQueueEventHandlers(this.batchQueue, 'batch');

    // Concurrency comes from policy.concurrency; OCR is half because
    // Tesseract is CPU-bound and batch stays single to keep ordering.
    const ocrConcurrency = Math.max(1, Math.floor(policy.concurrency / 4));
    this.documentQueue.process(policy.concurrency, this.processDocumentJob.bind(this));
    this.ocrQueue.process(ocrConcurrency, this.processOCRJob.bind(this));
    this.batchQueue.process(1, this.processBatchJob.bind(this));
  }

  private setupQueueEventHandlers(queue: Queue, queueName: string): void {
    queue.on('error', (error) => {
      this.logger.error(`${queueName} queue error:`, error);
      this.emit('queueError', { queueName, error });
    });

    queue.on('waiting', (jobId) => {
      this.logger.debug(`${queueName} job ${jobId} is waiting`);
    });

    queue.on('active', (job) => {
      this.logger.info(`${queueName} job ${job.id} is now active`);
      this.emit('jobStarted', { queueName, job });
    });

    queue.on('completed', (job, result) => {
      this.logger.info(`${queueName} job ${job.id} completed`);
      this.emit('jobCompleted', { queueName, job, result });
    });

    queue.on('failed', (job, error) => {
      this.logger.error(`${queueName} job ${job.id} failed:`, error);
      this.emit('jobFailed', { queueName, job, error });
    });

    queue.on('stalled', (job) => {
      this.logger.warn(`${queueName} job ${job.id} is stalled`);
      this.emit('jobStalled', { queueName, job });
    });
  }

  public async addDocumentJob(jobData: ProcessingJobData, options?: JobOptions): Promise<Job<ProcessingJobData>> {
    this.ensureInitialized();

    try {
      const job = await this.documentQueue.add('process-document', jobData, {
        priority: jobData.priority || 0,
        delay: options?.delay || 0,
        attempts: options?.attempts || 3,
        backoff: options?.backoff || { type: 'exponential', delay: 2000 },
        ...options,
      });

      this.logger.info(`Added document job ${job.id} for document ${jobData.documentId}`);
      return job;
    } catch (error) {
      this.logger.error('Failed to add document job:', error);
      throw new QueueError('Failed to add document job', error);
    }
  }

  public async addOCRJob(jobData: ProcessingJobData, options?: JobOptions): Promise<Job<ProcessingJobData>> {
    this.ensureInitialized();

    try {
      const job = await this.ocrQueue.add('process-ocr', jobData, {
        priority: jobData.priority || 0,
        delay: options?.delay || 0,
        attempts: options?.attempts || 2, // Fewer attempts for OCR
        backoff: options?.backoff || { type: 'exponential', delay: 5000 },
        ...options,
      });

      this.logger.info(`Added OCR job ${job.id} for document ${jobData.documentId}`);
      return job;
    } catch (error) {
      this.logger.error('Failed to add OCR job:', error);
      throw new QueueError('Failed to add OCR job', error);
    }
  }

  public async addBatchJob(jobs: ProcessingJobData[], options?: JobOptions): Promise<Job<ProcessingJobData[]>> {
    this.ensureInitialized();

    try {
      const job = await this.batchQueue.add('process-batch', jobs, {
        priority: options?.priority || 0,
        delay: options?.delay || 0,
        attempts: options?.attempts || 1, // Single attempt for batch jobs
        ...options,
      });

      this.logger.info(`Added batch job ${job.id} with ${jobs.length} documents`);
      return job;
    } catch (error) {
      this.logger.error('Failed to add batch job:', error);
      throw new QueueError('Failed to add batch job', error);
    }
  }

  public async getJobStatus(queueName: string, jobId: string): Promise<Record<string, unknown> | null> {
    this.ensureInitialized();

    try {
      const queue = this.getQueue(queueName);
      const job = await queue.getJob(jobId);

      if (!job) {
        return null;
      }

      const state = await job.getState();
      const progress = job.progress();

      return {
        id: job.id,
        data: job.data,
        state,
        progress,
        createdAt: job.timestamp,
        processedAt: job.finishedOn,
        failedReason: job.failedReason,
      };
    } catch (error) {
      this.logger.error(`Failed to get job status for ${jobId}:`, error);
      throw new QueueError('Failed to get job status', error);
    }
  }

  public async getQueueStats(queueName: string): Promise<Record<string, unknown>> {
    this.ensureInitialized();

    try {
      const queue = this.getQueue(queueName);
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);

      return {
        queueName,
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        total: waiting.length + active.length + completed.length + failed.length + delayed.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get queue stats for ${queueName}:`, error);
      throw new QueueError('Failed to get queue stats', error);
    }
  }

  public async pauseQueue(queueName: string): Promise<void> {
    this.ensureInitialized();

    try {
      const queue = this.getQueue(queueName);
      await queue.pause();
      this.logger.info(`Paused ${queueName} queue`);
    } catch (error) {
      this.logger.error(`Failed to pause ${queueName} queue:`, error);
      throw new QueueError('Failed to pause queue', error);
    }
  }

  public async resumeQueue(queueName: string): Promise<void> {
    this.ensureInitialized();

    try {
      const queue = this.getQueue(queueName);
      await queue.resume();
      this.logger.info(`Resumed ${queueName} queue`);
    } catch (error) {
      this.logger.error(`Failed to resume ${queueName} queue:`, error);
      throw new QueueError('Failed to resume queue', error);
    }
  }

  public async clearQueue(queueName: string): Promise<void> {
    this.ensureInitialized();

    try {
      const queue = this.getQueue(queueName);
      await queue.clean(0, 'completed');
      await queue.clean(0, 'failed');
      this.logger.info(`Cleared ${queueName} queue`);
    } catch (error) {
      this.logger.error(`Failed to clear ${queueName} queue:`, error);
      throw new QueueError('Failed to clear queue', error);
    }
  }

  private getQueue(queueName: string): Queue {
    switch (queueName) {
      case 'document':
        return this.documentQueue;
      case 'ocr':
        return this.ocrQueue;
      case 'batch':
        return this.batchQueue;
      default:
        throw new QueueError(`Unknown queue: ${queueName}`);
    }
  }

  private async processDocumentJob(job: Job<ProcessingJobData>): Promise<JobResult> {
    const startTime = Date.now();
    const { documentId, operations } = job.data;

    try {
      this.logger.info(`Processing document job ${job.id} for document ${documentId}`);

      // Update progress
      job.progress(10);

      // This would be implemented by the actual document processor
      // For now, we'll emit an event for the main application to handle
      this.emit('processDocument', job.data);

      const result: JobResult = {
        success: true,
        documentId,
        operation: 'document_processing',
        duration: Date.now() - startTime,
        metadata: { jobId: job.id, operations: operations.length },
      };

      job.progress(100);
      return result;
    } catch (error) {
      this.logger.error(`Document job ${job.id} failed:`, error);

      const result: JobResult = {
        success: false,
        documentId,
        operation: 'document_processing',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        metadata: { jobId: job.id },
      };

      throw error;
    }
  }

  private async processOCRJob(job: Job<ProcessingJobData>): Promise<JobResult> {
    const startTime = Date.now();
    const { documentId } = job.data;

    try {
      this.logger.info(`Processing OCR job ${job.id} for document ${documentId}`);

      job.progress(10);

      // Emit event for OCR processing
      this.emit('processOCR', job.data);

      const result: JobResult = {
        success: true,
        documentId,
        operation: 'ocr_processing',
        duration: Date.now() - startTime,
        metadata: { jobId: job.id },
      };

      job.progress(100);
      return result;
    } catch (error) {
      this.logger.error(`OCR job ${job.id} failed:`, error);

      const result: JobResult = {
        success: false,
        documentId,
        operation: 'ocr_processing',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        metadata: { jobId: job.id },
      };

      throw error;
    }
  }

  private async processBatchJob(job: Job<ProcessingJobData[]>): Promise<JobResult[]> {
    const startTime = Date.now();
    const jobs = job.data;
    const results: JobResult[] = [];

    try {
      this.logger.info(`Processing batch job ${job.id} with ${jobs.length} documents`);

      for (let i = 0; i < jobs.length; i++) {
        const jobData = jobs[i];
        if (!jobData) continue;
        job.progress((i / jobs.length) * 100);

        // Emit event for each document in batch
        this.emit('processBatchDocument', jobData);

        results.push({
          success: true,
          documentId: jobData.documentId,
          operation: 'batch_processing',
          duration: 0, // Would be calculated by actual processor
          metadata: { batchJobId: job.id, index: i },
        });
      }

      job.progress(100);
      return results;
    } catch (error) {
      this.logger.error(`Batch job ${job.id} failed:`, error);
      throw error;
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new QueueError('Queue manager is not initialized');
    }
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down queue manager...');

    try {
      if (this.documentQueue) await this.documentQueue.close();
      if (this.ocrQueue) await this.ocrQueue.close();
      if (this.batchQueue) await this.batchQueue.close();
      if (this.redis) await this.redis.disconnect();

      this.isInitialized = false;
      this.logger.info('Queue manager shutdown completed');
    } catch (error) {
      this.logger.error('Error during queue manager shutdown:', error);
      throw error;
    }
  }
}
