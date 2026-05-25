/**
 * Analytics Service
 * Provides comprehensive analytics and reporting for the Questro platform
 */

export interface AnalyticsMetrics {
  totalProjects: number;
  totalTestRuns: number;
  totalTests: number;
  successRate: number;
  averageDuration: number;
  activeUsers: number;
  errorRate: number;
  coverage: number;
}

export interface ProjectAnalytics {
  projectId: string;
  projectName: string;
  metrics: {
    totalRuns: number;
    passedRuns: number;
    failedRuns: number;
    successRate: number;
    averageDuration: number;
    totalDuration: number;
    lastRunAt?: string;
    trends: {
      daily: Array<{ date: string; runs: number; successRate: number }>;
      weekly: Array<{ week: string; runs: number; successRate: number }>;
      monthly: Array<{ month: string; runs: number; successRate: number }>;
    };
  };
  topFailedTests: Array<{
    testName: string;
    failureCount: number;
    lastFailure: string;
    commonErrors: string[];
  }>;
  performanceMetrics: {
    slowestTests: Array<{
      testName: string;
      averageDuration: number;
      maxDuration: number;
    }>;
    fastestTests: Array<{
      testName: string;
      averageDuration: number;
      minDuration: number;
    }>;
  };
}

export interface UserAnalytics {
  userId: string;
  userEmail: string;
  metrics: {
    totalProjects: number;
    totalRuns: number;
    totalTests: number;
    successRate: number;
    averageDuration: number;
    apiUsage: number;
    storageUsed: number;
    bandwidthUsed: number;
  };
  activity: {
    dailyActivity: Array<{ date: string; actions: number; type: string }>;
    recentProjects: Array<{ projectId: string; projectName: string; lastAccessed: string }>;
    recentRuns: Array<{ runId: string; projectName: string; status: string; duration: number }>;
  };
  subscriptionLimits: {
    plan: string;
    limits: Record<string, number>;
    usage: Record<string, number>;
    remaining: Record<string, number>;
  };
}

export interface SystemAnalytics {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalProjects: number;
    totalRuns: number;
    systemHealth: 'healthy' | 'degraded' | 'down';
    uptime: number;
    responseTime: number;
  };
  performance: {
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
    concurrency: number;
  };
  storage: {
    totalStorageUsed: number;
    totalFilesStored: number;
    storageByType: Record<string, number>;
    growthRate: number;
  };
  usage: {
    apiCallsByEndpoint: Record<string, number>;
    apiCallsByUser: Array<{ userId: string; calls: number; email: string }>;
    popularFeatures: Array<{ feature: string; usage: number }>;
  };
}

/**
 * Analytics Service implementation
 */
export class AnalyticsService {
  constructor(private env: any) {}

  /**
   * Get overall platform metrics
   */
  async getPlatformMetrics(): Promise<AnalyticsMetrics> {
    try {
      const [
        projectCount,
        totalRuns,
        totalTests,
        recentStats,
        activeUsers
      ] = await Promise.all([
        this.env.DB.prepare('SELECT COUNT(*) as count FROM projects WHERE status != "deleted"').first(),
        this.env.DB.prepare('SELECT COUNT(*) as count FROM test_runs').first(),
        this.env.DB.prepare('SELECT COUNT(*) as count FROM test_suites').first(),
        this.getRecentPerformanceStats(),
        this.getActiveUsersCount()
      ]);

      return {
        totalProjects: projectCount?.count || 0,
        totalTestRuns: totalRuns?.count || 0,
        totalTests: totalTests?.count || 0,
        successRate: recentStats.successRate,
        averageDuration: recentStats.averageDuration,
        activeUsers: activeUsers,
        errorRate: 100 - recentStats.successRate,
        coverage: 85 // Mock coverage - would calculate from actual test coverage
      };
    } catch (error) {
      console.error('Failed to get platform metrics:', error);
      throw new Error('Failed to get platform metrics');
    }
  }

  /**
   * Get detailed project analytics
   */
  async getProjectAnalytics(projectId: string, userId: string): Promise<ProjectAnalytics> {
    try {
      // Verify project ownership
      const project = await this.env.DB.prepare(
        'SELECT * FROM projects WHERE id = ? AND user_id = ?'
      ).bind(projectId, userId).first();

      if (!project) {
        throw new Error('Project not found');
      }

      const [
        runStats,
        dailyTrends,
        weeklyTrends,
        monthlyTrends,
        topFailures,
        performanceData
      ] = await Promise.all([
        this.getProjectRunStats(projectId),
        this.getProjectTrends(projectId, 'daily'),
        this.getProjectTrends(projectId, 'weekly'),
        this.getProjectTrends(projectId, 'monthly'),
        this.getTopFailedTests(projectId),
        this.getProjectPerformanceData(projectId)
      ]);

      return {
        projectId,
        projectName: project.name,
        metrics: {
          totalRuns: runStats.totalRuns,
          passedRuns: runStats.passedRuns,
          failedRuns: runStats.failedRuns,
          successRate: runStats.successRate,
          averageDuration: runStats.averageDuration,
          totalDuration: runStats.totalDuration,
          lastRunAt: runStats.lastRunAt,
          trends: {
            daily: dailyTrends,
            weekly: weeklyTrends,
            monthly: monthlyTrends
          }
        },
        topFailedTests: topFailures,
        performanceMetrics: {
          slowestTests: performanceData.slowest,
          fastestTests: performanceData.fastest
        }
      };
    } catch (error) {
      console.error('Failed to get project analytics:', error);
      throw new Error('Failed to get project analytics');
    }
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    try {
      const [
        userStats,
        activityData,
        subscriptionData,
        recentProjects,
        recentRuns
      ] = await Promise.all([
        this.getUserStats(userId),
        this.getUserActivity(userId),
        this.getUserSubscriptionData(userId),
        this.getRecentProjects(userId),
        this.getRecentRuns(userId)
      ]);

      return {
        userId,
        userEmail: `user-${userId}@example.com`, // Mock email
        metrics: userStats,
        activity: {
          dailyActivity: activityData.daily,
          recentProjects,
          recentRuns
        },
        subscriptionLimits: subscriptionData
      };
    } catch (error) {
      console.error('Failed to get user analytics:', error);
      throw new Error('Failed to get user analytics');
    }
  }

  /**
   * Get system-wide analytics (admin only)
   */
  async getSystemAnalytics(): Promise<SystemAnalytics> {
    try {
      const [
        overviewData,
        performanceData,
        storageData,
        usageData
      ] = await Promise.all([
        this.getSystemOverview(),
        this.getSystemPerformance(),
        this.getStorageAnalytics(),
        this.getUsageAnalytics()
      ]);

      return {
        overview: overviewData,
        performance: performanceData,
        storage: storageData,
        usage: usageData
      };
    } catch (error) {
      console.error('Failed to get system analytics:', error);
      throw new Error('Failed to get system analytics');
    }
  }

  /**
   * Track API usage for analytics
   */
  async trackApiUsage(userId: string, endpoint: string, method: string, status: number, duration: number): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const date = timestamp.split('T')[0];

      // Store in analytics table
      await this.env.DB.prepare(`
        INSERT INTO api_analytics (
          user_id, endpoint, method, status, duration, timestamp, date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        endpoint,
        method,
        status,
        duration,
        timestamp,
        date
      ).run();

      // Update user daily usage in KV for quick access
      const usageKey = `usage:${userId}:${date}`;
      const currentUsage = await this.env.CACHE.get(usageKey) || '0';
      const newUsage = parseInt(currentUsage) + 1;

      await this.env.CACHE.put(usageKey, newUsage.toString(), {
        expirationTtl: 7 * 24 * 60 * 60 // 7 days
      });
    } catch (error) {
      console.error('Failed to track API usage:', error);
      // Don't throw - analytics shouldn't break the main flow
    }
  }

  /**
   * Get recent performance statistics
   */
  private async getRecentPerformanceStats() {
    try {
      const result = await this.env.DB.prepare(`
        SELECT
          COUNT(*) as total_runs,
          SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed_runs,
          AVG(CASE WHEN duration IS NOT NULL THEN duration ELSE 0 END) as avg_duration
        FROM test_runs
        WHERE completed_at >= datetime('now', '-30 days')
      `).first();

      const totalRuns = result?.total_runs || 0;
      const passedRuns = result?.passed_runs || 0;
      const successRate = totalRuns > 0 ? (passedRuns / totalRuns) * 100 : 0;

      return {
        successRate,
        averageDuration: result?.avg_duration || 0
      };
    } catch (error) {
      return { successRate: 0, averageDuration: 0 };
    }
  }

  /**
   * Get active users count (last 30 days)
   */
  private async getActiveUsersCount(): Promise<number> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT COUNT(DISTINCT user_id) as count
        FROM test_runs
        WHERE triggered_at >= datetime('now', '-30 days')
      `).first();

      return result?.count || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get project run statistics
   */
  private async getProjectRunStats(projectId: string) {
    try {
      const result = await this.env.DB.prepare(`
        SELECT
          COUNT(*) as total_runs,
          SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed_runs,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_runs,
          AVG(CASE WHEN duration IS NOT NULL THEN duration ELSE 0 END) as avg_duration,
          SUM(CASE WHEN duration IS NOT NULL THEN duration ELSE 0 END) as total_duration,
          MAX(triggered_at) as last_run_at
        FROM test_runs
        WHERE project_id = ?
      `).bind(projectId).first();

      const totalRuns = result?.total_runs || 0;
      const passedRuns = result?.passed_runs || 0;

      return {
        totalRuns,
        passedRuns,
        failedRuns: result?.failed_runs || 0,
        successRate: totalRuns > 0 ? (passedRuns / totalRuns) * 100 : 0,
        averageDuration: result?.avg_duration || 0,
        totalDuration: result?.total_duration || 0,
        lastRunAt: result?.last_run_at
      };
    } catch (error) {
      return {
        totalRuns: 0,
        passedRuns: 0,
        failedRuns: 0,
        successRate: 0,
        averageDuration: 0,
        totalDuration: 0
      };
    }
  }

  /**
   * Get project trends (daily/weekly/monthly)
   */
  private async getProjectTrends(projectId: string, period: 'daily' | 'weekly' | 'monthly') {
    try {
      let dateFormat = '';
      switch (period) {
        case 'daily':
          dateFormat = '%Y-%m-%d';
          break;
        case 'weekly':
          dateFormat = '%Y-%W';
          break;
        case 'monthly':
          dateFormat = '%Y-%m';
          break;
      }

      const results = await this.env.DB.prepare(`
        SELECT
          strftime('${dateFormat}', triggered_at) as period,
          COUNT(*) as runs,
          SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed_runs
        FROM test_runs
        WHERE project_id = ? AND triggered_at >= datetime('now', '-90 days')
        GROUP BY strftime('${dateFormat}', triggered_at)
        ORDER BY period DESC
        LIMIT 30
      `).bind(projectId).all();

      return (results.results || []).map((row: any) => ({
        date: row.period,
        runs: row.runs,
        successRate: row.runs > 0 ? (row.passed_runs / row.runs) * 100 : 0
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get top failed tests for a project
   */
  private async getTopFailedTests(projectId: string) {
    try {
      // This is a simplified version - in production, you'd have detailed test execution logs
      const results = await this.env.DB.prepare(`
        SELECT
          t.name as test_name,
          COUNT(tr.id) as failure_count,
          MAX(tr.completed_at) as last_failure
        FROM test_runs tr
        JOIN test_cases t ON tr.test_id = t.id
        WHERE tr.project_id = ? AND tr.status = 'failed'
        GROUP BY t.id, t.name
        ORDER BY failure_count DESC
        LIMIT 10
      `).bind(projectId).all();

      return (results.results || []).map((row: any) => ({
        testName: row.test_name,
        failureCount: row.failure_count,
        lastFailure: row.last_failure,
        commonErrors: ['Assertion failed', 'Element not found', 'Timeout'] // Mock errors
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get project performance data
   */
  private async getProjectPerformanceData(projectId: string) {
    try {
      const results = await this.env.DB.prepare(`
        SELECT
          t.name as test_name,
          AVG(tr.results->>'duration') as avg_duration,
          MAX(tr.results->>'duration') as max_duration,
          MIN(tr.results->>'duration') as min_duration
        FROM test_runs tr
        JOIN test_cases t ON tr.test_id = t.id
        WHERE tr.project_id = ? AND tr.completed_at IS NOT NULL
        GROUP BY t.id, t.name
        HAVING COUNT(*) >= 3
        ORDER BY avg_duration DESC
        LIMIT 10
      `).bind(projectId).all();

      const slowest = (results.results || []).slice(0, 5).map((row: any) => ({
        testName: row.test_name,
        averageDuration: row.avg_duration || 0,
        maxDuration: row.max_duration || 0
      }));

      const fastest = (results.results || []).slice(-5).reverse().map((row: any) => ({
        testName: row.test_name,
        averageDuration: row.avg_duration || 0,
        minDuration: row.min_duration || 0
      }));

      return { slowest, fastest };
    } catch (error) {
      return { slowest: [], fastest: [] };
    }
  }

  /**
   * Get user statistics
   */
  private async getUserStats(userId: string) {
    try {
      const [
        projectCount,
        runStats,
        testCount,
        apiUsage,
        storageUsed
      ] = await Promise.all([
        this.env.DB.prepare('SELECT COUNT(*) as count FROM projects WHERE user_id = ? AND status != "deleted"').bind(userId).first(),
        this.env.DB.prepare(`
          SELECT COUNT(*) as total_runs,
                 SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed_runs,
                 AVG(CASE WHEN duration IS NOT NULL THEN duration ELSE 0 END) as avg_duration
          FROM test_runs WHERE triggered_by = ?
        `).bind(userId).first(),
        this.env.DB.prepare('SELECT COUNT(*) as count FROM test_suites ts JOIN projects p ON ts.project_id = p.id WHERE p.user_id = ?').bind(userId).first(),
        this.getUserApiUsage(userId),
        this.getUserStorageUsage(userId)
      ]);

      const totalRuns = runStats?.total_runs || 0;
      const passedRuns = runStats?.passed_runs || 0;

      return {
        totalProjects: projectCount?.count || 0,
        totalRuns,
        totalTests: testCount?.count || 0,
        successRate: totalRuns > 0 ? (passedRuns / totalRuns) * 100 : 0,
        averageDuration: runStats?.avg_duration || 0,
        apiUsage,
        storageUsed
      };
    } catch (error) {
      return {
        totalProjects: 0,
        totalRuns: 0,
        totalTests: 0,
        successRate: 0,
        averageDuration: 0,
        apiUsage: 0,
        storageUsed: 0
      };
    }
  }

  /**
   * Get user activity data
   */
  private async getUserActivity(userId: string) {
    try {
      const results = await this.env.DB.prepare(`
        SELECT
          DATE(triggered_at) as date,
          COUNT(*) as actions,
          'test_run' as type
        FROM test_runs
        WHERE triggered_by = ? AND triggered_at >= datetime('now', '-30 days')
        GROUP BY DATE(triggered_at)
        ORDER BY date DESC
        LIMIT 30
      `).bind(userId).all();

      return {
        daily: (results.results || []).map((row: any) => ({
          date: row.date,
          actions: row.actions,
          type: row.type
        }))
      };
    } catch (error) {
      return { daily: [] };
    }
  }

  /**
   * Get user subscription data
   */
  private async getUserSubscriptionData(userId: string) {
    try {
      // Mock subscription data - in production, this would come from billing service
      return {
        plan: 'free',
        limits: {
          apiCalls: 1000,
          storage: 1024 * 1024 * 1024, // 1GB
          bandwidth: 10 * 1024 * 1024 * 1024, // 10GB
          projects: 10
        },
        usage: {
          apiCalls: await this.getUserApiUsage(userId),
          storage: await this.getUserStorageUsage(userId),
          bandwidth: 1024 * 1024 * 100, // 100MB used
          projects: await this.env.DB.prepare('SELECT COUNT(*) as count FROM projects WHERE user_id = ?').bind(userId).first()
        },
        remaining: {
          apiCalls: 800,
          storage: 1024 * 1024 * 1024 - await this.getUserStorageUsage(userId),
          bandwidth: 10 * 1024 * 1024 * 1024 - (1024 * 1024 * 100),
          projects: 8
        }
      };
    } catch (error) {
      return {
        plan: 'free',
        limits: {},
        usage: {},
        remaining: {}
      };
    }
  }

  /**
   * Get user's recent projects
   */
  private async getRecentProjects(userId: string) {
    try {
      const results = await this.env.DB.prepare(`
        SELECT id, name, updated_at as last_accessed
        FROM projects
        WHERE user_id = ? AND status != 'deleted'
        ORDER BY updated_at DESC
        LIMIT 5
      `).bind(userId).all();

      return (results.results || []).map((row: any) => ({
        projectId: row.id,
        projectName: row.name,
        lastAccessed: row.last_accessed
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get user's recent test runs
   */
  private async getRecentRuns(userId: string) {
    try {
      const results = await this.env.DB.prepare(`
        SELECT
          tr.id as run_id,
          tr.status,
          tr.results->>'duration' as duration,
          p.name as project_name
        FROM test_runs tr
        JOIN projects p ON tr.project_id = p.id
        WHERE tr.triggered_by = ?
        ORDER BY tr.triggered_at DESC
        LIMIT 10
      `).bind(userId).all();

      return (results.results || []).map((row: any) => ({
        runId: row.run_id,
        projectName: row.project_name,
        status: row.status,
        duration: row.duration || 0
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get user API usage
   */
  private async getUserApiUsage(userId: string): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const usageKey = `usage:${userId}:${today}`;
      const usage = await this.env.CACHE.get(usageKey);
      return usage ? parseInt(usage) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get user storage usage
   */
  private async getUserStorageUsage(userId: string): Promise<number> {
    try {
      // This would calculate actual storage usage from R2 buckets
      // For now, return a mock value
      return 1024 * 1024 * 100; // 100MB
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get system overview (admin only)
   */
  private async getSystemOverview() {
    try {
      const [
        totalUsers,
        activeUsers,
        totalProjects,
        totalRuns
      ] = await Promise.all([
        this.env.DB.prepare('SELECT COUNT(*) as count FROM (SELECT DISTINCT user_id FROM projects)').first(),
        this.getActiveUsersCount(),
        this.env.DB.prepare('SELECT COUNT(*) as count FROM projects WHERE status != "deleted"').first(),
        this.env.DB.prepare('SELECT COUNT(*) as count FROM test_runs').first()
      ]);

      return {
        totalUsers: totalUsers?.count || 0,
        activeUsers,
        totalProjects: totalProjects?.count || 0,
        totalRuns: totalRuns?.count || 0,
        systemHealth: 'healthy',
        uptime: 99.9,
        responseTime: 150
      };
    } catch (error) {
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalProjects: 0,
        totalRuns: 0,
        systemHealth: 'healthy',
        uptime: 0,
        responseTime: 0
      };
    }
  }

  /**
   * Get system performance metrics
   */
  private async getSystemPerformance() {
    try {
      // Mock performance data - in production, this would come from monitoring
      return {
        averageResponseTime: 150,
        errorRate: 2.5,
        throughput: 1000,
        concurrency: 50
      };
    } catch (error) {
      return {
        averageResponseTime: 0,
        errorRate: 0,
        throughput: 0,
        concurrency: 0
      };
    }
  }

  /**
   * Get storage analytics
   */
  private async getStorageAnalytics() {
    try {
      // Mock storage data - in production, this would query R2 buckets
      return {
        totalStorageUsed: 1024 * 1024 * 1024 * 10, // 10GB
        totalFilesStored: 50000,
        storageByType: {
          'test-artifacts': 1024 * 1024 * 1024 * 6, // 6GB
          'screenshots': 1024 * 1024 * 1024 * 2, // 2GB
          'logs': 1024 * 1024 * 1024 * 1, // 1GB
          'backups': 1024 * 1024 * 1024 * 1 // 1GB
        },
        growthRate: 15.5 // percentage per month
      };
    } catch (error) {
      return {
        totalStorageUsed: 0,
        totalFilesStored: 0,
        storageByType: {},
        growthRate: 0
      };
    }
  }

  /**
   * Get usage analytics
   */
  private async getUsageAnalytics() {
    try {
      const [endpointUsage, userUsage] = await Promise.all([
        this.env.DB.prepare(`
          SELECT endpoint, COUNT(*) as calls
          FROM api_analytics
          WHERE timestamp >= datetime('now', '-7 days')
          GROUP BY endpoint
          ORDER BY calls DESC
          LIMIT 10
        `).all(),
        this.env.DB.prepare(`
          SELECT
            aa.user_id,
            COUNT(*) as calls,
            u.email
          FROM api_analytics aa
          LEFT JOIN users u ON aa.user_id = u.id
          WHERE aa.timestamp >= datetime('now', '-7 days')
          GROUP BY aa.user_id, u.email
          ORDER BY calls DESC
          LIMIT 10
        `).all()
      ]);

      return {
        apiCallsByEndpoint: Object.fromEntries(
          (endpointUsage.results || []).map((row: any) => [row.endpoint, row.calls])
        ),
        apiCallsByUser: (userUsage.results || []).map((row: any) => ({
          userId: row.user_id,
          calls: row.calls,
          email: row.email || `user-${row.user_id}@example.com`
        })),
        popularFeatures: [
          { feature: 'test-execution', usage: 1250 },
          { feature: 'project-management', usage: 890 },
          { feature: 'analytics', usage: 650 },
          { feature: 'file-uploads', usage: 420 }
        ]
      };
    } catch (error) {
      return {
        apiCallsByEndpoint: {},
        apiCallsByUser: [],
        popularFeatures: []
      };
    }
  }
}

export default AnalyticsService;
