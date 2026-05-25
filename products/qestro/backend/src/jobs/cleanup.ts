import { logger } from '../utils/logger.js';
import { connection } from '../lib/db.js';
import Redis from 'redis';

interface CleanupConfig {
  retentionDays: number;
  batchSize: number;
  maxExecutionTime: number;
}

class CleanupJob {
  private config: CleanupConfig;
  private redisClient: any;

  constructor() {
    this.config = {
      retentionDays: parseInt(process.env.RETENTION_DAYS || '30'),
      batchSize: 1000,
      maxExecutionTime: 30 * 60 * 1000 // 30 minutes
    };
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Redis connection if available
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        this.redisClient = Redis.createClient({ url: redisUrl });
        await this.redisClient.connect();
        logger.info('Redis connection established for cleanup job');
      }

      logger.info('Cleanup job initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize cleanup job:', error);
      throw error;
    }
  }

  async run(): Promise<void> {
    const startTime = Date.now();
    logger.info(`Starting cleanup job with ${this.config.retentionDays} days retention`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      // Cleanup old test executions
      await this.cleanupTestExecutions(cutoffDate);

      // Cleanup old recording sessions
      await this.cleanupRecordingSessions(cutoffDate);

      // Cleanup old logs
      await this.cleanupLogs(cutoffDate);

      // Cleanup Redis cache if available
      if (this.redisClient) {
        await this.cleanupRedisCache();
      }

      // Cleanup temporary files
      await this.cleanupTempFiles();

      const duration = Date.now() - startTime;
      logger.info(`Cleanup job completed successfully in ${duration}ms`);

    } catch (error) {
      logger.error('Cleanup job failed:', error);
      throw error;
    }
  }

  private async cleanupTestExecutions(cutoffDate: Date): Promise<void> {
    try {
      logger.info(`Cleaning up test executions older than ${cutoffDate.toISOString()}`);

      const result = await connection`
        DELETE FROM test_executions 
        WHERE executed_at < ${cutoffDate}
        AND status IN ('completed', 'failed')
      `;

      logger.info(`Cleaned up ${result.count} old test executions`);
    } catch (error) {
      logger.error('Failed to cleanup test executions:', error);
      throw error;
    }
  }

  private async cleanupRecordingSessions(cutoffDate: Date): Promise<void> {
    try {
      logger.info(`Cleaning up recording sessions older than ${cutoffDate.toISOString()}`);

      // First, get sessions to be deleted to clean up associated files
      const sessionsToDelete = await connection`
        SELECT id, user_id 
        FROM recording_sessions 
        WHERE created_at < ${cutoffDate}
        AND status IN ('completed', 'failed')
        LIMIT ${this.config.batchSize}
      `;

      if (sessionsToDelete.length > 0) {
        // Clean up associated files (screenshots, videos, etc.)
        for (const session of sessionsToDelete) {
          await this.cleanupSessionFiles(session.id);
        }

        // Delete the sessions
        const sessionIds = sessionsToDelete.map(s => s.id);
        const result = await connection`
          DELETE FROM recording_sessions 
          WHERE id = ANY(${sessionIds})
        `;

        logger.info(`Cleaned up ${result.count} old recording sessions`);
      }
    } catch (error) {
      logger.error('Failed to cleanup recording sessions:', error);
      throw error;
    }
  }

  private async cleanupSessionFiles(sessionId: string): Promise<void> {
    try {
      // This would typically clean up files from S3 or local storage
      // For now, just log the cleanup
      logger.debug(`Cleaning up files for session ${sessionId}`);
      
      // TODO: Implement actual file cleanup based on storage backend
      // - Delete screenshots from S3/local storage
      // - Delete video recordings
      // - Delete temporary files
      
    } catch (error) {
      logger.error(`Failed to cleanup files for session ${sessionId}:`, error);
    }
  }

  private async cleanupLogs(cutoffDate: Date): Promise<void> {
    try {
      logger.info(`Cleaning up application logs older than ${cutoffDate.toISOString()}`);

      // Clean up database logs if they exist
      const result = await connection`
        DELETE FROM application_logs 
        WHERE created_at < ${cutoffDate}
      `.catch(() => {
        // Table might not exist, that's okay
        return { count: 0 };
      });

      logger.info(`Cleaned up ${result.count} old log entries`);

      // Clean up log files
      await this.cleanupLogFiles(cutoffDate);

    } catch (error) {
      logger.error('Failed to cleanup logs:', error);
      throw error;
    }
  }

  private async cleanupLogFiles(cutoffDate: Date): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const logsDir = path.join(process.cwd(), 'logs');
      
      try {
        const files = await fs.readdir(logsDir);
        let cleanedFiles = 0;

        for (const file of files) {
          const filePath = path.join(logsDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate && file.endsWith('.log')) {
            await fs.unlink(filePath);
            cleanedFiles++;
            logger.debug(`Deleted old log file: ${file}`);
          }
        }

        if (cleanedFiles > 0) {
          logger.info(`Cleaned up ${cleanedFiles} old log files`);
        }

      } catch (error) {
        // Logs directory might not exist, that's okay
        logger.debug('Logs directory not found or inaccessible');
      }

    } catch (error) {
      logger.error('Failed to cleanup log files:', error);
    }
  }

  private async cleanupRedisCache(): Promise<void> {
    try {
      logger.info('Cleaning up Redis cache');

      // Clean up expired keys
      const expiredKeys = await this.redisClient.keys('*:expired:*');
      if (expiredKeys.length > 0) {
        await this.redisClient.del(expiredKeys);
        logger.info(`Cleaned up ${expiredKeys.length} expired Redis keys`);
      }

      // Clean up old session data
      const oldSessions = await this.redisClient.keys('session:*');
      let cleanedSessions = 0;

      for (const sessionKey of oldSessions) {
        const ttl = await this.redisClient.ttl(sessionKey);
        if (ttl === -1) { // No expiration set
          const sessionData = await this.redisClient.get(sessionKey);
          if (sessionData) {
            try {
              const data = JSON.parse(sessionData);
              const sessionAge = Date.now() - new Date(data.createdAt || 0).getTime();
              const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

              if (sessionAge > maxAge) {
                await this.redisClient.del(sessionKey);
                cleanedSessions++;
              }
            } catch (error) {
              // Invalid session data, delete it
              await this.redisClient.del(sessionKey);
              cleanedSessions++;
            }
          }
        }
      }

      if (cleanedSessions > 0) {
        logger.info(`Cleaned up ${cleanedSessions} old Redis sessions`);
      }

    } catch (error) {
      logger.error('Failed to cleanup Redis cache:', error);
    }
  }

  private async cleanupTempFiles(): Promise<void> {
    try {
      logger.info('Cleaning up temporary files');

      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');
      
      const tempDir = os.tmpdir();
      const qestroTempPattern = /^qestro-.*\.(tmp|temp)$/;
      
      try {
        const files = await fs.readdir(tempDir);
        let cleanedFiles = 0;

        for (const file of files) {
          if (qestroTempPattern.test(file)) {
            const filePath = path.join(tempDir, file);
            try {
              const stats = await fs.stat(filePath);
              const fileAge = Date.now() - stats.mtime.getTime();
              const maxAge = 24 * 60 * 60 * 1000; // 24 hours

              if (fileAge > maxAge) {
                await fs.unlink(filePath);
                cleanedFiles++;
                logger.debug(`Deleted old temp file: ${file}`);
              }
            } catch (error) {
              // File might have been deleted already, continue
              logger.debug(`Could not process temp file ${file}:`, error.message);
            }
          }
        }

        if (cleanedFiles > 0) {
          logger.info(`Cleaned up ${cleanedFiles} temporary files`);
        }

      } catch (error) {
        logger.debug('Could not access temp directory:', error.message);
      }

    } catch (error) {
      logger.error('Failed to cleanup temporary files:', error);
    }
  }

  async cleanup(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch (error) {
        logger.error('Error closing Redis connection:', error);
      }
    }
  }
}

// Run the cleanup job if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cleanupJob = new CleanupJob();
  
  cleanupJob.initialize()
    .then(() => cleanupJob.run())
    .then(() => cleanupJob.cleanup())
    .then(() => {
      logger.info('Cleanup job finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Cleanup job failed:', error);
      process.exit(1);
    });
}

export { CleanupJob };