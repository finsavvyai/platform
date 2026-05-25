import { logger } from '../utils/logger.js';
import { healthCheckService } from '../services/HealthCheckService.js';
import Redis from 'redis';

interface TestJob {
  id: string;
  testId: string;
  userId: string;
  configuration: any;
  priority: number;
  createdAt: Date;
}

class TestExecutorWorker {
  private redisClient: any;
  private isRunning = false;
  private maxConcurrentJobs: number;
  private currentJobs = new Set<string>();
  private jobTimeout: number;

  constructor() {
    this.maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_JOBS || '10');
    this.jobTimeout = parseInt(process.env.JOB_TIMEOUT || '300000'); // 5 minutes
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Redis connection
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        throw new Error('REDIS_URL environment variable is required');
      }

      this.redisClient = Redis.createClient({ url: redisUrl });
      await this.redisClient.connect();

      // Setup health monitoring
      healthCheckService.startHealthMonitoring(30000); // 30 seconds

      logger.info('Test executor worker initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize test executor worker:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Test executor worker is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting test executor worker...');

    // Start job processing loop
    this.processJobs();

    // Setup graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  private async processJobs(): Promise<void> {
    while (this.isRunning) {
      try {
        // Check if we can process more jobs
        if (this.currentJobs.size >= this.maxConcurrentJobs) {
          await this.sleep(1000);
          continue;
        }

        // Get next job from queue
        const jobData = await this.redisClient.brPop('test-execution-queue', 5);
        if (!jobData) {
          continue;
        }

        const job: TestJob = JSON.parse(jobData.element);
        this.executeJob(job);

      } catch (error) {
        logger.error('Error in job processing loop:', error);
        await this.sleep(5000); // Wait before retrying
      }
    }
  }

  private async executeJob(job: TestJob): Promise<void> {
    const jobId = job.id;
    this.currentJobs.add(jobId);

    try {
      logger.info(`Starting test execution for job ${jobId}`);

      // Set job timeout
      const timeoutId = setTimeout(() => {
        logger.warn(`Job ${jobId} timed out after ${this.jobTimeout}ms`);
        this.currentJobs.delete(jobId);
      }, this.jobTimeout);

      // Update job status to running
      await this.updateJobStatus(jobId, 'running', {
        startedAt: new Date(),
        workerId: process.pid
      });

      // Execute the test (placeholder implementation)
      const result = await this.runTest(job);

      // Clear timeout
      clearTimeout(timeoutId);

      // Update job status to completed
      await this.updateJobStatus(jobId, 'completed', {
        completedAt: new Date(),
        result,
        workerId: process.pid
      });

      logger.info(`Test execution completed for job ${jobId}`);

    } catch (error) {
      logger.error(`Test execution failed for job ${jobId}:`, error);

      // Update job status to failed
      await this.updateJobStatus(jobId, 'failed', {
        failedAt: new Date(),
        error: error.message,
        workerId: process.pid
      });

    } finally {
      this.currentJobs.delete(jobId);
    }
  }

  private async runTest(job: TestJob): Promise<any> {
    // Placeholder test execution logic
    // In a real implementation, this would:
    // 1. Load test configuration
    // 2. Initialize browser/testing framework
    // 3. Execute test steps
    // 4. Collect results and artifacts
    // 5. Clean up resources

    logger.info(`Executing test ${job.testId} for user ${job.userId}`);

    // Simulate test execution
    await this.sleep(Math.random() * 10000 + 5000); // 5-15 seconds

    return {
      testId: job.testId,
      status: 'passed',
      duration: Math.random() * 10000 + 5000,
      assertions: {
        total: 10,
        passed: 10,
        failed: 0
      },
      screenshots: [],
      logs: []
    };
  }

  private async updateJobStatus(jobId: string, status: string, data: any): Promise<void> {
    try {
      const statusKey = `job:${jobId}:status`;
      const statusData = {
        status,
        updatedAt: new Date(),
        ...data
      };

      await this.redisClient.hSet(statusKey, statusData);
      await this.redisClient.expire(statusKey, 86400); // Expire after 24 hours

      // Publish status update
      await this.redisClient.publish('job-status-updates', JSON.stringify({
        jobId,
        status,
        data: statusData
      }));

    } catch (error) {
      logger.error(`Failed to update job status for ${jobId}:`, error);
    }
  }

  private async shutdown(): Promise<void> {
    logger.info('Shutting down test executor worker...');
    this.isRunning = false;

    // Wait for current jobs to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.currentJobs.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      logger.info(`Waiting for ${this.currentJobs.size} jobs to complete...`);
      await this.sleep(1000);
    }

    if (this.currentJobs.size > 0) {
      logger.warn(`Force shutting down with ${this.currentJobs.size} jobs still running`);
    }

    // Cleanup resources
    healthCheckService.stopHealthMonitoring();
    
    if (this.redisClient) {
      await this.redisClient.quit();
    }

    logger.info('Test executor worker shutdown complete');
    process.exit(0);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start the worker if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const worker = new TestExecutorWorker();
  
  worker.initialize()
    .then(() => worker.start())
    .catch((error) => {
      logger.error('Failed to start test executor worker:', error);
      process.exit(1);
    });
}

export { TestExecutorWorker };