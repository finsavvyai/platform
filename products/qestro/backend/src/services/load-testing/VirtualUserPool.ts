import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import { MetricsCollector } from './MetricsCollector.js';
import type { VirtualUser, LoadTestConfig, TestScenario } from './types.js';

export class VirtualUserPool {
  private users: Map<string, VirtualUser> = new Map();
  private config: LoadTestConfig;
  private metricsCollector: MetricsCollector;
  private peakUserCount: number = 0;
  private activeWorkers: Promise<void>[] = [];

  constructor(config: LoadTestConfig, metricsCollector: MetricsCollector) {
    this.config = config;
    this.metricsCollector = metricsCollector;
  }

  async spawn(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      const userId = uuidv4();
      const scenario: TestScenario = {
        steps: [
          {
            name: 'Request',
            method: this.config.method,
            url: this.config.targetUrl,
            headers: this.config.headers,
            body: this.config.body,
          },
        ],
      };

      const user: VirtualUser = {
        id: userId,
        scenario,
        startTime: Date.now(),
        lastRequestTime: 0,
        requestCount: 0,
        errorCount: 0,
        isActive: true,
      };

      this.users.set(userId, user);
      const worker = this.runVirtualUser(user);
      this.activeWorkers.push(worker);
    }

    this.updatePeakCount();
    logger.info(`Spawned ${count} virtual users`, { totalUsers: this.users.size });
  }

  async rampUp(additionalCount: number): Promise<void> {
    await this.spawn(additionalCount);
  }

  async rampDown(countToRemove: number): Promise<void> {
    let removed = 0;
    for (const [userId, user] of this.users.entries()) {
      if (removed >= countToRemove) break;
      if (user.isActive) {
        user.isActive = false;
        this.users.delete(userId);
        removed++;
      }
    }
    logger.info(`Ramped down by ${removed} virtual users`, { remainingUsers: this.users.size });
  }

  async shutdown(): Promise<void> {
    for (const user of this.users.values()) {
      user.isActive = false;
    }
    await Promise.all(this.activeWorkers);
    this.users.clear();
    this.activeWorkers = [];
    logger.info('Virtual user pool shutdown complete');
  }

  getPeakUserCount(): number {
    return this.peakUserCount;
  }

  getActiveUserCount(): number {
    return Array.from(this.users.values()).filter((u) => u.isActive).length;
  }

  private updatePeakCount(): void {
    const activeCount = this.getActiveUserCount();
    if (activeCount > this.peakUserCount) {
      this.peakUserCount = activeCount;
    }
  }

  private async runVirtualUser(user: VirtualUser): Promise<void> {
    while (user.isActive) {
      try {
        for (const step of user.scenario.steps) {
          if (!user.isActive) break;

          const startTime = Date.now();
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 30000);
            const response = await fetch(step.url, {
              method: step.method,
              headers: step.headers,
              body: step.body ? JSON.stringify(step.body) : undefined,
              signal: controller.signal,
            });
            clearTimeout(timer);

            const responseTime = Date.now() - startTime;
            user.requestCount++;
            user.lastRequestTime = Date.now();

            this.metricsCollector.recordRequest({
              timestamp: Date.now(),
              responseTime,
              statusCode: response.status,
              method: step.method,
              url: step.url,
              success: response.ok,
              userId: user.id,
            });

            // Think time
            const thinkTime = step.thinkTimeMs || this.config.thinkTimeMs || 0;
            if (thinkTime > 0) {
              await new Promise((resolve) => setTimeout(resolve, thinkTime));
            }
          } catch (error) {
            user.errorCount++;
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.metricsCollector.recordRequest({
              timestamp: Date.now(),
              responseTime: Date.now() - startTime,
              statusCode: 0,
              method: step.method,
              url: step.url,
              success: false,
              error: message,
              userId: user.id,
            });
          }
        }
      } catch (error) {
        logger.error('Virtual user error:', { userId: user.id, error });
        user.isActive = false;
      }
    }
  }
}
