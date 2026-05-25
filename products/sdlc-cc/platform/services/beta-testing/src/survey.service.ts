/**
 * Survey Service - Handles beta user survey responses
 */

import { Context } from 'hono';
import { z } from '@sdlc/mcp-sdk';
import {
  surveyResponseSchema,
  type BetaUser,
  type BetaServiceDeps,
} from './beta-config';

export class SurveyService {
  private db: D1Database;
  private monitoring: BetaServiceDeps['monitoring'];

  constructor(deps: BetaServiceDeps) {
    this.db = deps.db;
    this.monitoring = deps.monitoring;
  }

  async submitSurveyResponse(
    c: Context,
    surveyData: z.infer<typeof surveyResponseSchema>,
  ) {
    const userId = c.get('userId');

    const betaUser = await this.db
      .prepare(
        'SELECT * FROM beta_users WHERE user_id = ? AND application_status = "active"',
      )
      .bind(userId)
      .first<BetaUser>();

    if (!betaUser) {
      throw new Error('Not an active beta user');
    }

    await this.db
      .prepare(
        `INSERT INTO beta_survey_responses
        (user_id, survey_id, responses, rating, would_recommend, comments, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      )
      .bind(
        userId,
        surveyData.surveyId,
        JSON.stringify(surveyData.responses),
        surveyData.rating,
        surveyData.wouldRecommend,
        surveyData.comments,
      )
      .run();

    const updatedResponses = {
      ...betaUser.surveyResponses,
      [surveyData.surveyId]: {
        rating: surveyData.rating,
        wouldRecommend: surveyData.wouldRecommend,
        submittedAt: new Date().toISOString(),
      },
    };

    await this.db
      .prepare(
        'UPDATE beta_users SET survey_responses = ? WHERE user_id = ?',
      )
      .bind(JSON.stringify(updatedResponses), userId)
      .run();

    const surveyReward = 50;
    await this.db
      .prepare(
        'UPDATE beta_users SET reward_credits = reward_credits + ? WHERE user_id = ?',
      )
      .bind(surveyReward, userId)
      .run();

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
      thankYouMessage:
        'Your feedback helps us improve SDLC.ai',
    };
  }
}
