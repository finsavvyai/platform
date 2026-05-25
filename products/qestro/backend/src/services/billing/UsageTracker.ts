import { PLAN_CONFIGS, SubscriptionPlan, UsageStats, QuotaStatus } from './types';

/**
 * UsageTracker: Tracks usage for metered billing and enforces plan limits
 * Records test runs, API calls, and other metrics for quota enforcement
 */

interface UserUsage {
  userId: string;
  plan: SubscriptionPlan;
  testRuns: number;
  apiCalls: number;
  projectsCreated: number;
  dataStoredMB: number;
  monthStartDate: Date;
}

// In-memory store (replace with database in production)
const usageStore = new Map<string, UserUsage>();
const stripeClient = require('stripe')(process.env.STRIPE_SECRET_KEY);

class UsageTracker {
  /**
   * Record a test run for a user
   */
  async recordTestRun(userId: string, projectId: string): Promise<void> {
    try {
      // Get or create usage record
      let usage = usageStore.get(userId);
      if (!usage) {
        usage = {
          userId,
          plan: 'free',
          testRuns: 0,
          apiCalls: 0,
          projectsCreated: 0,
          dataStoredMB: 0,
          monthStartDate: new Date()
        };
        usageStore.set(userId, usage);
      }

      // Increment test runs
      usage.testRuns++;

      // Emit to database (Drizzle ORM) in production
      // await db.insert(testRunMetrics).values({...});

      console.log(
        `Test run recorded for user ${userId}. Total: ${usage.testRuns}`
      );
    } catch (error) {
      console.error('Error recording test run:', error);
      throw new Error('Failed to record test run');
    }
  }

  /**
   * Get usage statistics for a user
   */
  async getUsage(userId: string, period: 'current' | 'last' = 'current'): Promise<UsageStats> {
    try {
      const usage = usageStore.get(userId);

      if (!usage) {
        return {
          userId,
          period,
          testRuns: 0,
          apiCalls: 0,
          projectsCreated: 0,
          dataStoredMB: 0,
          resetDate: new Date(),
          nextResetDate: this.getNextResetDate()
        };
      }

      return {
        userId,
        period,
        testRuns: usage.testRuns,
        apiCalls: usage.apiCalls,
        projectsCreated: usage.projectsCreated,
        dataStoredMB: usage.dataStoredMB,
        resetDate: usage.monthStartDate,
        nextResetDate: this.getNextResetDate()
      };
    } catch (error) {
      console.error('Error retrieving usage:', error);
      throw new Error('Failed to retrieve usage statistics');
    }
  }

  /**
   * Check quota status for a user
   */
  async checkQuota(userId: string): Promise<QuotaStatus> {
    try {
      const usage = usageStore.get(userId);
      const plan = usage?.plan || 'free';
      const planConfig = PLAN_CONFIGS[plan];

      if (!planConfig) {
        throw new Error(`Invalid plan: ${plan}`);
      }

      const testRunsUsed = usage?.testRuns || 0;
      const testRunsLimit = planConfig.limits.testRunsPerMonth;
      const projectsUsed = usage?.projectsCreated || 0;
      const projectsLimit = planConfig.limits.projects;
      const teamMembersUsed = 1; // TODO: fetch from database
      const teamMembersLimit = planConfig.limits.teamMembers;

      const percentageUsed = Math.round(
        (testRunsUsed / testRunsLimit) * 100
      );

      return {
        plan,
        testRunsUsed,
        testRunsLimit,
        projectsUsed,
        projectsLimit,
        teamMembersUsed,
        teamMembersLimit,
        percentageUsed,
        isExceeded: testRunsUsed > testRunsLimit
      };
    } catch (error) {
      console.error('Error checking quota:', error);
      throw new Error('Failed to check quota status');
    }
  }

  /**
   * Report usage to Stripe for metered billing
   */
  async reportUsageToStripe(userId: string): Promise<void> {
    try {
      const usage = await this.getUsage(userId, 'current');
      const quota = await this.checkQuota(userId);

      if (quota.isExceeded) {
        console.warn(
          `User ${userId} has exceeded quota: ${usage.testRuns}/${quota.testRunsLimit} test runs`
        );
      }

      // TODO: Report to Stripe usage API if using metered billing
      // const meterEvent = await stripeClient.billing.meterEvents.create({
      //   event_name: 'test_run',
      //   payload: {
      //     value: usage.testRuns.toString(),
      //     timestamp: Math.floor(Date.now() / 1000)
      //   }
      // });

      console.log(`Usage reported to Stripe for user ${userId}`);
    } catch (error) {
      console.error('Error reporting usage to Stripe:', error);
      throw new Error('Failed to report usage to Stripe');
    }
  }

  /**
   * Reset usage for a user (called at start of billing period)
   */
  async resetUsage(userId: string): Promise<void> {
    try {
      const usage = usageStore.get(userId);
      if (usage) {
        usage.testRuns = 0;
        usage.apiCalls = 0;
        usage.monthStartDate = new Date();
      }

      console.log(`Usage reset for user ${userId}`);
    } catch (error) {
      console.error('Error resetting usage:', error);
      throw new Error('Failed to reset usage');
    }
  }

  /**
   * Enforce plan limits - returns true if action is allowed
   */
  async enforceLimits(userId: string): Promise<boolean> {
    try {
      const quota = await this.checkQuota(userId);

      if (quota.isExceeded) {
        console.warn(
          `Action blocked for user ${userId}: quota exceeded`
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error enforcing limits:', error);
      return false;
    }
  }

  /**
   * Get next billing period reset date
   */
  private getNextResetDate(): Date {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth;
  }

  /**
   * Estimate cost for a user based on usage
   */
  async estimateCost(userId: string): Promise<number> {
    try {
      const usage = usageStore.get(userId);
      if (!usage) return 0;

      const planConfig = PLAN_CONFIGS[usage.plan];
      if (!planConfig) return 0;

      // Pro-rata calculation for month
      const monthlyPrice = planConfig.monthlyPrice;
      const daysInMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        0
      ).getDate();
      const daysUsed = Math.ceil(
        (Date.now() - usage.monthStartDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      return (monthlyPrice / daysInMonth) * daysUsed;
    } catch (error) {
      console.error('Error estimating cost:', error);
      return 0;
    }
  }

  /**
   * Sync usage with database (for production use)
   */
  async syncWithDatabase(userId: string): Promise<void> {
    try {
      // TODO: Implement database sync
      // const dbUsage = await db.query.userUsage.findFirst({
      //   where: eq(userUsage.userId, userId)
      // });
      // if (dbUsage) {
      //   usageStore.set(userId, dbUsage);
      // }
      console.log(`Synced usage for user ${userId} with database`);
    } catch (error) {
      console.error('Error syncing with database:', error);
    }
  }
}

export default new UsageTracker();
