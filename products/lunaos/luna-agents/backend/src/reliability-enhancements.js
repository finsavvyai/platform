/**
 * Reliability Enhancements - P1 Fixes
 * Implements all P1 priority reliability improvements
 */

/**
 * P1-3: Enhanced Scheduled Task Handler
 * Uses Promise.allSettled instead of Promise.all
 * Provides comprehensive error logging and recovery
 */
export class ScheduledTaskHandler {
  constructor(env) {
    this.env = env;
    this.taskResults = [];
  }

  /**
   * Execute multiple scheduled tasks with proper error handling
   * @param {Array} tasks - Array of task functions
   * @returns {Object} Summary of task executions
   */
  async executeTasks(tasks) {
    const startTime = Date.now();
    console.log(`Starting execution of ${tasks.length} scheduled tasks`);

    // Use Promise.allSettled to handle partial failures gracefully
    const results = await Promise.allSettled(
      tasks.map(async (task, index) => {
        const taskStart = Date.now();
        try {
          const result = await task.execute(this.env);
          const duration = Date.now() - taskStart;

          return {
            taskName: task.name,
            status: 'success',
            result,
            duration,
            index
          };
        } catch (error) {
          const duration = Date.now() - taskStart;
          console.error(`Task ${task.name} failed:`, error);

          return {
            taskName: task.name,
            status: 'error',
            error: error.message,
            stack: error.stack,
            duration,
            index
          };
        }
      })
    );

    // Process results
    const summary = {
      total: tasks.length,
      successful: 0,
      failed: 0,
      duration: Date.now() - startTime,
      results: []
    };

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const taskResult = result.value;
        if (taskResult.status === 'success') {
          summary.successful++;
        } else {
          summary.failed++;
        }
        summary.results.push(taskResult);
      } else {
        // Promise rejection (should not happen with try-catch, but handle anyway)
        summary.failed++;
        summary.results.push({
          taskName: tasks[index].name,
          status: 'error',
          error: result.reason?.message || 'Unknown error',
          index
        });
      }
    });

    // Log summary
    console.log('Scheduled tasks execution complete:', {
      total: summary.total,
      successful: summary.successful,
      failed: summary.failed,
      duration: summary.duration + 'ms'
    });

    // Alert on failures if needed
    if (summary.failed > 0) {
      await this.alertOnFailures(summary.results.filter(r => r.status === 'error'));
    }

    this.taskResults.push(summary);
    return summary;
  }

  /**
   * Send alerts for failed tasks
   */
  async alertOnFailures(failedTasks) {
    const alertThreshold = 3; // Alert if 3+ tasks fail

    if (failedTasks.length >= alertThreshold) {
      console.error(`ALERT: ${failedTasks.length} scheduled tasks failed:`, failedTasks);

      // In production, send to monitoring service
      // await this.sendToMonitoring(failedTasks);
    }
  }

  /**
   * Get task execution history
   */
  getTaskHistory(limit = 10) {
    return this.taskResults.slice(-limit);
  }
}

/**
 * P1-4: Email Queue Retry Logic
 * Implements exponential backoff with dead letter queue
 */
export class EmailRetryHandler {
  constructor(env) {
    this.env = env;
    this.maxRetries = 3;
    this.baseDelay = 1000; // 1 second
    this.maxDelay = 60000; // 1 minute
  }

  /**
   * Process email with retry logic
   * @param {Object} emailData - Email data to send
   * @param {Number} attemptNumber - Current attempt number (0-based)
   * @returns {Object} Result of email sending
   */
  async processEmailWithRetry(emailData, attemptNumber = 0) {
    try {
      // Attempt to send email
      const result = await this.sendEmail(emailData);

      // Success
      return {
        success: true,
        result,
        attempts: attemptNumber + 1
      };

    } catch (error) {
      console.error(`Email send attempt ${attemptNumber + 1} failed:`, error.message);

      // Check if we should retry
      if (attemptNumber < this.maxRetries) {
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.baseDelay * Math.pow(2, attemptNumber),
          this.maxDelay
        );

        console.log(`Retrying email in ${delay}ms (attempt ${attemptNumber + 2}/${this.maxRetries + 1})`);

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry
        return await this.processEmailWithRetry(emailData, attemptNumber + 1);

      } else {
        // All retries exhausted, send to dead letter queue
        console.error(`Email failed after ${this.maxRetries + 1} attempts, sending to DLQ`);

        await this.sendToDeadLetterQueue({
          ...emailData,
          error: error.message,
          attempts: this.maxRetries + 1,
          failedAt: new Date().toISOString()
        });

        return {
          success: false,
          error: error.message,
          attempts: this.maxRetries + 1,
          sentToDLQ: true
        };
      }
    }
  }

  /**
   * Send email using configured service
   */
  async sendEmail(emailData) {
    const { EMAIL_SERVICE } = this.env;

    if (!EMAIL_SERVICE) {
      throw new Error('Email service not configured');
    }

    // Validate email data
    if (!emailData.to || !emailData.subject || !emailData.body) {
      throw new Error('Invalid email data: missing required fields');
    }

    // TODO: Integrate with actual email service (SendGrid, Mailgun, etc.)
    // For now, simulate email sending
    if (Math.random() < 0.1) { // 10% failure rate for testing
      throw new Error('Simulated email service error');
    }

    return {
      messageId: this.generateMessageId(),
      sent: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Send failed email to dead letter queue
   */
  async sendToDeadLetterQueue(emailData) {
    try {
      const { CACHE_KV } = this.env;

      if (!CACHE_KV) {
        console.error('KV namespace not available for DLQ');
        return false;
      }

      const dlqKey = `dlq:email:${Date.now()}:${this.generateId()}`;

      await CACHE_KV.put(dlqKey, JSON.stringify({
        ...emailData,
        queuedAt: new Date().toISOString()
      }), {
        expirationTtl: 7 * 24 * 60 * 60 // 7 days
      });

      console.log('Email sent to DLQ:', dlqKey);
      return true;

    } catch (error) {
      console.error('Failed to send email to DLQ:', error);
      return false;
    }
  }

  /**
   * Process dead letter queue (manual recovery)
   */
  async processDLQ(limit = 10) {
    try {
      const { CACHE_KV } = this.env;

      if (!CACHE_KV) {
        console.error('KV namespace not available');
        return { processed: 0, errors: 0 };
      }

      // List DLQ items
      const { keys } = await CACHE_KV.list({ prefix: 'dlq:email:', limit });

      const results = {
        processed: 0,
        errors: 0,
        items: []
      };

      for (const key of keys) {
        try {
          const data = await CACHE_KV.get(key.name, 'json');

          if (data) {
            // Attempt to resend
            const result = await this.processEmailWithRetry(data, 0);

            if (result.success) {
              // Remove from DLQ
              await CACHE_KV.delete(key.name);
              results.processed++;
            } else {
              results.errors++;
            }

            results.items.push({
              key: key.name,
              success: result.success,
              attempts: result.attempts
            });
          }
        } catch (error) {
          console.error('Error processing DLQ item:', key.name, error);
          results.errors++;
        }
      }

      return results;

    } catch (error) {
      console.error('DLQ processing error:', error);
      return { processed: 0, errors: 0, error: error.message };
    }
  }

  /**
   * Generate unique message ID
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }
}

/**
 * P1-5: Enhanced Cache Invalidation
 * Implements consistent cache key patterns and tag-based invalidation
 */
export class CacheInvalidationService {
  constructor(env) {
    this.env = env;
    this.cache = env.CACHE;
    this.kvNamespace = env.CACHE_KV;
  }

  /**
   * Invalidate all cache keys related to a user
   * @param {String} userId - User ID
   * @param {String} email - User email
   * @param {String} apiKey - User API key
   */
  async invalidateUserCache(userId, email, apiKey) {
    const keysToInvalidate = [
      `user:${userId}`,
      `email:${email}`,
      apiKey ? `api_key:${apiKey}` : null,
      `user:${userId}:permissions`,
      `user:${userId}:subscription`,
      `user:${userId}:usage`,
      `user:${userId}:teams`,
      `user:${userId}:workspaces`
    ].filter(Boolean);

    const results = await Promise.allSettled(
      keysToInvalidate.map(key => this.invalidateCacheKey(key))
    );

    const invalidated = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value).length;

    console.log(`User cache invalidation: ${invalidated} keys invalidated, ${failed} failed`);

    return {
      invalidated,
      failed,
      keys: keysToInvalidate
    };
  }

  /**
   * Invalidate cache by tag
   * @param {String} tag - Cache tag
   */
  async invalidateByTag(tag) {
    try {
      if (!this.kvNamespace) {
        console.warn('KV namespace not available for tag invalidation');
        return false;
      }

      // Get all keys with this tag from tag index
      const tagIndexKey = `tag:index:${tag}`;
      const keysData = await this.kvNamespace.get(tagIndexKey, 'json');

      if (!keysData || !keysData.keys) {
        console.log(`No keys found for tag: ${tag}`);
        return true;
      }

      // Invalidate all keys
      const results = await Promise.allSettled(
        keysData.keys.map(key => this.invalidateCacheKey(key))
      );

      const invalidated = results.filter(r => r.status === 'fulfilled' && r.value).length;

      console.log(`Tag invalidation (${tag}): ${invalidated}/${keysData.keys.length} keys invalidated`);

      // Clear tag index
      await this.kvNamespace.delete(tagIndexKey);

      return true;

    } catch (error) {
      console.error('Tag invalidation error:', error);
      return false;
    }
  }

  /**
   * Invalidate specific cache key
   */
  async invalidateCacheKey(key) {
    try {
      await this.cache.delete(key);
      return true;
    } catch (error) {
      console.error(`Failed to invalidate cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Register cache key with tag
   */
  async registerKeyWithTag(key, tags) {
    if (!this.kvNamespace || !tags || tags.length === 0) {
      return;
    }

    try {
      for (const tag of tags) {
        const tagIndexKey = `tag:index:${tag}`;

        // Get existing keys for this tag
        const existingData = await this.kvNamespace.get(tagIndexKey, 'json') || { keys: [] };

        // Add new key if not already present
        if (!existingData.keys.includes(key)) {
          existingData.keys.push(key);

          // Store updated tag index
          await this.kvNamespace.put(tagIndexKey, JSON.stringify(existingData), {
            expirationTtl: 24 * 60 * 60 // 24 hours
          });
        }
      }
    } catch (error) {
      console.error('Failed to register key with tags:', error);
    }
  }

  /**
   * Invalidate pattern-based cache keys
   * @param {String} pattern - Cache key pattern (e.g., "user:123:*")
   */
  async invalidateByPattern(pattern) {
    console.log(`Pattern-based invalidation not fully supported, use tags instead: ${pattern}`);
    // D1 and Workers Cache don't support pattern-based deletion
    // Use tag-based invalidation as alternative
    return false;
  }
}

export default {
  ScheduledTaskHandler,
  EmailRetryHandler,
  CacheInvalidationService
};
