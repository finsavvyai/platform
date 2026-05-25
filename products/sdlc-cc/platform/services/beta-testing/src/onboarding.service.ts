/**
 * Onboarding Service - Handles beta user onboarding flow
 */

import { Context } from 'hono';
import type { OnboardingData } from './types';
import type { BetaUser, BetaServiceDeps } from './beta-config';
import { ScenarioService } from './scenario.service';

export class OnboardingService {
  private db: D1Database;
  private email: BetaServiceDeps['email'];
  private scenarioService: ScenarioService;

  constructor(
    deps: BetaServiceDeps,
    scenarioService: ScenarioService,
  ) {
    this.db = deps.db;
    this.email = deps.email;
    this.scenarioService = scenarioService;
  }

  async completeOnboarding(
    c: Context,
    onboardingData: OnboardingData,
  ) {
    const userId = c.get('userId');
    const token = c.req.query('token');

    const isValidToken = await this.verifyOnboardingToken(
      userId,
      token,
    );
    if (!isValidToken) {
      throw new Error('Invalid or expired onboarding token');
    }

    await this.db
      .prepare(
        `UPDATE beta_users
        SET application_status = 'active', testing_phase = 'core',
            last_active_date = CURRENT_TIMESTAMP
        WHERE user_id = ?`,
      )
      .bind(userId)
      .run();

    await this.db
      .prepare(
        `INSERT INTO beta_activities
        (user_id, activity_type, activity_data, created_at)
        VALUES (?, 'onboarding_completed', ?, CURRENT_TIMESTAMP)`,
      )
      .bind(userId, JSON.stringify(onboardingData))
      .run();

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
          testingGuideUrl:
            'https://docs.sdlc.cc/beta/testing-guide',
          supportChannel: 'beta-support@sdlc.cc',
          firstScenarioUrl:
            'https://app.sdlc.cc/beta/scenarios/first-steps',
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
        quickStartGuide: 'https://docs.sdlc.cc/beta/quick-start',
        testingScenarios:
          await this.scenarioService.getTestingScenarios('core'),
        communityInvite:
          await this.generateCommunityInvite(userId),
        officeHoursSchedule:
          'https://calendly.com/sdlc-beta/office-hours',
      },
    };
  }

  private async verifyOnboardingToken(
    userId: string,
    token?: string,
  ): Promise<boolean> {
    if (!token) return false;
    try {
      const payload = JSON.parse(
        Buffer.from(token, 'base64').toString(),
      );
      const application = await this.db
        .prepare(
          'SELECT * FROM beta_users WHERE id = ? AND user_id = ? AND application_status = "approved"',
        )
        .bind(payload.applicationId, userId)
        .first();
      return (
        !!application &&
        Date.now() - payload.timestamp < 7 * 24 * 60 * 60 * 1000
      );
    } catch {
      return false;
    }
  }

  private async generateCommunityInvite(userId: string) {
    return {
      slackInviteUrl: `https://slack.sdlc.cc/beta-invite?user=${userId}`,
      discordInviteUrl: `https://discord.gg/sdlc-beta-${userId}`,
      communityGuidelines:
        'https://docs.sdlc.cc/beta/community-guidelines',
    };
  }
}
