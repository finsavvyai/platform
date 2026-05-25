/**
 * Analytics Service - Comprehensive Business Intelligence
 * Provides metrics, reporting, and insights for the Qestro SaaS platform
 */

import { DatabaseService } from '../services/DatabaseService';

interface DashboardMetrics {
  overview: {
    totalUsers: number;
    activeTeams: number;
    monthlyRecurringRevenue: number;
    churnRate: number;
    customerAcquisitionCost: number;
    lifetimeValue: number;
    growthRate: number;
  };
  userMetrics: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
    userRetentionRate: number;
    averageSessionDuration: number;
  };
  productMetrics: {
    totalProjects: number;
    totalTestRuns: number;
    testRunsToday: number;
    testSuccessRate: number;
    averageTestDuration: number;
    popularFeatures: Array<{ feature: string; usage: number }>;
    deviceBreakdown: Array<{ device: string; count: number }>;
  };
  financialMetrics: {
    revenueByPlan: Array<{ plan: string; revenue: number; users: number }>;
    revenueGrowth: Array<{ period: string; revenue: number; growth: number }>;
    usageBasedRevenue: number;
    subscriptionRevenue: number;
    churnedRevenue: number;
    projectedRevenue: number;
  };
  operationalMetrics: {
    systemUptime: number;
    averageResponseTime: number;
    errorRate: number;
    supportTickets: number;
    customerSatisfaction: number;
    resourceUtilization: number;
  };
}

interface ReportConfig {
  type: 'executive' | 'financial' | 'product' | 'operational';
  dateRange: '7d' | '30d' | '90d' | '1y' | 'custom';
  customStartDate?: Date;
  customEndDate?: Date;
  filters?: {
    plan?: string[];
    team?: string[];
    region?: string[];
  };
  format: 'json' | 'csv' | 'pdf';
  includeComparison?: boolean;
}

interface UserBehaviorMetrics {
  userId: string;
  sessionId: string;
  actions: Array<{
    action: string;
    timestamp: Date;
    properties: Record<string, any>;
  }>;
  sessionDuration: number;
  pagesVisited: number;
  featuresUsed: string[];
  conversionEvents: string[];
  deviceInfo: Record<string, any>;
}

export class AnalyticsService {
  private readonly db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(params: {
    userId?: string;
    teamId?: string;
    dateRange?: '7d' | '30d' | '90d' | '1y';
    timezone?: string;
  } = {}): Promise<DashboardMetrics> {
    try {
      const { startDate, endDate } = this.getDateRange(params.dateRange || '30d');

      const [
        overview,
        userMetrics,
        productMetrics,
        financialMetrics,
        operationalMetrics
      ] = await Promise.all([
        this.getOverviewMetrics({ startDate, endDate, ...params }),
        this.getUserMetrics({ startDate, endDate, ...params }),
        this.getProductMetrics({ startDate, endDate, ...params }),
        this.getFinancialMetrics({ startDate, endDate, ...params }),
        this.getOperationalMetrics({ startDate, endDate, ...params })
      ]);

      return {
        overview,
        userMetrics,
        productMetrics,
        financialMetrics,
        operationalMetrics
      };

    } catch (error) {
      console.error('Get dashboard metrics error:', error);
      throw new Error('Failed to get dashboard metrics');
    }
  }

  /**
   * Get executive overview metrics
   */
  private async getOverviewMetrics(params: {
    startDate: Date;
    endDate: Date;
    userId?: string;
    teamId?: string;
  }): Promise<DashboardMetrics['overview']> {
    const conditions = this.buildConditions(params);
    const values = this.buildValues(params);

    // Total users
    const totalUsersResult = await this.db.query(
      `SELECT COUNT(DISTINCT user_id) as count
       FROM team_members
       WHERE ${conditions.userCondition}`,
      values.user
    );

    // Active teams
    const activeTeamsResult = await this.db.query(
      `SELECT COUNT(DISTINCT team_id) as count
       FROM team_members
       WHERE ${conditions.teamCondition} AND is_active = true`,
      values.team
    );

    // Monthly recurring revenue
    const mrrResult = await this.db.query(
      `SELECT SUM(CASE
         WHEN p.billing_interval = 'month' THEN p.price_cents
         WHEN p.billing_interval = 'year' THEN p.price_cents / 12
         ELSE 0
       END) as revenue
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.status = 'active' AND ${conditions.subscriptionCondition}`,
      values.subscription
    );

    // Churn rate (last 30 days vs previous 30 days)
    const churnResult = await this.db.query(
      `WITH current_period AS (
        SELECT COUNT(DISTINCT CASE WHEN s.status = 'canceled' THEN s.id END) as canceled,
               COUNT(DISTINCT s.id) as total
        FROM subscriptions s
        WHERE s.created_at >= $1 AND s.created_at < $2
        AND ${conditions.subscriptionCondition}
      ),
      previous_period AS (
        SELECT COUNT(DISTINCT CASE WHEN s.status = 'canceled' THEN s.id END) as canceled,
               COUNT(DISTINCT s.id) as total
        FROM subscriptions s
        WHERE s.created_at >= $3 AND s.created_at < $1
        AND ${conditions.subscriptionCondition}
      )
      SELECT
        CASE
          WHEN (SELECT total FROM previous_period) = 0 THEN 0
          ELSE (current_period.canceled::float / NULLIF((SELECT total FROM previous_period), 0)) * 100
        END as churn_rate
      FROM current_period, previous_period`,
      [
        params.startDate,
        params.endDate,
        new Date(params.startDate.getTime() - 30 * 24 * 60 * 60 * 1000)
      ]
    );

    // Customer acquisition cost (simplified)
    const cacResult = await this.db.query(
      `SELECT
         CASE
           WHEN COUNT(DISTINCT u.id) = 0 THEN 0
           ELSE 5000.0 / COUNT(DISTINCT u.id) -- Assuming $5000 monthly marketing spend
         END as cac
       FROM users u
       WHERE u.created_at >= $1 AND u.created_at < $2`,
      [params.startDate, params.endDate]
    );

    // Customer lifetime value (simplified)
    const ltvResult = await this.db.query(
      `SELECT
         CASE
           WHEN COUNT(DISTINCT u.id) = 0 THEN 0
           ELSE (COALESCE(AVG(p.price_cents), 0) * 12) / 100 -- Average annual value
         END as ltv
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id
       LEFT JOIN plans p ON s.plan_id = p.id
       WHERE u.created_at >= $1 AND u.created_at < $2`,
      [params.startDate, params.endDate]
    );

    // Growth rate
    const growthResult = await this.db.query(
      `WITH current_users AS (
        SELECT COUNT(DISTINCT user_id) as count
        FROM team_members
        WHERE ${conditions.userCondition}
      ),
      previous_users AS (
        SELECT COUNT(DISTINCT user_id) as count
        FROM team_members
        WHERE created_at >= $1 AND created_at < $2
        AND ${conditions.userCondition}
      )
      SELECT
        CASE
          WHEN (SELECT count FROM previous_users) = 0 THEN 0
          ELSE ((current_users.count - previous_users.count)::float / previous_users.count) * 100
        END as growth_rate
      FROM current_users, previous_users`,
      [
        new Date(params.startDate.getTime() - 30 * 24 * 60 * 60 * 1000),
        params.startDate
      ]
    );

    return {
      totalUsers: parseInt(totalUsersResult.rows[0].count) || 0,
      activeTeams: parseInt(activeTeamsResult.rows[0].count) || 0,
      monthlyRecurringRevenue: parseFloat(mrrResult.rows[0].revenue) || 0,
      churnRate: parseFloat(churnResult.rows[0].churn_rate) || 0,
      customerAcquisitionCost: parseFloat(cacResult.rows[0].cac) || 0,
      lifetimeValue: parseFloat(ltvResult.rows[0].ltv) || 0,
      growthRate: parseFloat(growthResult.rows[0].growth_rate) || 0
    };
  }

  /**
   * Get user engagement metrics
   */
  private async getUserMetrics(params: {
    startDate: Date;
    endDate: Date;
    userId?: string;
    teamId?: string;
  }): Promise<DashboardMetrics['userMetrics']> {
    const conditions = this.buildConditions(params);
    const values = this.buildValues(params);

    // Active users by time period
    const [dau, wau, mau] = await Promise.all([
      this.db.query(
        `SELECT COUNT(DISTINCT user_id) as count
         FROM user_sessions
         WHERE last_used_at >= $1 AND last_used_at < $2
         AND ${conditions.userCondition}`,
        [new Date(), new Date(Date.now() + 24 * 60 * 60 * 1000), ...values.user]
      ),
      this.db.query(
        `SELECT COUNT(DISTINCT user_id) as count
         FROM user_sessions
         WHERE last_used_at >= $1 AND last_used_at < $2
         AND ${conditions.userCondition}`,
        [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date(), ...values.user]
      ),
      this.db.query(
        `SELECT COUNT(DISTINCT user_id) as count
         FROM user_sessions
         WHERE last_used_at >= $1 AND last_used_at < $2
         AND ${conditions.userCondition}`,
        [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date(), ...values.user]
      )
    ]);

    // New users
    const [newToday, newWeek, newMonth] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*) as count FROM users
         WHERE created_at >= $1 AND created_at < $2`,
        [new Date(), new Date(Date.now() + 24 * 60 * 60 * 1000)]
      ),
      this.db.query(
        `SELECT COUNT(*) as count FROM users
         WHERE created_at >= $1 AND created_at < $2`,
        [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()]
      ),
      this.db.query(
        `SELECT COUNT(*) as count FROM users
         WHERE created_at >= $1 AND created_at < $2`,
        [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()]
      )
    ]);

    // User retention (simplified)
    const retentionResult = await this.db.query(
      `WITH cohort_users AS (
        SELECT DISTINCT user_id
        FROM users
        WHERE created_at >= $1 AND created_at < $2
      ),
      retained_users AS (
        SELECT DISTINCT s.user_id
        FROM user_sessions s
        JOIN cohort_users c ON s.user_id = c.user_id
        WHERE s.last_used_at >= $3
      )
      SELECT
        CASE
          WHEN (SELECT COUNT(*) FROM cohort_users) = 0 THEN 0
          ELSE (SELECT COUNT(*) FROM retained_users)::float / (SELECT COUNT(*) FROM cohort_users) * 100
        END as retention_rate
      FROM cohort_users`,
      [
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ]
    );

    // Average session duration
    const sessionDurationResult = await this.db.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (last_used_at - created_at))) as avg_duration
       FROM user_sessions
       WHERE created_at >= $1 AND created_at < $2
       AND last_used_at > created_at`,
      [params.startDate, params.endDate]
    );

    return {
      dailyActiveUsers: parseInt(dau.rows[0].count) || 0,
      weeklyActiveUsers: parseInt(wau.rows[0].count) || 0,
      monthlyActiveUsers: parseInt(mau.rows[0].count) || 0,
      newUsersToday: parseInt(newToday.rows[0].count) || 0,
      newUsersThisWeek: parseInt(newWeek.rows[0].count) || 0,
      newUsersThisMonth: parseInt(newMonth.rows[0].count) || 0,
      userRetentionRate: parseFloat(retentionResult.rows[0].retention_rate) || 0,
      averageSessionDuration: parseFloat(sessionDurationResult.rows[0].avg_duration) || 0
    };
  }

  /**
   * Get product usage metrics
   */
  private async getProductMetrics(params: {
    startDate: Date;
    endDate: Date;
    userId?: string;
    teamId?: string;
  }): Promise<DashboardMetrics['productMetrics']> {
    const conditions = this.buildConditions(params);
    const values = this.buildValues(params);

    // Total projects and test runs
    const [projects, testRuns] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*) as count FROM projects
         WHERE ${conditions.projectCondition}`,
        values.project
      ),
      this.db.query(
        `SELECT COUNT(*) as count FROM test_runs
         WHERE created_at >= $1 AND created_at < $2
         AND ${conditions.testCondition}`,
        [params.startDate, params.endDate, ...values.test]
      )
    ]);

    // Test runs today
    const testRunsTodayResult = await this.db.query(
      `SELECT COUNT(*) as count FROM test_runs
       WHERE created_at >= $1 AND created_at < $2
       AND ${conditions.testCondition}`,
      [new Date(), new Date(Date.now() + 24 * 60 * 60 * 1000), ...values.test]
    );

    // Test success rate
    const successRateResult = await this.db.query(
      `SELECT
         CASE
           WHEN COUNT(*) = 0 THEN 0
           ELSE (COUNT(*) FILTER (WHERE status = 'passed')::float / COUNT(*)) * 100
         END as success_rate
       FROM test_runs
       WHERE created_at >= $1 AND created_at < $2
       AND ${conditions.testCondition}`,
      [params.startDate, params.endDate, ...values.test]
    );

    // Average test duration
    const avgDurationResult = await this.db.query(
      `SELECT AVG(duration_ms) as avg_duration
       FROM test_runs
       WHERE created_at >= $1 AND created_at < $2
       AND duration_ms IS NOT NULL
       AND ${conditions.testCondition}`,
      [params.startDate, params.endDate, ...values.test]
    );

    // Popular features (based on test types)
    const popularFeaturesResult = await this.db.query(
      `SELECT test_type as feature, COUNT(*) as usage
       FROM test_cases tc
       JOIN test_runs tr ON tc.id = tr.test_case_id
       WHERE tr.created_at >= $1 AND tr.created_at < $2
       AND ${conditions.testCondition}
       GROUP BY test_type
       ORDER BY usage DESC
       LIMIT 10`,
      [params.startDate, params.endDate, ...values.test]
    );

    // Device breakdown
    const deviceBreakdownResult = await this.db.query(
      `SELECT
         CASE
           WHEN device_info->>'type' = 'mobile' THEN 'Mobile'
           WHEN device_info->>'type' = 'tablet' THEN 'Tablet'
           WHEN device_info->>'type' = 'desktop' THEN 'Desktop'
           ELSE 'Other'
         END as device,
         COUNT(*) as count
       FROM test_runs
       WHERE created_at >= $1 AND created_at < $2
       AND device_info IS NOT NULL
       GROUP BY device
       ORDER BY count DESC`,
      [params.startDate, params.endDate]
    );

    return {
      totalProjects: parseInt(projects.rows[0].count) || 0,
      totalTestRuns: parseInt(testRuns.rows[0].count) || 0,
      testRunsToday: parseInt(testRunsTodayResult.rows[0].count) || 0,
      testSuccessRate: parseFloat(successRateResult.rows[0].success_rate) || 0,
      averageTestDuration: parseFloat(avgDurationResult.rows[0].avg_duration) || 0,
      popularFeatures: popularFeaturesResult.rows,
      deviceBreakdown: deviceBreakdownResult.rows
    };
  }

  /**
   * Get financial metrics
   */
  private async getFinancialMetrics(params: {
    startDate: Date;
    endDate: Date;
    userId?: string;
    teamId?: string;
  }): Promise<DashboardMetrics['financialMetrics']> {
    const conditions = this.buildConditions(params);
    const values = this.buildValues(params);

    // Revenue by plan
    const revenueByPlanResult = await this.db.query(
      `SELECT
         p.name as plan,
         SUM(CASE
           WHEN p.billing_interval = 'month' THEN p.price_cents
           WHEN p.billing_interval = 'year' THEN p.price_cents / 12
           ELSE 0
         END) as revenue,
         COUNT(DISTINCT CASE
           WHEN s.user_id IS NOT NULL THEN s.user_id
           ELSE s.team_id
         END) as users
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.status = 'active'
       AND ${conditions.subscriptionCondition}
       GROUP BY p.name, p.id
       ORDER BY revenue DESC`,
      values.subscription
    );

    // Revenue growth (monthly)
    const revenueGrowthResult = await this.db.query(
      `SELECT
         DATE_TRUNC('month', created_at) as period,
         SUM(CASE
           WHEN p.billing_interval = 'month' THEN p.price_cents
           WHEN p.billing_interval = 'year' THEN p.price_cents / 12
           ELSE 0
         END) as revenue
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.created_at >= $1 AND s.created_at < $2
       AND ${conditions.subscriptionCondition}
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY period ASC`,
      [
        new Date(params.startDate.getTime() - 90 * 24 * 60 * 60 * 1000),
        params.endDate,
        ...values.subscription
      ]
    );

    // Calculate growth rates
    const revenueGrowth = revenueGrowthResult.rows.map((row, index) => ({
      period: row.period.toISOString().split('T')[0],
      revenue: parseFloat(row.revenue) || 0,
      growth: index > 0 ?
        ((parseFloat(row.revenue) - parseFloat(revenueGrowthResult.rows[index - 1].revenue)) /
          parseFloat(revenueGrowthResult.rows[index - 1].revenue)) * 100 : 0
    }));

    // Usage-based revenue
    const usageRevenueResult = await this.db.query(
      `SELECT COALESCE(SUM(metric_value * 0.01), 0) as revenue
       FROM usage_metrics
       WHERE created_at >= $1 AND created_at < $2
       AND ${conditions.usageCondition}`,
      [params.startDate, params.endDate, ...values.usage]
    );

    return {
      revenueByPlan: revenueByPlanResult.rows,
      revenueGrowth,
      usageBasedRevenue: parseFloat(usageRevenueResult.rows[0].revenue) || 0,
      subscriptionRevenue: revenueByPlanResult.rows.reduce((sum, row) => sum + parseFloat(row.revenue), 0),
      churnedRevenue: 0, // TODO: Implement churned revenue calculation
      projectedRevenue: revenueByPlanResult.rows.reduce((sum, row) => sum + parseFloat(row.revenue), 0) * 1.1 // 10% growth projection
    };
  }

  /**
   * Get operational metrics
   */
  private async getOperationalMetrics(params: {
    startDate: Date;
    endDate: Date;
    userId?: string;
    teamId?: string;
  }): Promise<DashboardMetrics['operationalMetrics']> {
    // System uptime (simplified - in production, use monitoring service)
    const systemUptime = 99.9;

    // Average response time (simplified - in production, use APM service)
    const averageResponseTime = 250; // milliseconds

    // Error rate (simplified)
    const errorRateResult = await this.db.query(
      `SELECT
         CASE
           WHEN COUNT(*) = 0 THEN 0
           ELSE (COUNT(*) FILTER (WHERE NOT success)::float / COUNT(*)) * 100
         END as error_rate
       FROM audit_logs
       WHERE created_at >= $1 AND created_at < $2`,
      [params.startDate, params.endDate]
    );

    // Support tickets (simplified - would integrate with support system)
    const supportTickets = 15;

    // Customer satisfaction (simplified - would integrate with survey system)
    const customerSatisfaction = 4.2; // out of 5

    // Resource utilization
    const resourceUtilizationResult = await this.db.query(
      `SELECT
         CASE
           WHEN COUNT(*) = 0 THEN 0
           ELSE (SUM(metric_value) / NULLIF(MAX(metric_value), 0)) * 100
         END as utilization
       FROM usage_metrics
       WHERE metric_type = 'parallel_executions'
       AND created_at >= $1 AND created_at < $2`,
      [params.startDate, params.endDate]
    );

    return {
      systemUptime,
      averageResponseTime,
      errorRate: parseFloat(errorRateResult.rows[0].error_rate) || 0,
      supportTickets,
      customerSatisfaction,
      resourceUtilization: parseFloat(resourceUtilizationResult.rows[0].utilization) || 0
    };
  }

  /**
   * Generate comprehensive report
   */
  async generateReport(config: ReportConfig): Promise<any> {
    try {
      let startDate: Date;
      let endDate: Date;

      if (config.dateRange === 'custom' && config.customStartDate && config.customEndDate) {
        startDate = config.customStartDate;
        endDate = config.customEndDate;
      } else if (config.dateRange !== 'custom') {
        const range = this.getDateRange(config.dateRange);
        startDate = range.startDate;
        endDate = range.endDate;
      } else {
        // Default to 30 days if custom is specified without dates
        const range = this.getDateRange('30d');
        startDate = range.startDate;
        endDate = range.endDate;
      }

      const baseParams = {
        startDate,
        endDate,
        filters: config.filters
      };

      switch (config.type) {
        case 'executive':
          return await this.generateExecutiveReport(baseParams);
        case 'financial':
          return await this.generateFinancialReport(baseParams);
        case 'product':
          return await this.generateProductReport(baseParams);
        case 'operational':
          return await this.generateOperationalReport(baseParams);
        default:
          throw new Error('Invalid report type');
      }

    } catch (error) {
      console.error('Generate report error:', error);
      throw new Error('Failed to generate report');
    }
  }

  /**
   * Track user behavior events
   */
  async trackUserBehavior(event: UserBehaviorMetrics): Promise<void> {
    try {
      // This would integrate with a proper analytics service like Segment or Mixpanel
      // For now, we'll store basic tracking data
      await this.db.query(
        `INSERT INTO user_behavior_events
         (user_id, session_id, action, properties, timestamp, device_info)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          event.userId,
          event.sessionId,
          JSON.stringify(event.actions),
          JSON.stringify({
            sessionDuration: event.sessionDuration,
            pagesVisited: event.pagesVisited,
            featuresUsed: event.featuresUsed,
            conversionEvents: event.conversionEvents
          }),
          new Date(),
          JSON.stringify(event.deviceInfo)
        ]
      );

    } catch (error) {
      console.error('Track user behavior error:', error);
      // Don't throw - tracking failures shouldn't break the app
    }
  }

  /**
   * Get usage insights and recommendations
   */
  async getUsageInsights(params: {
    userId?: string;
    teamId?: string;
    dateRange?: '7d' | '30d' | '90d';
  }): Promise<{
    insights: Array<{
      type: 'optimization' | 'opportunity' | 'warning';
      title: string;
      description: string;
      impact: 'high' | 'medium' | 'low';
      recommendedAction: string;
    }>;
    trends: Array<{
      metric: string;
      trend: 'up' | 'down' | 'stable';
      change: number;
      period: string;
    }>;
  }> {
    try {
      const { startDate, endDate } = this.getDateRange(params.dateRange || '30d');

      // This would typically involve complex analysis
      // For now, returning placeholder insights
      const insights = [
        {
          type: 'opportunity' as const,
          title: 'Increase Test Coverage',
          description: 'Your team is running 25% fewer tests than similar teams',
          impact: 'medium' as const,
          recommendedAction: 'Set up automated test scheduling to increase coverage'
        },
        {
          type: 'optimization' as const,
          title: 'Optimize Test Execution',
          description: 'Some tests are running slower than average',
          impact: 'low' as const,
          recommendedAction: 'Review slow tests and optimize test configuration'
        }
      ];

      const trends = [
        {
          metric: 'Test Runs',
          trend: 'up' as const,
          change: 15.5,
          period: '30d'
        },
        {
          metric: 'Success Rate',
          trend: 'stable' as const,
          change: 2.1,
          period: '30d'
        }
      ];

      return { insights, trends };

    } catch (error) {
      console.error('Get usage insights error:', error);
      throw new Error('Failed to get usage insights');
    }
  }

  // Private helper methods

  private getDateRange(range: '7d' | '30d' | '90d' | '1y'): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (range) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    return { startDate, endDate };
  }

  private buildConditions(params: { userId?: string; teamId?: string }): any {
    return {
      userCondition: params.userId ? 'user_id = $1' : '1=1',
      teamCondition: params.teamId ? 'team_id = $1' : '1=1',
      projectCondition: params.teamId ? 'team_id = $1' : '1=1',
      testCondition: params.teamId ?
        'project_id IN (SELECT id FROM projects WHERE team_id = $1)' : '1=1',
      subscriptionCondition: params.userId ? 'user_id = $1' :
        params.teamId ? 'team_id = $1' : '1=1',
      usageCondition: params.userId ? 'user_id = $1' :
        params.teamId ? 'team_id = $1' : '1=1'
    };
  }

  private buildValues(params: { userId?: string; teamId?: string }): any {
    return {
      user: params.userId ? [params.userId] : [],
      team: params.teamId ? [params.teamId] : [],
      project: params.teamId ? [params.teamId] : [],
      test: params.teamId ? [params.teamId] : [],
      subscription: params.userId ? [params.userId] :
        params.teamId ? [params.teamId] : [],
      usage: params.userId ? [params.userId] :
        params.teamId ? [params.teamId] : []
    };
  }

  private async generateExecutiveReport(params: any): Promise<any> {
    const metrics = await this.getDashboardMetrics(params);

    return {
      type: 'executive',
      generatedAt: new Date(),
      dateRange: { startDate: params.startDate, endDate: params.endDate },
      metrics: {
        overview: metrics.overview,
        growth: {
          userGrowth: metrics.userMetrics.newUsersThisMonth,
          revenueGrowth: metrics.financialMetrics.revenueGrowth,
          teamGrowth: metrics.overview.activeTeams
        },
        performance: {
          systemHealth: metrics.operationalMetrics.systemUptime,
          customerSatisfaction: metrics.operationalMetrics.customerSatisfaction,
          churnRate: metrics.overview.churnRate
        }
      }
    };
  }

  private async generateFinancialReport(params: any): Promise<any> {
    const metrics = await this.getDashboardMetrics(params);

    return {
      type: 'financial',
      generatedAt: new Date(),
      dateRange: { startDate: params.startDate, endDate: params.endDate },
      metrics: {
        revenue: metrics.financialMetrics,
        costs: {
          infrastructure: 2000, // Placeholder
          support: 1500, // Placeholder
          development: 3000 // Placeholder
        },
        profitability: {
          gross: metrics.financialMetrics.subscriptionRevenue * 0.8,
          net: metrics.financialMetrics.subscriptionRevenue * 0.3
        }
      }
    };
  }

  private async generateProductReport(params: any): Promise<any> {
    const metrics = await this.getDashboardMetrics(params);

    return {
      type: 'product',
      generatedAt: new Date(),
      dateRange: { startDate: params.startDate, endDate: params.endDate },
      metrics: {
        usage: metrics.productMetrics,
        engagement: metrics.userMetrics,
        quality: {
          successRate: metrics.productMetrics.testSuccessRate,
          averageDuration: metrics.productMetrics.averageTestDuration,
          errorRate: metrics.operationalMetrics.errorRate
        }
      }
    };
  }

  private async generateOperationalReport(params: any): Promise<any> {
    const metrics = await this.getDashboardMetrics(params);

    return {
      type: 'operational',
      generatedAt: new Date(),
      dateRange: { startDate: params.startDate, endDate: params.endDate },
      metrics: {
        performance: metrics.operationalMetrics,
        support: {
          tickets: metrics.operationalMetrics.supportTickets,
          satisfaction: metrics.operationalMetrics.customerSatisfaction
        },
        infrastructure: {
          uptime: metrics.operationalMetrics.systemUptime,
          responseTime: metrics.operationalMetrics.averageResponseTime,
          utilization: metrics.operationalMetrics.resourceUtilization
        }
      }
    };
  }
}

export default AnalyticsService;
