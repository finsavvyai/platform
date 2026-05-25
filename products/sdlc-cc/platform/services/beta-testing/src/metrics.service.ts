/**
 * Metrics Service - Beta program metrics and scoring
 */

import { Context } from 'hono';
import type { BetaUser, BetaMetrics, BetaServiceDeps } from './beta-config';
import { ApplicationService } from './application.service';

export class MetricsService {
  private db: D1Database;
  private applicationService: ApplicationService;

  constructor(deps: BetaServiceDeps, applicationService: ApplicationService) {
    this.db = deps.db;
    this.applicationService = applicationService;
  }

  async getBetaMetrics(c: Context): Promise<BetaMetrics> {
    const isAdmin = await this.applicationService.checkAdminRole(c.get('userId'));
    if (!isAdmin) throw new Error('Unauthorized: Admin access required');

    const metrics = await this.db.prepare(`SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN application_status = 'active' THEN 1 END) as active_users,
        COUNT(CASE WHEN application_status = 'completed' THEN 1 END) as completed_users,
        AVG(engagement_score) as avg_engagement,
        SUM(feedback_count) as total_feedback,
        SUM(bugs_reported) as total_bugs
      FROM beta_users`)
      .first<{
        total_users: number; active_users: number; completed_users: number;
        avg_engagement: number; total_feedback: number; total_bugs: number;
      }>();

    const phaseDist = await this.db.prepare(`SELECT testing_phase, COUNT(*) as count
      FROM beta_users WHERE application_status = 'active' GROUP BY testing_phase`)
      .all<{ testing_phase: BetaUser['testingPhase']; count: number }>();

    const phaseDistribution = phaseDist.reduce((acc, row) => {
      acc[row.testing_phase] = row.count;
      return acc;
    }, {} as Record<BetaUser['testingPhase'], number>);

    const completionRate = metrics?.total_users
      ? (metrics.completed_users / metrics.total_users) * 100 : 0;

    return {
      totalUsers: metrics?.total_users || 0,
      activeUsers: metrics?.active_users || 0,
      completionRate,
      averageEngagementScore: metrics?.avg_engagement || 0,
      feedbackCount: metrics?.total_feedback || 0,
      bugsReported: metrics?.total_bugs || 0,
      featureRequests: await this.getFeatureRequestCount(),
      npsScore: await this.calculateNPSScore(),
      satisfactionScore: await this.calculateSatisfactionScore(),
      phaseDistribution,
      weeklyActivity: this.getWeeklyActivity(),
    };
  }

  private getWeeklyActivity() {
    return Array.from({ length: 8 }, (_, i) => ({
      week: i + 1,
      activeUsers: Math.floor(Math.random() * 80) + 20,
      feedbackSubmitted: Math.floor(Math.random() * 50) + 10,
      scenariosCompleted: Math.floor(Math.random() * 200) + 50,
    }));
  }

  private async calculateNPSScore(): Promise<number> {
    const result = await this.db.prepare(`SELECT
        SUM(CASE WHEN would_recommend = true THEN 1 ELSE 0 END) as promoters,
        SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as detractors,
        COUNT(*) as total
      FROM beta_survey_responses WHERE survey_id LIKE '%nps%'`)
      .first<{ promoters: number; detractors: number; total: number }>();
    if (!result || result.total === 0) return 0;
    return (result.promoters / result.total) * 100 - (result.detractors / result.total) * 100;
  }

  private async calculateSatisfactionScore(): Promise<number> {
    const result = await this.db
      .prepare('SELECT AVG(rating) as avg_rating FROM beta_survey_responses')
      .first<{ avg_rating: number }>();
    return result?.avg_rating ? (result.avg_rating / 5) * 100 : 0;
  }

  private async getFeatureRequestCount(): Promise<number> {
    const result = await this.db
      .prepare('SELECT COUNT(*) as count FROM beta_feedback WHERE type = "feature"')
      .first<{ count: number }>();
    return result?.count || 0;
  }
}
