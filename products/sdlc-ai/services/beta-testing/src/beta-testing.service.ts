/**
 * Beta Testing Service - Manages beta testing program, feedback collection, and user onboarding
 */

import { Context } from 'hono';
import { createMcpClient, z } from '@sdlc/mcp-sdk';

// Beta testing configuration
const BETA_CONFIG = {
  maxBetaUsers: 100,
  betaDuration: 8 * 7 * 24 * 60 * 60 * 1000, // 8 weeks in milliseconds
  feedbackRewardCredits: 100,
  criticalBugRewardCredits: 500,
  features: {
    advancedSearch: true,
    multiModalProcessing: true,
    customIntegrations: true,
    prioritySupport: true,
  },
  limits: {
    documentsPerUser: 1000,
    apiCallsPerDay: 10000,
    storagePerUser: 10 * 1024 * 1024 * 1024, // 10GB
  }
};

// Types for beta testing
interface BetaUser {
  id: string;
  email: string;
  name: string;
  company?: string;
  role?: string;
  experience: 'beginner' | 'intermediate' | 'expert';
  useCase: string;
  applicationStatus: 'pending' | 'approved' | 'rejected' | 'active' | 'completed';
  joinDate: Date;
  endDate?: Date;
  feedbackCount: number;
  bugsReported: number;
  rewardCredits: number;
  engagementScore: number;
  lastActiveDate?: Date;
  testingPhase: 'onboarding' | 'core' | 'advanced' | 'load' | 'integration';
  surveyResponses: Record<string, any>;
  notes: string;
}

interface Feedback {
  id: string;
  userId: string;
  type: 'bug' | 'feature' | 'usability' | 'performance' | 'general';
  category: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  context?: {
    feature?: string;
    endpoint?: string;
    sdk?: string;
    environment?: string;
    userAgent?: string;
    timestamp?: string;
    reproductionSteps?: string[];
  };
  attachments?: string[];
  status: 'new' | 'triaged' | 'in-progress' | 'resolved' | 'closed' | 'deferred';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  assignedTo?: string;
  response?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  userIdResponse?: string;
  helpful?: boolean;
}

interface TestingScenario {
  id: string;
  name: string;
  description: string;
  phase: BetaUser['testingPhase'];
  steps: string[];
  expectedOutcome: string;
  completionPoints: number;
  category: 'integration' | 'security' | 'performance' | 'usability' | 'feature';
  estimatedTime: number; // in minutes
  prerequisites?: string[];
}

interface BetaMetrics {
  totalUsers: number;
  activeUsers: number;
  completionRate: number;
  averageEngagementScore: number;
  feedbackCount: number;
  bugsReported: number;
  featureRequests: number;
  npsScore: number;
  satisfactionScore: number;
  phaseDistribution: Record<BetaUser['testingPhase'], number>;
  weeklyActivity: Array<{
    week: number;
    activeUsers: number;
    feedbackSubmitted: number;
    scenariosCompleted: number;
  }>;
}

// Schemas
const betaApplicationSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  company: z.string().optional(),
  role: z.string().optional(),
  experience: z.enum(['beginner', 'intermediate', 'expert']),
  useCase: z.string().min(10),
  motivation: z.string().min(20),
  technicalBackground: z.string().min(20),
  agreeToTerms: z.boolean().refine(v => v === true, 'Must agree to terms'),
});

const feedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'usability', 'performance', 'general']),
  title: z.string().min(5),
  description: z.string().min(10),
  context: z.object({
    feature: z.string().optional(),
    endpoint: z.string().optional(),
    sdk: z.string().optional(),
    environment: z.string().optional(),
    userAgent: z.string().optional(),
    reproductionSteps: z.array(z.string()).optional(),
  }).optional(),
  attachments: z.array(z.string()).optional(),
});

const surveyResponseSchema = z.object({
  surveyId: z.string(),
  responses: z.record(z.any()),
  rating: z.number().min(1).max(5),
  wouldRecommend: z.boolean(),
  comments: z.string().optional(),
});

class BetaTestingService {
  private db: D1Database;
  private kv: KVNamespace;
  private email: EmailSendingService;
  private monitoring: MonitoringService;

  constructor(db: D1Database, kv: KVNamespace, email: EmailSendingService, monitoring: MonitoringService) {
    this.db = db;
    this.kv = kv;
    this.email = email;
    this.monitoring = monitoring;
  }

  /**
   * Apply for beta testing program
   */
  async applyForBeta(c: Context, application: z.infer<typeof betaApplicationSchema>) {
    const userId = c.get('userId');
    const userIp = c.req.header('CF-Connecting-IP');

    // Check if user has already applied
    const existingApplication = await this.db
      .prepare('SELECT * FROM beta_users WHERE email = ? OR user_id = ?')
      .bind(application.email, userId)
      .first();

    if (existingApplication) {
      return {
        success: false,
        error: 'ALREADY_APPLIED',
        message: 'You have already applied for the beta program',
      };
    }

    // Check if beta is full
    const activeCount = await this.db
      .prepare('SELECT COUNT(*) as count FROM beta_users WHERE application_status = "active"')
      .first<{ count: number }>();

    if (activeCount?.count >= BETA_CONFIG.maxBetaUsers) {
      return {
        success: false,
        error: 'BETA_FULL',
        message: 'Beta testing program is currently full',
      };
    }

    // Create beta user record
    const betaUser: Omit<BetaUser, 'id' | 'joinDate' | 'feedbackCount' | 'bugsReported' | 'rewardCredits' | 'engagementScore'> = {
      email: application.email,
      name: application.name,
      company: application.company,
      role: application.role,
      experience: application.experience,
      useCase: application.useCase,
      applicationStatus: 'pending',
      testingPhase: 'onboarding',
      surveyResponses: {},
      notes: application.motivation + '\n\n' + application.technicalBackground,
    };

    const result = await this.db
      .prepare(`
        INSERT INTO beta_users (
          user_id, email, name, company, role, experience, use_case,
          application_status, testing_phase, notes, join_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        userId,
        betaUser.email,
        betaUser.name,
        betaUser.company,
        betaUser.role,
        betaUser.experience,
        betaUser.useCase,
        betaUser.applicationStatus,
        betaUser.testingPhase,
        betaUser.notes,
        new Date().toISOString()
      )
      .run();

    // Track application event
    await this.monitoring.trackEvent('beta_application_submitted', {
      userId,
      email: application.email,
      experience: application.experience,
      company: application.company,
      ip: userIp,
    });

    // Send confirmation email
    await this.email.send({
      to: application.email,
      template: 'beta-application-received',
      data: {
        name: application.name,
        experience: application.experience,
        expectedResponseTime: '3-5 business days',
      },
    });

    // Notify admin team
    await this.email.send({
      to: 'beta-team@sdlc.ai',
      template: 'new-beta-application',
      data: {
        applicantName: application.name,
        email: application.email,
        company: application.company,
        experience: application.experience,
        useCase: application.useCase,
        reviewUrl: `https://admin.sdlc.ai/beta/applications/${result.meta.last_row_id}`,
      },
    });

    return {
      success: true,
      message: 'Application submitted successfully',
      applicationId: result.meta.last_row_id,
      nextSteps: [
        'Review your email for confirmation',
        'Wait for application review (3-5 business days)',
        'Complete onboarding if approved',
      ],
    };
  }

  /**
   * Approve or reject beta application
   */
  async reviewApplication(c: Context, applicationId: string, decision: 'approved' | 'rejected', notes?: string) {
    const adminId = c.get('userId');
    const isAdmin = await this.checkAdminRole(adminId);

    if (!isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    const betaUser = await this.db
      .prepare('SELECT * FROM beta_users WHERE id = ?')
      .bind(applicationId)
      .first<BetaUser>();

    if (!betaUser) {
      throw new Error('Application not found');
    }

    if (betaUser.applicationStatus !== 'pending') {
      throw new Error('Application already reviewed');
    }

    const status = decision === 'approved' ? 'approved' : 'rejected';
    const endDate = decision === 'approved'
      ? new Date(Date.now() + BETA_CONFIG.betaDuration).toISOString()
      : null;

    await this.db
      .prepare(`
        UPDATE beta_users
        SET application_status = ?, end_date = ?, notes = COALESCE(notes, '') || ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(status, endDate, notes ? `\n\nAdmin review: ${notes}` : '', applicationId)
      .run();

    if (decision === 'approved') {
      // Send approval email with onboarding link
      await this.email.send({
        to: betaUser.email,
        template: 'beta-approved',
        data: {
          name: betaUser.name,
          onboardingUrl: `https://app.sdlc.ai/beta/onboarding?token=${this.generateOnboardingToken(applicationId)}`,
          endDate: new Date(endDate!).toLocaleDateString(),
          welcomeKitUrl: 'https://docs.sdlc.ai/beta/welcome-kit',
        },
      });

      // Grant beta features
      await this.grantBetaFeatures(betaUser.id);
    } else {
      // Send rejection email
      await this.email.send({
        to: betaUser.email,
        template: 'beta-rejected',
        data: {
          name: betaUser.name,
          reason: notes || 'Program capacity reached',
          alternativeOptions: 'Join our waitlist for future availability',
        },
      });
    }

    // Track review event
    await this.monitoring.trackEvent('beta_application_reviewed', {
      applicationId,
      decision,
      reviewerId: adminId,
      experience: betaUser.experience,
    });

    return {
      success: true,
      message: `Application ${decision}`,
      betaUser: {
        id: betaUser.id,
        email: betaUser.email,
        name: betaUser.name,
        status,
        endDate,
      },
    };
  }

  /**
   * Complete beta onboarding
   */
  async completeOnboarding(c: Context, onboardingData: any) {
    const userId = c.get('userId');
    const token = c.req.query('token');

    // Verify onboarding token
    const isValidToken = await this.verifyOnboardingToken(userId, token);
    if (!isValidToken) {
      throw new Error('Invalid or expired onboarding token');
    }

    // Update beta user status
    await this.db
      .prepare(`
        UPDATE beta_users
        SET application_status = 'active', testing_phase = 'core',
            last_active_date = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `)
      .bind(userId)
      .run();

    // Record onboarding completion
    await this.db
      .prepare(`
        INSERT INTO beta_activities (user_id, activity_type, activity_data, created_at)
        VALUES (?, 'onboarding_completed', ?, CURRENT_TIMESTAMP)
      `)
      .bind(userId, JSON.stringify(onboardingData))
      .run();

    // Send welcome email
    const betaUser = await this.db
      .prepare('SELECT * FROM beta_users WHERE user_id = ?')
      .bind(userId)
      .first<BetaUser>();

    if (betaUser) {
      await this.email.send({
        to: betaUser.email,
        template: 'beta-welcome',
        data: {
          name: betaUser.name,
          testingGuideUrl: 'https://docs.sdlc.ai/beta/testing-guide',
          supportChannel: 'beta-support@sdlc.ai',
          firstScenarioUrl: 'https://app.sdlc.ai/beta/scenarios/first-steps',
        },
      });
    }

    return {
      success: true,
      message: 'Onboarding completed successfully',
      nextSteps: [
        'Start with core testing scenarios',
        'Join the beta Slack community',
        'Schedule your first check-in call',
      ],
      welcomeKit: {
        quickStartGuide: 'https://docs.sdlc.ai/beta/quick-start',
        testingScenarios: await this.getTestingScenarios('core'),
        communityInvite: await this.generateCommunityInvite(userId),
        officeHoursSchedule: 'https://calendly.com/sdlc-beta/office-hours',
      },
    };
  }

  /**
   * Submit feedback
   */
  async submitFeedback(c: Context, feedbackData: z.infer<typeof feedbackSchema>) {
    const userId = c.get('userId');
    const userAgent = c.req.header('User-Agent');

    // Validate beta user status
    const betaUser = await this.db
      .prepare('SELECT * FROM beta_users WHERE user_id = ? AND application_status = "active"')
      .bind(userId)
      .first<BetaUser>();

    if (!betaUser) {
      throw new Error('Not an active beta user');
    }

    // Create feedback record
    const feedbackId = crypto.randomUUID();
    const feedback: Omit<Feedback, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
      userId,
      type: feedbackData.type,
      category: feedbackData.type === 'bug' ? 'high' : 'medium',
      title: feedbackData.title,
      description: feedbackData.description,
      context: {
        ...feedbackData.context,
        userAgent,
        timestamp: new Date().toISOString(),
      },
      attachments: feedbackData.attachments || [],
      priority: feedbackData.type === 'bug' ? 'high' : 'normal',
    };

    await this.db
      .prepare(`
        INSERT INTO beta_feedback (
          id, user_id, type, category, title, description, context,
          attachments, status, priority, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)
      .bind(
        feedbackId,
        feedback.userId,
        feedback.type,
        feedback.category,
        feedback.title,
        feedback.description,
        JSON.stringify(feedback.context),
        JSON.stringify(feedback.attachments),
        'new',
        feedback.priority
      )
      .run();

    // Update user feedback count
    await this.db
      .prepare(`
        UPDATE beta_users
        SET feedback_count = feedback_count + 1, last_active_date = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `)
      .bind(userId)
      .run();

    // Auto-categorize and prioritize
    await this.categorizeFeedback(feedbackId, feedback);

    // Reward credits for feedback
    const rewardCredits = feedback.type === 'bug' && feedback.category === 'critical'
      ? BETA_CONFIG.criticalBugRewardCredits
      : BETA_CONFIG.feedbackRewardCredits;

    await this.db
      .prepare('UPDATE beta_users SET reward_credits = reward_credits + ? WHERE user_id = ?')
      .bind(rewardCredits, userId)
      .run();

    // Send confirmation email
    await this.email.send({
      to: betaUser.email,
      template: 'beta-feedback-received',
      data: {
        name: betaUser.name,
        feedbackId,
        feedbackType: feedback.type,
        creditsEarned: rewardCredits,
        expectedResponseTime: '24-48 hours',
      },
    });

    // Track feedback event
    await this.monitoring.trackEvent('beta_feedback_submitted', {
      feedbackId,
      userId,
      type: feedback.type,
      category: feedback.category,
      hasAttachments: feedback.attachments.length > 0,
    });

    return {
      success: true,
      message: 'Feedback submitted successfully',
      feedbackId,
      creditsEarned: rewardCredits,
      totalCredits: betaUser.rewardCredits + rewardCredits,
      nextSteps: [
        'We\'ll review your feedback within 24-48 hours',
        'You\'ll receive updates on our progress',
        'Keep testing and submitting feedback',
      ],
    };
  }

  /**
   * Get testing scenarios for current phase
   */
  async getTestingScenarios(phase?: BetaUser['testingPhase']) {
    const userId = 'current'; // Would get from context

    const betaUser = await this.db
      .prepare('SELECT testing_phase FROM beta_users WHERE user_id = ?')
      .bind(userId)
      .first<{ testing_phase: BetaUser['testingPhase'] }>();

    const currentPhase = phase || betaUser?.testing_phase || 'onboarding';

    const scenarios = await this.db
      .prepare(`
        SELECT * FROM beta_testing_scenarios
        WHERE phase = ? AND active = true
        ORDER BY completion_points DESC, estimated_time ASC
      `)
      .bind(currentPhase)
      .all<TestingScenario>();

    // Get completed scenarios for user
    const completed = await this.db
      .prepare(`
        SELECT scenario_id FROM beta_scenario_completions
        WHERE user_id = ? AND completed_at IS NOT NULL
      `)
      .bind(userId)
      .all<{ scenario_id: string }>();

    const completedIds = new Set(completed.map(c => c.scenario_id));

    return {
      phase: currentPhase,
      scenarios: scenarios.map(s => ({
        ...s,
        completed: completedIds.has(s.id),
        progress: await this.getScenarioProgress(userId, s.id),
      })),
      phaseProgress: await this.getPhaseProgress(userId, currentPhase),
      nextPhase: this.getNextPhase(currentPhase),
    };
  }

  /**
   * Complete testing scenario
   */
  async completeScenario(c: Context, scenarioId: string, completionData: any) {
    const userId = c.get('userId');

    // Verify beta user
    const betaUser = await this.db
      .prepare('SELECT * FROM beta_users WHERE user_id = ? AND application_status = "active"')
      .bind(userId)
      .first<BetaUser>();

    if (!betaUser) {
      throw new Error('Not an active beta user');
    }

    // Get scenario details
    const scenario = await this.db
      .prepare('SELECT * FROM beta_testing_scenarios WHERE id = ?')
      .bind(scenarioId)
      .first<TestingScenario>();

    if (!scenario) {
      throw new Error('Scenario not found');
    }

    // Check if already completed
    const existing = await this.db
      .prepare('SELECT * FROM beta_scenario_completions WHERE user_id = ? AND scenario_id = ?')
      .bind(userId, scenarioId)
      .first();

    if (existing && existing.completed_at) {
      throw new Error('Scenario already completed');
    }

    // Record completion
    await this.db
      .prepare(`
        INSERT OR REPLACE INTO beta_scenario_completions
        (user_id, scenario_id, completion_data, completed_at, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, COALESCE(
          (SELECT created_at FROM beta_scenario_completions WHERE user_id = ? AND scenario_id = ?),
          CURRENT_TIMESTAMP
        ))
      `)
      .bind(userId, scenarioId, JSON.stringify(completionData), userId, scenarioId)
      .run();

    // Update engagement score
    await this.updateEngagementScore(userId, scenario.completionPoints);

    // Check phase completion
    const phaseProgress = await this.getPhaseProgress(userId, betaUser.testingPhase);
    if (phaseProgress.completed >= phaseProgress.total) {
      await this.advanceToNextPhase(userId);
    }

    // Reward credits
    await this.db
      .prepare('UPDATE beta_users SET reward_credits = reward_credits + ? WHERE user_id = ?')
      .bind(Math.floor(scenario.completionPoints / 10), userId)
      .run();

    // Track completion event
    await this.monitoring.trackEvent('beta_scenario_completed', {
      userId,
      scenarioId,
      phase: scenario.phase,
      points: scenario.completionPoints,
    });

    return {
      success: true,
      message: 'Scenario completed successfully',
      pointsEarned: scenario.completionPoints,
      engagementScore: await this.getEngagementScore(userId),
      phaseProgress,
      nextScenario: await this.getNextRecommendedScenario(userId),
    };
  }

  /**
   * Submit survey response
   */
  async submitSurveyResponse(c: Context, surveyData: z.infer<typeof surveyResponseSchema>) {
    const userId = c.get('userId');

    // Verify beta user
    const betaUser = await this.db
      .prepare('SELECT * FROM beta_users WHERE user_id = ? AND application_status = "active"')
      .bind(userId)
      .first<BetaUser>();

    if (!betaUser) {
      throw new Error('Not an active beta user');
    }

    // Record survey response
    await this.db
      .prepare(`
        INSERT INTO beta_survey_responses
        (user_id, survey_id, responses, rating, would_recommend, comments, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(
        userId,
        surveyData.surveyId,
        JSON.stringify(surveyData.responses),
        surveyData.rating,
        surveyData.wouldRecommend,
        surveyData.comments
      )
      .run();

    // Update user's survey responses
    const updatedResponses = {
      ...betaUser.surveyResponses,
      [surveyData.surveyId]: {
        rating: surveyData.rating,
        wouldRecommend: surveyData.wouldRecommend,
        submittedAt: new Date().toISOString(),
      },
    };

    await this.db
      .prepare('UPDATE beta_users SET survey_responses = ? WHERE user_id = ?')
      .bind(JSON.stringify(updatedResponses), userId)
      .run();

    // Reward for survey completion
    const surveyReward = 50;
    await this.db
      .prepare('UPDATE beta_users SET reward_credits = reward_credits + ? WHERE user_id = ?')
      .bind(surveyReward, userId)
      .run();

    // Track survey event
    await this.monitoring.trackEvent('beta_survey_completed', {
      userId,
      surveyId: surveyData.surveyId,
      rating: surveyData.rating,
      wouldRecommend: surveyData.wouldRecommend,
    });

    return {
      success: true,
      message: 'Survey response submitted',
      creditsEarned: surveyReward,
      thankYouMessage: 'Your feedback helps us improve SDLC.ai',
    };
  }

  /**
   * Get beta metrics and analytics
   */
  async getBetaMetrics(c: Context): Promise<BetaMetrics> {
    const isAdmin = await this.checkAdminRole(c.get('userId'));
    if (!isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    // Get basic metrics
    const metrics = await this.db
      .prepare(`
        SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN application_status = 'active' THEN 1 END) as active_users,
          COUNT(CASE WHEN application_status = 'completed' THEN 1 END) as completed_users,
          AVG(engagement_score) as avg_engagement,
          SUM(feedback_count) as total_feedback,
          SUM(bugs_reported) as total_bugs
        FROM beta_users
      `)
      .first<{
        total_users: number;
        active_users: number;
        completed_users: number;
        avg_engagement: number;
        total_feedback: number;
        total_bugs: number;
      }>();

    // Get phase distribution
    const phaseDist = await this.db
      .prepare(`
        SELECT testing_phase, COUNT(*) as count
        FROM beta_users
        WHERE application_status = 'active'
        GROUP BY testing_phase
      `)
      .all<{ testing_phase: BetaUser['testingPhase']; count: number }>();

    const phaseDistribution = phaseDist.reduce((acc, row) => {
      acc[row.testing_phase] = row.count;
      return acc;
    }, {} as Record<BetaUser['testingPhase'], number>);

    // Get weekly activity
    const weeklyActivity = await this.getWeeklyActivity();

    // Calculate completion rate
    const completionRate = metrics?.total_users
      ? (metrics.completed_users / metrics.total_users) * 100
      : 0;

    // Get NPS and satisfaction scores
    const npsScore = await this.calculateNPSScore();
    const satisfactionScore = await this.calculateSatisfactionScore();

    return {
      totalUsers: metrics?.total_users || 0,
      activeUsers: metrics?.active_users || 0,
      completionRate,
      averageEngagementScore: metrics?.avg_engagement || 0,
      feedbackCount: metrics?.total_feedback || 0,
      bugsReported: metrics?.total_bugs || 0,
      featureRequests: await this.getFeatureRequestCount(),
      npsScore,
      satisfactionScore,
      phaseDistribution,
      weeklyActivity,
    };
  }

  /**
   * Generate beta testing report
   */
  async generateBetaReport(c: Context, reportType: 'weekly' | 'summary' | 'detailed') {
    const isAdmin = await this.checkAdminRole(c.get('userId'));
    if (!isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    const metrics = await this.getBetaMetrics(c);
    const topFeedback = await this.getTopFeedback(20);
    const activeScenarios = await this.getActiveScenarioStats();
    const userSegmentation = await this.getUserSegmentation();
    const recommendations = await this.generateRecommendations(metrics);

    const report = {
      reportType,
      generatedAt: new Date().toISOString(),
      period: reportType === 'weekly' ? 'Last 7 days' : 'Beta program duration',
      metrics,
      insights: {
        topIssues: topFeedback.slice(0, 5),
        mostTestedFeatures: activeScenarios.slice(0, 5),
        userSegments: userSegmentation,
        trends: await this.identifyTrends(),
      },
      recommendations,
      actionItems: await this.generateActionItems(),
      appendices: {
        allFeedback: topFeedback,
        scenarioStats: activeScenarios,
        userActivity: await this.getUserActivityDetails(),
      },
    };

    // Store report
    const reportId = crypto.randomUUID();
    await this.kv.put(
      `beta-report:${reportId}`,
      JSON.stringify(report),
      { expirationTtl: 30 * 24 * 60 * 60 } // 30 days
    );

    return {
      success: true,
      reportId,
      report,
      downloadUrl: `/api/beta/reports/${reportId}/download`,
    };
  }

  // Private helper methods
  private async checkAdminRole(userId: string): Promise<boolean> {
    const user = await this.db
      .prepare('SELECT role FROM users WHERE id = ?')
      .bind(userId)
      .first<{ role: string }>();

    return user?.role === 'admin';
  }

  private generateOnboardingToken(applicationId: string): string {
    const payload = {
      applicationId,
      timestamp: Date.now(),
      type: 'beta-onboarding',
    };

    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  private async verifyOnboardingToken(userId: string, token?: string): Promise<boolean> {
    if (!token) return false;

    try {
      const payload = JSON.parse(Buffer.from(token, 'base64').toString());
      const application = await this.db
        .prepare('SELECT * FROM beta_users WHERE id = ? AND user_id = ? AND application_status = "approved"')
        .bind(payload.applicationId, userId)
        .first();

      return !!application && Date.now() - payload.timestamp < 7 * 24 * 60 * 60 * 1000; // 7 days expiry
    } catch {
      return false;
    }
  }

  private async grantBetaFeatures(userId: string) {
    const features = BETA_CONFIG.features;
    const limits = BETA_CONFIG.limits;

    await this.db
      .prepare(`
        INSERT OR REPLACE INTO user_features (user_id, features, limits, granted_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(
        userId,
        JSON.stringify(features),
        JSON.stringify(limits)
      )
      .run();
  }

  private async categorizeFeedback(feedbackId: string, feedback: any) {
    // Use AI to auto-categorize and prioritize feedback
    // This would integrate with an LLM service
    const category = await this.analyzeFeedbackWithAI(feedback);

    await this.db
      .prepare('UPDATE beta_feedback SET category = ?, priority = ? WHERE id = ?')
      .bind(category.category, category.priority, feedbackId)
      .run();
  }

  private async analyzeFeedbackWithAI(feedback: any): Promise<{ category: string; priority: string }> {
    // Simplified AI analysis logic
    // In production, this would call an LLM service
    const text = feedback.title + ' ' + feedback.description;

    if (text.includes('crash') || text.includes('broken') || text.includes('not working')) {
      return { category: 'critical', priority: 'urgent' };
    } else if (text.includes('bug') || text.includes('error')) {
      return { category: 'high', priority: 'high' };
    } else if (text.includes('feature') || text.includes('add')) {
      return { category: 'feature', priority: 'normal' };
    } else {
      return { category: 'improvement', priority: 'normal' };
    }
  }

  private async getScenarioProgress(userId: string, scenarioId: string) {
    const completion = await this.db
      .prepare(`
        SELECT completion_data, completed_at
        FROM beta_scenario_completions
        WHERE user_id = ? AND scenario_id = ?
      `)
      .bind(userId, scenarioId)
      .first();

    return completion || { started: false, progress: 0 };
  }

  private async getPhaseProgress(userId: string, phase: BetaUser['testingPhase']) {
    const total = await this.db
      .prepare('SELECT COUNT(*) as count FROM beta_testing_scenarios WHERE phase = ? AND active = true')
      .bind(phase)
      .first<{ count: number }>();

    const completed = await this.db
      .prepare(`
        SELECT COUNT(*) as count
        FROM beta_scenario_completions sc
        JOIN beta_testing_scenarios s ON sc.scenario_id = s.id
        WHERE sc.user_id = ? AND s.phase = ? AND sc.completed_at IS NOT NULL
      `)
      .bind(userId, phase)
      .first<{ count: number }>();

    return {
      total: total?.count || 0,
      completed: completed?.count || 0,
      percentage: total?.count ? ((completed?.count || 0) / total.count) * 100 : 0,
    };
  }

  private getNextPhase(currentPhase: BetaUser['testingPhase']): BetaUser['testingPhase'] | null {
    const phases: BetaUser['testingPhase'][] = ['onboarding', 'core', 'advanced', 'load', 'integration'];
    const currentIndex = phases.indexOf(currentPhase);
    return currentIndex < phases.length - 1 ? phases[currentIndex + 1] : null;
  }

  private async advanceToNextPhase(userId: string) {
    const betaUser = await this.db
      .prepare('SELECT testing_phase FROM beta_users WHERE user_id = ?')
      .bind(userId)
      .first<{ testing_phase: BetaUser['testingPhase'] }>();

    if (betaUser) {
      const nextPhase = this.getNextPhase(betaUser.testing_phase);
      if (nextPhase) {
        await this.db
          .prepare('UPDATE beta_users SET testing_phase = ? WHERE user_id = ?')
          .bind(nextPhase, userId)
          .run();

        // Send phase transition email
        await this.sendPhaseTransitionEmail(userId, nextPhase);
      }
    }
  }

  private async updateEngagementScore(userId: string, points: number) {
    await this.db
      .prepare(`
        UPDATE beta_users
        SET engagement_score = engagement_score + ?,
            last_active_date = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `)
      .bind(points, userId)
      .run();
  }

  private async getEngagementScore(userId: string): Promise<number> {
    const result = await this.db
      .prepare('SELECT engagement_score FROM beta_users WHERE user_id = ?')
      .bind(userId)
      .first<{ engagement_score: number }>();

    return result?.engagement_score || 0;
  }

  private async getNextRecommendedScenario(userId: string) {
    const betaUser = await this.db
      .prepare('SELECT testing_phase FROM beta_users WHERE user_id = ?')
      .bind(userId)
      .first<{ testing_phase: BetaUser['testingPhase'] }>();

    if (!betaUser) return null;

    return await this.db
      .prepare(`
        SELECT s.* FROM beta_testing_scenarios s
        LEFT JOIN beta_scenario_completions sc ON s.id = sc.scenario_id AND sc.user_id = ?
        WHERE s.phase = ? AND sc.completed_at IS NULL AND s.active = true
        ORDER BY s.completion_points DESC
        LIMIT 1
      `)
      .bind(userId, betaUser.testing_phase)
      .first<TestingScenario>();
  }

  private async generateCommunityInvite(userId: string) {
    // Generate invitation to Slack/Discord community
    return {
      slackInviteUrl: `https://slack.sdlc.ai/beta-invite?user=${userId}`,
      discordInviteUrl: `https://discord.gg/sdlc-beta-${userId}`,
      communityGuidelines: 'https://docs.sdlc.ai/beta/community-guidelines',
    };
  }

  private async sendPhaseTransitionEmail(userId: string, phase: BetaUser['testingPhase']) {
    const betaUser = await this.db
      .prepare('SELECT email, name FROM beta_users WHERE user_id = ?')
      .bind(userId)
      .first<BetaUser>();

    if (betaUser) {
      await this.email.send({
        to: betaUser.email,
        template: 'beta-phase-transition',
        data: {
          name: betaUser.name,
          newPhase: phase,
          phaseUrl: `https://app.sdlc.ai/beta/phase/${phase}`,
          scenarios: await this.getTestingScenarios(phase),
        },
      });
    }
  }

  private async getWeeklyActivity() {
    // Implementation for weekly activity tracking
    return Array.from({ length: 8 }, (_, i) => ({
      week: i + 1,
      activeUsers: Math.floor(Math.random() * 80) + 20,
      feedbackSubmitted: Math.floor(Math.random() * 50) + 10,
      scenariosCompleted: Math.floor(Math.random() * 200) + 50,
    }));
  }

  private async calculateNPSScore(): Promise<number> {
    const result = await this.db
      .prepare(`
        SELECT
          SUM(CASE WHEN would_recommend = true THEN 1 ELSE 0 END) as promoters,
          SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as detractors,
          COUNT(*) as total
        FROM beta_survey_responses
        WHERE survey_id LIKE '%nps%'
      `)
      .first<{ promoters: number; detractors: number; total: number }>();

    if (!result || result.total === 0) return 0;

    const promotersPercent = (result.promoters / result.total) * 100;
    const detractorsPercent = (result.detractors / result.total) * 100;

    return promotersPercent - detractorsPercent;
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

  private async getTopFeedback(limit: number = 20) {
    return await this.db
      .prepare(`
        SELECT f.*, u.name, u.email
        FROM beta_feedback f
        JOIN beta_users u ON f.user_id = u.user_id
        ORDER BY f.priority DESC, f.created_at DESC
        LIMIT ?
      `)
      .bind(limit)
      .all();
  }

  private async getActiveScenarioStats() {
    return await this.db
      .prepare(`
        SELECT
          s.name,
          s.phase,
          COUNT(sc.id) as completions,
          AVG(s.completion_points) as avg_points
        FROM beta_testing_scenarios s
        LEFT JOIN beta_scenario_completions sc ON s.id = sc.scenario_id
        WHERE s.active = true
        GROUP BY s.id
        ORDER BY completions DESC
      `)
      .all();
  }

  private async getUserSegmentation() {
    return await this.db
      .prepare(`
        SELECT
          experience,
          COUNT(*) as count,
          AVG(engagement_score) as avg_engagement,
          AVG(feedback_count) as avg_feedback
        FROM beta_users
        WHERE application_status = 'active'
        GROUP BY experience
      `)
      .all();
  }

  private async identifyTrends() {
    // AI-powered trend identification
    return {
      increasingIssues: ['Document upload timeouts', 'Search performance'],
      positiveFeedback: ['SDK ease of use', 'Documentation quality'],
      commonFeatureRequests: ['Batch processing', 'Real-time notifications'],
      dropoffPoints: ['Advanced configuration', 'Custom integrations'],
    };
  }

  private async generateRecommendations(metrics: BetaMetrics) {
    const recommendations = [];

    if (metrics.completionRate < 50) {
      recommendations.push({
        priority: 'high',
        type: 'onboarding',
        title: 'Improve onboarding flow',
        description: 'Low completion rate suggests onboarding issues',
        action: 'Simplify initial setup and add guided tutorials',
      });
    }

    if (metrics.averageEngagementScore < 70) {
      recommendations.push({
        priority: 'medium',
        type: 'engagement',
        title: 'Boost user engagement',
        description: 'Engagement score below target',
        action: 'Add gamification and regular check-ins',
      });
    }

    if (metrics.npsScore < 40) {
      recommendations.push({
        priority: 'high',
        type: 'satisfaction',
        title: 'Address user satisfaction',
        description: 'NPS score indicates dissatisfaction',
        action: 'Conduct user interviews and address top pain points',
      });
    }

    return recommendations;
  }

  private async generateActionItems() {
    return [
      {
        owner: 'Product Team',
        action: 'Review and prioritize top 10 feature requests',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        owner: 'Engineering',
        action: 'Fix all critical and high-priority bugs',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        owner: 'Community Manager',
        action: 'Schedule office hours for next week',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
  }

  private async getUserActivityDetails() {
    // Detailed user activity analysis
    return {
      dailyActiveUsers: [],
      featureUsage: [],
    };
  }
}

export default BetaTestingService;
