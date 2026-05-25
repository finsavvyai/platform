/**
 * Report Service - Beta report generation, recommendations, and action items
 */

import { Context } from 'hono';
import type { BetaMetrics, BetaServiceDeps } from './beta-config';
import { ApplicationService } from './application.service';
import { MetricsService } from './metrics.service';

export class ReportService {
  private db: D1Database;
  private kv: KVNamespace;
  private applicationService: ApplicationService;
  private metricsService: MetricsService;

  constructor(deps: BetaServiceDeps, applicationService: ApplicationService, metricsService: MetricsService) {
    this.db = deps.db;
    this.kv = deps.kv;
    this.applicationService = applicationService;
    this.metricsService = metricsService;
  }

  async generateBetaReport(c: Context, reportType: 'weekly' | 'summary' | 'detailed') {
    const isAdmin = await this.applicationService.checkAdminRole(c.get('userId'));
    if (!isAdmin) throw new Error('Unauthorized: Admin access required');

    const metrics = await this.metricsService.getBetaMetrics(c);
    const topFeedback = await this.getTopFeedback(20);
    const activeScenarios = await this.getActiveScenarioStats();
    const userSegmentation = await this.getUserSegmentation();
    const recommendations = this.generateRecommendations(metrics);

    const report = {
      reportType,
      generatedAt: new Date().toISOString(),
      period: reportType === 'weekly' ? 'Last 7 days' : 'Beta program duration',
      metrics,
      insights: {
        topIssues: topFeedback.slice(0, 5),
        mostTestedFeatures: activeScenarios.slice(0, 5),
        userSegments: userSegmentation,
        trends: this.identifyTrends(),
      },
      recommendations,
      actionItems: this.generateActionItems(),
      appendices: {
        allFeedback: topFeedback,
        scenarioStats: activeScenarios,
        userActivity: { dailyActiveUsers: [], featureUsage: [] },
      },
    };

    const reportId = crypto.randomUUID();
    await this.kv.put(`beta-report:${reportId}`, JSON.stringify(report), { expirationTtl: 30 * 24 * 60 * 60 });

    return { success: true, reportId, report, downloadUrl: `/api/beta/reports/${reportId}/download` };
  }

  private async getTopFeedback(limit: number = 20) {
    return await this.db.prepare(`SELECT f.*, u.name, u.email FROM beta_feedback f
      JOIN beta_users u ON f.user_id = u.user_id ORDER BY f.priority DESC, f.created_at DESC LIMIT ?`)
      .bind(limit).all();
  }

  private async getActiveScenarioStats() {
    return await this.db.prepare(`SELECT s.name, s.phase, COUNT(sc.id) as completions, AVG(s.completion_points) as avg_points
      FROM beta_testing_scenarios s LEFT JOIN beta_scenario_completions sc ON s.id = sc.scenario_id
      WHERE s.active = true GROUP BY s.id ORDER BY completions DESC`).all();
  }

  private async getUserSegmentation() {
    return await this.db.prepare(`SELECT experience, COUNT(*) as count, AVG(engagement_score) as avg_engagement,
      AVG(feedback_count) as avg_feedback FROM beta_users WHERE application_status = 'active' GROUP BY experience`).all();
  }

  private identifyTrends() {
    return {
      increasingIssues: ['Document upload timeouts', 'Search performance'],
      positiveFeedback: ['SDK ease of use', 'Documentation quality'],
      commonFeatureRequests: ['Batch processing', 'Real-time notifications'],
      dropoffPoints: ['Advanced configuration', 'Custom integrations'],
    };
  }

  private generateRecommendations(metrics: BetaMetrics) {
    const recommendations = [];
    if (metrics.completionRate < 50) {
      recommendations.push({
        priority: 'high', type: 'onboarding', title: 'Improve onboarding flow',
        description: 'Low completion rate suggests onboarding issues',
        action: 'Simplify initial setup and add guided tutorials',
      });
    }
    if (metrics.averageEngagementScore < 70) {
      recommendations.push({
        priority: 'medium', type: 'engagement', title: 'Boost user engagement',
        description: 'Engagement score below target',
        action: 'Add gamification and regular check-ins',
      });
    }
    if (metrics.npsScore < 40) {
      recommendations.push({
        priority: 'high', type: 'satisfaction', title: 'Address user satisfaction',
        description: 'NPS score indicates dissatisfaction',
        action: 'Conduct user interviews and address top pain points',
      });
    }
    return recommendations;
  }

  private generateActionItems() {
    return [
      { owner: 'Product Team', action: 'Review and prioritize top 10 feature requests',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
      { owner: 'Engineering', action: 'Fix all critical and high-priority bugs',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
      { owner: 'Community Manager', action: 'Schedule office hours for next week',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() },
    ];
  }
}
